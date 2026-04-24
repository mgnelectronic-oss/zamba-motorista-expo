import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type UpdateRideStatusNotifyOptions = {
  /**
   * Campos extra no mesmo `update` (ex.: finalização com distância/duração).
   * `status` e `updated_at` são sempre aplicados pelo serviço.
   */
  merge?: Record<string, unknown>;
  /**
   * Colunas a devolver após o update (`.select(...).single()`).
   */
  select?: string;
  /**
   * Se `rides.status` já for igual a `newStatus`:
   * - `noop` (padrão): não atualiza nem chama a Edge Function.
   * - `invoke_push_only`: não atualiza; chama `send-push-notifications` (ex.: após `accept_ride_offer`).
   */
  ifAlreadyStatus?: 'noop' | 'invoke_push_only';
};

export type UpdateRideStatusAndNotifyResult = {
  updated: boolean;
  error: Error | null;
  data?: unknown;
};

async function invokeSendPushNotifications(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.functions.invoke('send-push-notifications');
    if (error) {
      console.warn('[rideStatusNotifications] send-push-notifications:', error.message ?? error);
    }
  } catch (e) {
    console.warn('[rideStatusNotifications] send-push-notifications:', e);
  }
}

/**
 * Atualiza `rides.status` (e opcionalmente campos em `merge`), depois pede o processamento da fila de pushes.
 * Não interfere em rotas nem noutras Edge Functions.
 */
export async function updateRideStatusAndTriggerNotifications(
  rideId: string,
  newStatus: string,
  options?: UpdateRideStatusNotifyOptions,
): Promise<UpdateRideStatusAndNotifyResult> {
  if (!isSupabaseConfigured) {
    return { updated: false, error: new Error('Supabase não configurado.') };
  }
  const id = rideId?.trim();
  if (!id) {
    return { updated: false, error: new Error('rideId em falta.') };
  }
  const statusTrim = newStatus?.trim();
  if (!statusTrim) {
    return { updated: false, error: new Error('newStatus em falta.') };
  }

  try {
    const { data: row, error: selErr } = await supabase.from('rides').select('id, status').eq('id', id).maybeSingle();

    if (selErr) throw selErr;
    if (!row) {
      return { updated: false, error: new Error('Corrida não encontrada.') };
    }

    const current = String(row.status ?? '');
    if (current === statusTrim) {
      if (options?.ifAlreadyStatus === 'invoke_push_only') {
        await invokeSendPushNotifications();
      }
      return { updated: false, error: null };
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      ...(options?.merge ?? {}),
      status: statusTrim,
      updated_at: now,
    };

    if (options?.select) {
      const { data: updated, error: upErr } = await supabase
        .from('rides')
        .update(patch)
        .eq('id', id)
        .select(options.select)
        .single();

      if (upErr) throw upErr;
      if (updated == null) {
        return { updated: false, error: new Error('Resposta vazia após atualizar a corrida.') };
      }
      await invokeSendPushNotifications();
      return { updated: true, error: null, data: updated };
    }

    const { data: updatedRows, error: upErr } = await supabase
      .from('rides')
      .update(patch)
      .eq('id', id)
      .select('id');

    if (upErr) throw upErr;
    if (!updatedRows?.length) {
      return { updated: false, error: new Error('Nenhuma linha atualizada.') };
    }

    await invokeSendPushNotifications();
    return { updated: true, error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { updated: false, error: err };
  }
}
