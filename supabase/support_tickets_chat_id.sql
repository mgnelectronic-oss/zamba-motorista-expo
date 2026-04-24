-- Ligar cada pedido de suporte a um chat (uma conversa por ticket).
-- Executar no SQL Editor do Supabase após suporte_chat_schema.sql.
--
-- 1) Permite vários `support_chats` por utilizador (remove o limite 1:1)
alter table public.support_chats
  drop constraint if exists support_chats_user_id_key;

-- 2) Cada ticket referencia o chat onde decorre a conversa
alter table public.support_tickets
  add column if not exists chat_id uuid references public.support_chats (id) on delete set null;

create index if not exists support_tickets_user_id_created_at_idx
  on public.support_tickets (user_id, created_at desc);

create index if not exists support_tickets_chat_id_idx
  on public.support_tickets (chat_id)
  where chat_id is not null;
