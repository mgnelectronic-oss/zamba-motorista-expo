/**
 * Alinhado à tabela existente `support_tickets`:
 * `user_id` referencia `profiles.id` (no app usamos `session.user.id` — igual a `auth.uid()` / `profiles.id` para o motorista).
 * `category` guarda o id estável (ex.: recargas, outro), não o texto de UI.
 */
export type SupportTicketStatus = 'pending' | 'in_progress' | 'resolved';

export type SupportTicketRow = {
  id: string;
  user_id: string;
  category: string;
  message: string;
  status: SupportTicketStatus;
  /** `support_chats.id` — conversa associada a este pedido. */
  chat_id?: string | null;
  created_at: string;
  updated_at?: string | null;
};

/** Linha em `support_chats` (uma conversa por ticket / pedido). */
export type SupportChatRow = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SupportMessageSender = 'user' | 'support';

export type SupportMessageStatus = 'sent' | 'delivered' | 'read';

export type SupportMessageType = 'text' | 'image';

/**
 * Dados mínimos para o modo "responder" (swipe / menu);
 * o envio em `getReplyPreviewForTarget` / `getReplyPreviewForMessage`.
 */
export type SupportChatReplyTarget = {
  id: string;
  content: string;
  type: SupportMessageType;
  sender: SupportMessageSender;
};

export function toSupportChatReplyTarget(m: SupportMessageRow): SupportChatReplyTarget {
  return {
    id: m.id,
    content: m.message,
    type: m.type,
    sender: m.sender,
  };
}

/** Mensagens do chat in-app. Tabela `support_messages`. */
export type SupportMessageRow = {
  id: string;
  chat_id: string;
  sender: SupportMessageSender;
  message: string;
  type: SupportMessageType;
  status: SupportMessageStatus;
  created_at: string;
  /** Resposta a outra mensagem (mesmo chat). */
  reply_to: string | null;
  /** Texto curto para a pré-visualização (evita join na listagem). */
  reply_preview: string | null;
};

/** Gera o texto a guardar em `reply_preview` ao responder a uma mensagem. */
export function getReplyPreviewForTarget(t: SupportChatReplyTarget): string {
  if (t.type === 'image') {
    return '📷 Imagem';
  }
  const text = t.content.trim();
  if (!text) {
    return 'Mensagem';
  }
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function getReplyPreviewForMessage(msg: SupportMessageRow): string {
  return getReplyPreviewForTarget(toSupportChatReplyTarget(msg));
}

export const SUPPORT_WHATSAPP_URL = 'https://wa.me/258870000000';

export const SUPPORT_EMAIL = 'suporte@zamba.mz';

/** Problemas comuns (ecrã inicial) — ids alinhados com `SUPPORT_CATEGORY_GROUPS`. */
export const SUPPORT_COMMON_CATEGORIES: { id: string; label: string }[] = [
  { id: 'recargas', label: 'Problemas com recargas' },
  { id: 'corridas', label: 'Problemas com corridas' },
  { id: 'conta_bloqueada', label: 'Conta bloqueada' },
  { id: 'outro', label: 'Outro problema' },
];

/** Ecrã “Categorias de Suporte” — grupos e itens. */
export const SUPPORT_CATEGORY_GROUPS: { groupTitle: string; items: { id: string; label: string }[] }[] = [
  {
    groupTitle: 'Financeiro',
    items: [
      { id: 'recargas', label: 'Problemas com recargas' },
      { id: 'pagamentos', label: 'Problemas com pagamentos' },
      { id: 'saldo_nao_atualizado', label: 'Saldo não atualizado' },
    ],
  },
  {
    groupTitle: 'Operação',
    items: [
      { id: 'corridas', label: 'Problemas com corridas' },
      { id: 'notificacoes', label: 'Problemas com notificações' },
      { id: 'gps', label: 'Problemas com GPS/localização' },
    ],
  },
  {
    groupTitle: 'Conta e verificação',
    items: [
      { id: 'conta_bloqueada', label: 'Conta bloqueada' },
      { id: 'documentos_verificacao', label: 'Documentos ou verificação' },
    ],
  },
  {
    groupTitle: 'Técnico',
    items: [{ id: 'problemas_app', label: 'Problemas com o app' }],
  },
  {
    groupTitle: 'Geral',
    items: [{ id: 'outro', label: 'Outro problema' }],
  },
];

const ALL_ITEMS = SUPPORT_CATEGORY_GROUPS.flatMap((g) => g.items);

export function getSupportCategoryLabel(categoryId: string): string {
  const f = ALL_ITEMS.find((i) => i.id === categoryId);
  return f?.label ?? categoryId;
}

export function supportStatusLabel(status: SupportTicketStatus): string {
  switch (status) {
    case 'pending':
      return 'Pendente';
    case 'in_progress':
      return 'Em análise';
    case 'resolved':
      return 'Resolvido';
    default:
      return status;
  }
}
