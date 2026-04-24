import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type {
  SupportChatRow,
  SupportMessageRow,
  SupportMessageSender,
  SupportMessageType,
  SupportTicketRow,
} from '@/types/support';

const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/dso17jqic/image/upload';

export type SupportChatImagePick = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

/**
 * Envia a imagem para o Cloudinary (preset unsigned `support_chat_upload`) e devolve `secure_url`.
 * O ficheiro não fica no Supabase — apenas a URL é guardada na mensagem.
 */
export async function uploadImagemCloudinary(file: SupportChatImagePick): Promise<string> {
  if (!file?.uri) {
    throw new Error('Imagem inválida.');
  }

  const data = new FormData();
  // React Native: objeto com uri/type/name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data.append('file', { uri: file.uri, type: 'image/jpeg', name: 'upload.jpg' } as any);
  data.append('upload_preset', 'support_chat_upload');

  const res = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: data,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || 'Erro no upload da imagem');
  }

  const json = (await res.json()) as { secure_url?: string };
  if (!json.secure_url) {
    throw new Error('Resposta inválida do servidor de imagens');
  }
  return json.secure_url;
}

function assertConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado.');
  }
}

/**
 * Cria `support_chats` (open) → `support_tickets` (pending) com `chat_id` → primeira `support_messages` (user/text/sent).
 */
export async function criarTicketSuporte(
  categoria: string,
  mensagem: string,
): Promise<SupportTicketRow> {
  assertConfigured();
  const message = mensagem.trim();
  if (!message) {
    throw new Error('A mensagem não pode estar vazia.');
  }
  if (!categoria.trim()) {
    throw new Error('Categoria inválida.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Sessão expirada, faça login novamente');
  }

  const categoriaSelecionada = categoria.trim();

  const { data: chat, error: chatErr } = await supabase
    .from('support_chats')
    .insert([{ user_id: user.id, status: 'open' }])
    .select('id, user_id, status, created_at, updated_at')
    .single();

  if (chatErr || !chat) {
    throw new Error(chatErr?.message || 'Não foi possível criar a conversa.');
  }
  const chatId = (chat as SupportChatRow).id;

  const { data: ticket, error: ticketErr } = await supabase
    .from('support_tickets')
    .insert([
      {
        user_id: user.id,
        category: categoriaSelecionada,
        message,
        status: 'pending',
        chat_id: chatId,
      },
    ])
    .select('id, user_id, category, message, status, created_at, updated_at, chat_id')
    .single();

  if (ticketErr || !ticket) {
    await supabase.from('support_chats').delete().eq('id', chatId);
    throw new Error(ticketErr?.message || 'Não foi possível enviar a solicitação.');
  }

  const { error: msgErr } = await supabase.from('support_messages').insert([
    {
      chat_id: chatId,
      message,
      sender: 'user',
      type: 'text',
      status: 'sent',
    },
  ]);

  if (msgErr) {
    const tid = (ticket as SupportTicketRow).id;
    await supabase.from('support_tickets').delete().eq('id', tid);
    await supabase.from('support_chats').delete().eq('id', chatId);
    throw new Error(msgErr.message || 'Não foi possível guardar a mensagem.');
  }

  return ticket as SupportTicketRow;
}

/**
 * Lista tickets do utilizador autenticado (`user_id` = `getUser().id`), `created_at` desc.
 */
export async function listarTicketsDoUsuario(): Promise<SupportTicketRow[]> {
  assertConfigured();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Sessão expirada, faça login novamente');
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, user_id, category, message, status, created_at, updated_at, chat_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Não foi possível carregar as solicitações.');
  }
  return (data ?? []) as SupportTicketRow[];
}

/**
 * Resolve o `chat_id` a mostrar: se `paramChatId` for um chat do utilizador, usa-o;
 * senão o pedido mais recente com `chat_id` (ticket ativo = último com conversa).
 */
export async function resolverIdChatAtivo(
  paramChatId: string | null | undefined,
): Promise<string | null> {
  assertConfigured();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Sessão expirada, faça login novamente');
  }

  const p = paramChatId?.trim();
  if (p) {
    const { data: own } = await supabase
      .from('support_chats')
      .select('id')
      .eq('id', p)
      .eq('user_id', user.id)
      .maybeSingle();
    if (own?.id) {
      return own.id;
    }
  }

  const { data: latest } = await supabase
    .from('support_tickets')
    .select('chat_id')
    .eq('user_id', user.id)
    .not('chat_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (latest as { chat_id?: string } | null)?.chat_id ?? null;
}

export async function listarMensagensChat(chatId: string): Promise<SupportMessageRow[]> {
  assertConfigured();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Sessão expirada, faça login novamente');
  }

  const { data, error } = await supabase
    .from('support_messages')
    .select('id, chat_id, sender, message, type, status, created_at, reply_to, reply_preview')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Não foi possível carregar as mensagens.');
  }
  return (data ?? []).map(normalizeMessageRow) as SupportMessageRow[];
}

function normalizeMessageRow(
  row: SupportMessageRow & {
    type?: string | null;
    sender?: string | null;
    reply_to?: string | null;
    reply_preview?: string | null;
  },
): SupportMessageRow {
  const t = row.type;
  const type: SupportMessageType = t === 'image' || t === 'text' ? t : 'text';
  const sender: SupportMessageSender = row.sender === 'user' ? 'user' : 'support';
  return {
    ...row,
    type,
    sender,
    reply_to: row.reply_to ?? null,
    reply_preview: row.reply_preview ?? null,
  };
}

const REPLY_PREVIEW_MAX = 500;

export type EnviarMensagemChatOptions = {
  replyToId?: string;
  /** Obrigatório quando `replyToId` está definido. */
  replyPreview?: string;
};

/**
 * Apaga uma mensagem do utilizador (RLS: só `sender = 'user'` no chat próprio).
 */
export async function apagarMensagemUtilizador(messageId: string): Promise<void> {
  assertConfigured();
  const { error } = await supabase.from('support_messages').delete().eq('id', messageId);
  if (error) {
    throw new Error(error.message || 'Não foi possível eliminar a mensagem.');
  }
}

export async function enviarMensagemChat(
  chatId: string,
  texto: string,
  type: SupportMessageType = 'text',
  options?: EnviarMensagemChatOptions,
): Promise<SupportMessageRow> {
  assertConfigured();

  const message = texto.trim();
  if (!message) {
    throw new Error(
      type === 'image' ? 'Imagem inválida.' : 'Escreva uma mensagem antes de enviar.',
    );
  }

  const replyId = options?.replyToId;
  if (replyId) {
    const preview = (options?.replyPreview ?? '').trim();
    if (!preview) {
      throw new Error('Falta pré-visualização da resposta.');
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Sessão expirada, faça login novamente');
  }

  const replyPreviewForDb = replyId
    ? (options?.replyPreview ?? '').trim().slice(0, REPLY_PREVIEW_MAX) || null
    : null;

  const { data, error } = await supabase
    .from('support_messages')
    .insert([
      {
        chat_id: chatId,
        sender: 'user',
        message,
        type,
        status: 'sent',
        reply_to: replyId ?? null,
        reply_preview: replyPreviewForDb,
      },
    ])
    .select('id, chat_id, sender, message, type, status, created_at, reply_to, reply_preview')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Não foi possível enviar a mensagem.');
  }
  return normalizeMessageRow(data as SupportMessageRow) as SupportMessageRow;
}

export type SupportChatRealtimeSubscription = {
  unsubscribe: () => void;
};

export type SupportMessagesRealtimeHandlers = {
  onInsert: (row: SupportMessageRow) => void;
  onUpdate: (row: SupportMessageRow) => void;
  onDelete?: (messageId: string) => void;
};

/**
 * Marca mensagens do suporte e mensagens do utilizador já entregues como lidas (RPC com `auth.uid()`).
 */
export async function marcarConversaComoLidaNoServidor(chatId: string): Promise<void> {
  assertConfigured();
  const { error } = await supabase.rpc('support_mark_chat_read', { p_chat_id: chatId });
  if (error) {
    throw new Error(error.message || 'Não foi possível atualizar o estado da conversa.');
  }
}

/**
 * INSERT e UPDATE em `support_messages` para o `chatId` (Realtime).
 */
export function inscreverMensagensChat(
  chatId: string,
  handlers: SupportMessagesRealtimeHandlers,
): SupportChatRealtimeSubscription {
  const channelId = `support_rt:${chatId}:${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const row = payload.new as (SupportMessageRow & { type?: string | null }) | null;
        if (row?.id) {
          handlers.onInsert(normalizeMessageRow(row));
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_messages',
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const row = payload.new as (SupportMessageRow & { type?: string | null }) | null;
        if (row?.id) {
          handlers.onUpdate(normalizeMessageRow(row));
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'support_messages',
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const id = (payload.old as { id?: string } | null)?.id;
        if (id && handlers.onDelete) {
          handlers.onDelete(id);
        }
      },
    )
    .subscribe();

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}
