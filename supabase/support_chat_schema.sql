-- Chat motorista ↔ suporte — executar no SQL Editor do Supabase.
-- Vários chats por utilizador (um por pedido em `support_tickets.chat_id`).
-- Ver também `support_tickets_chat_id.sql` para `support_tickets.chat_id` e remover UNIQUE legado.
-- Migração: se existir coluna sender_type, será renomeada para sender.

-- ---------------------------------------------------------------------------
-- Tabelas base
-- ---------------------------------------------------------------------------
create table if not exists public.support_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_chats
  add column if not exists status text not null default 'open';
alter table public.support_chats
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.support_chats (id) on delete cascade,
  sender text not null,
  message text not null,
  type text not null default 'text',
  status text not null default 'sent',
  reply_to uuid references public.support_messages (id) on delete set null,
  reply_preview text,
  created_at timestamptz not null default now(),
  constraint support_messages_sender_check check (sender in ('user', 'support')),
  constraint support_messages_status_check check (status in ('sent', 'delivered', 'read'))
);

-- Migração: sender_type → sender
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_messages' and column_name = 'sender_type'
  ) then
    alter table public.support_messages rename column sender_type to sender;
  end if;
end $$;

alter table public.support_messages
  add column if not exists status text not null default 'sent';

alter table public.support_messages
  add column if not exists type text not null default 'text';

do $$
begin
  alter table public.support_messages add constraint support_messages_type_check
    check (type in ('text', 'image'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.support_messages add constraint support_messages_sender_check
    check (sender in ('user', 'support'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.support_messages add constraint support_messages_status_check
    check (status in ('sent', 'delivered', 'read'));
exception when duplicate_object then null;
end $$;

create index if not exists support_messages_chat_id_created_at_idx
  on public.support_messages (chat_id, created_at asc);

alter table public.support_messages
  add column if not exists reply_to uuid references public.support_messages (id) on delete set null;

alter table public.support_messages
  add column if not exists reply_preview text;

-- Se reply_to for preenchido, a mensagem referida deve ser do mesmo chat
create or replace function public.support_messages_enforce_reply_same_chat()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reply_to is not null then
    if not exists (
      select 1 from public.support_messages p
      where p.id = new.reply_to and p.chat_id = new.chat_id
    ) then
      raise exception 'reply_to must reference a message in the same chat';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_support_messages_reply_check on public.support_messages;
create trigger trg_support_messages_reply_check
  before insert or update of reply_to, chat_id on public.support_messages
  for each row
  execute procedure public.support_messages_enforce_reply_same_chat();

-- ---------------------------------------------------------------------------
-- Triggers: resposta automática + entregues (✔✔ cinza) nas mensagens do user
-- ---------------------------------------------------------------------------
create or replace function public.support_auto_reply_first_user_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender = 'user' then
    if (
      select count(*)::int from public.support_messages where chat_id = new.chat_id
    ) = 1 then
      insert into public.support_messages (chat_id, sender, message, status)
      values (
        new.chat_id,
        'support',
        'Olá 👋 recebemos a sua mensagem. Vamos responder em breve.',
        'delivered'
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.support_mark_user_messages_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender = 'support' then
    update public.support_messages
    set status = 'delivered'
    where chat_id = new.chat_id
      and sender = 'user'
      and status = 'sent';
  end if;
  return new;
end;
$$;

create or replace function public.support_touch_chat_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.support_chats
  set updated_at = now()
  where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists trg_support_messages_auto_reply on public.support_messages;
create trigger trg_support_messages_auto_reply
  after insert on public.support_messages
  for each row
  execute procedure public.support_auto_reply_first_user_message();

drop trigger if exists trg_support_messages_mark_delivered on public.support_messages;
create trigger trg_support_messages_mark_delivered
  after insert on public.support_messages
  for each row
  execute procedure public.support_mark_user_messages_delivered();

drop trigger if exists trg_support_messages_touch_chat on public.support_messages;
create trigger trg_support_messages_touch_chat
  after insert on public.support_messages
  for each row
  execute procedure public.support_touch_chat_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.support_chats enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support_chats_select_own" on public.support_chats;
drop policy if exists "support_chats_insert_own" on public.support_chats;
drop policy if exists "support_messages_select_own_chat" on public.support_messages;
drop policy if exists "support_messages_insert_own_chat_user_only" on public.support_messages;
drop policy if exists "support_messages_update_support_read" on public.support_messages;
create policy "support_chats_select_own"
  on public.support_chats for select to authenticated
  using (user_id = (select auth.uid()));

create policy "support_chats_insert_own"
  on public.support_chats for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "support_messages_select_own_chat"
  on public.support_messages for select to authenticated
  using (
    exists (
      select 1 from public.support_chats c
      where c.id = support_messages.chat_id and c.user_id = (select auth.uid())
    )
  );

create policy "support_messages_insert_own_chat_user_only"
  on public.support_messages for insert to authenticated
  with check (
    sender = 'user'
    and status = 'sent'
    and exists (
      select 1 from public.support_chats c
      where c.id = chat_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "support_messages_delete_own_user" on public.support_messages;
create policy "support_messages_delete_own_user"
  on public.support_messages for delete to authenticated
  using (
    sender = 'user'
    and exists (
      select 1 from public.support_chats c
      where c.id = support_messages.chat_id and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Ao abrir o chat: marcar mensagens do suporte como lidas e mensagens do user (entregues) como lidas (✔✔ azul)
-- ---------------------------------------------------------------------------
create or replace function public.support_mark_chat_read(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.support_chats c
    where c.id = p_chat_id and c.user_id = (select auth.uid())
  ) then
    raise exception 'not allowed';
  end if;

  update public.support_messages
  set status = 'read'
  where chat_id = p_chat_id
    and sender = 'support'
    and status in ('sent', 'delivered');

  update public.support_messages
  set status = 'read'
  where chat_id = p_chat_id
    and sender = 'user'
    and status = 'delivered';
end;
$$;

grant execute on function public.support_mark_chat_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (INSERT + UPDATE para estados entregue/lido)
-- ---------------------------------------------------------------------------
alter table public.support_messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.support_messages;
exception when duplicate_object then null;
end $$;
