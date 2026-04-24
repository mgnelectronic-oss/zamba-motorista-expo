import { supabase } from '@/lib/supabase';
import type { InternetCallSignalType } from '@/types/internetCall';

/**
 * RPCs Supabase para chamadas de voz por internet (`ride_calls` / `ride_call_signals`).
 * Camada fina (sinalização) — sem áudio empacotado aqui.
 */

function parseCallIdFromRpc(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === 'string' && data.length > 0) return data;
  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const key of ['call_id', 'id', 'ride_call_id']) {
      const v = o[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  }
  return null;
}

/**
 * Motorista inicia chamada: caller = auth do motorista, receiver = auth do passageiro.
 * Parâmetros alinhados a `iniciar_chamada_internet(p_ride_id, p_caller_user_id, p_receiver_user_id, p_call_mode)`.
 */
export async function iniciarChamadaInternet(params: {
  p_ride_id: string;
  p_caller_user_id: string;
  p_receiver_user_id: string;
  p_call_mode: 'internet_voice';
}): Promise<{ call_id: string | null; raw: unknown }> {
  const { data, error } = await supabase.rpc('iniciar_chamada_internet', {
    p_ride_id: params.p_ride_id,
    p_caller_user_id: params.p_caller_user_id,
    p_receiver_user_id: params.p_receiver_user_id,
    p_call_mode: params.p_call_mode,
  });
  if (error) {
    console.log('[rideCall] iniciar_chamada_internet erro completo:', error);
    throw error;
  }
  console.log('[rideCall] iniciar_chamada_internet resposta bruta:', data);
  const call_id = parseCallIdFromRpc(data);
  console.log('[rideCall] call_id resolvido:', call_id);
  return { call_id, raw: data };
}

export async function encerrarChamadaInternet(pCallId: string): Promise<void> {
  const { error } = await supabase.rpc('encerrar_chamada_internet', { p_call_id: pCallId });
  if (error) throw error;
}

export async function enviarSinalWebrtc(
  pCallId: string,
  pSignalType: InternetCallSignalType,
  pPayload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc('enviar_sinal_webrtc', {
    p_call_id: pCallId,
    p_signal_type: pSignalType,
    p_payload: pPayload,
  });
  if (error) throw error;
}

export async function marcarChamadaInternetComoFalhou(pCallId: string): Promise<void> {
  const { error } = await supabase.rpc('marcar_chamada_internet_como_falhou', { p_call_id: pCallId });
  if (error) throw error;
}

export async function obterChamadaInternetAtivaDaCorrida(pRideId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('obter_chamada_internet_ativa_da_corrida', {
    p_ride_id: pRideId,
  });
  if (error) throw error;
  return data;
}

export async function obterEstadoChamadaInternetDaCorrida(pRideId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('obter_estado_chamada_internet_da_corrida', {
    p_ride_id: pRideId,
  });
  if (error) throw error;
  return data;
}
