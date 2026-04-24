/**
 * Estados oficiais em `ride_calls` (Supabase) para chamadas de voz por internet.
 * Manter alinhado com o backend.
 */
export type RideInternetCallStatus =
  | 'initiated'
  | 'ringing'
  | 'accepted'
  | 'rejected'
  | 'ended'
  | 'failed'
  | 'missed'
  | 'cancelled';

export type InternetCallSignalType = 'offer' | 'answer' | 'ice_candidate';

/** Fases só para UI no ecrã da corrida (motorista). */
export type DriverInternetCallUiPhase =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'in_call'
  | 'ended'
  | 'failed'
  | 'missed'
  | 'cancelled'
  | 'rejected_remote';

export type DriverInternetCallUi = {
  phase: DriverInternetCallUiPhase;
  /** Texto curto para a faixa de estado (sem mencionar outras apps). */
  label: string;
  errorMessage?: string;
};
