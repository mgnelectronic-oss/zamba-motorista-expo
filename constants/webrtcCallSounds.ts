/**
 * Tons de chamada (voz pela internet) — mesmo catálogo físico que `ringtoneCatalog` (sem assets duplicados).
 */
import type { RingtoneCategory, RingtoneId, RingtoneUIOption } from '@/constants/ringtoneCatalog';
import {
  LEGACY_RIDE_SOUND_TO_RINGTONE,
  RINGTONE_CATEGORY_LABELS_PT,
  RINGTONE_CATEGORY_ORDER,
  RINGTONE_IDS,
  RINGTONE_SOUND_MODULES,
  RINGTONE_UI_OPTIONS,
  isRingtoneId,
  labelForRingtone,
} from '@/constants/ringtoneCatalog';

export { RINGTONE_IDS as WEBRTC_CALL_SOUND_IDS };
export type WebrtcCallSoundId = RingtoneId;

/** @deprecated naming — usar `RingtoneCategory` */
export type WebrtcCallRingtoneCategory = RingtoneCategory;
export const WEBRTC_CALL_SOUND_CATEGORY_ORDER = RINGTONE_CATEGORY_ORDER;
export const WEBRTC_CALL_SOUND_CATEGORY_LABELS_PT = RINGTONE_CATEGORY_LABELS_PT;

export type WebrtcCallSoundOption = RingtoneUIOption;
export const WEBRTC_CALL_SOUND_OPTIONS: WebrtcCallSoundOption[] = RINGTONE_UI_OPTIONS;

export const WEBRTC_CALL_SOUND_MODULES = RINGTONE_SOUND_MODULES;

export const labelForWebrtcCallSound = labelForRingtone;

export const isWebrtcCallSoundId = isRingtoneId;

export type LegacyWebrtcCallSoundId =
  | 'system'
  | 'classico'
  | 'digital_loop'
  | 'pulsante'
  | 'urgente'
  | 'suave_loop'
  | 'premium_loop';

/** Legado (antes dos IDs alinhados ao catálogo). */
export const LEGACY_WEBRTC_CALL_SOUND_TO_NEW: Record<LegacyWebrtcCallSoundId, WebrtcCallSoundId> = {
  system: 'modern_default',
  classico: 'ring_classic',
  digital_loop: 'digital_soft',
  pulsante: 'pulse_tone',
  urgente: 'urgent_elegant',
  suave_loop: 'reflection',
  premium_loop: 'premium_tone',
};

export function migrateLegacyWebrtcCallSoundId(value: string): WebrtcCallSoundId | null {
  if (isRingtoneId(value)) return value;
  const m = LEGACY_WEBRTC_CALL_SOUND_TO_NEW as Record<string, WebrtcCallSoundId>;
  const direct = m[value];
  if (direct) return direct;
  /** IDs de som de corrida antigo gravado por engano nas prefs de chamadas */
  const ride = LEGACY_RIDE_SOUND_TO_RINGTONE as Record<string, WebrtcCallSoundId>;
  return ride[value] ?? null;
}
