/**
 * Notificações de corrida — reutiliza `ringtoneCatalog` (sem ficheiros duplicados).
 */
import type { RingtoneCategory, RingtoneId, RingtoneUIOption } from '@/constants/ringtoneCatalog';
import {
  RINGTONE_CATEGORY_LABELS_PT,
  RINGTONE_CATEGORY_ORDER,
  RINGTONE_SOUND_MODULES,
  RINGTONE_UI_OPTIONS,
  isRingtoneId,
  labelForRingtone,
  migrateLegacyRideSoundToRingtone,
} from '@/constants/ringtoneCatalog';

export type RideSoundId = RingtoneId;

/** UI alinhada ao catálogo global (mesmas opções que nas chamadas de internet). */
export type RideSoundOption = RingtoneUIOption;
export const RIDE_SOUND_OPTIONS: RideSoundOption[] = RINGTONE_UI_OPTIONS;

export const RIDE_SOUND_CATEGORY_ORDER = RINGTONE_CATEGORY_ORDER;
export const RIDE_SOUND_CATEGORY_LABELS_PT = RINGTONE_CATEGORY_LABELS_PT;

export const RIDE_SOUND_MODULES = RINGTONE_SOUND_MODULES;

export function labelForRideSound(id: RideSoundId): string {
  return labelForRingtone(id);
}

export function isRideSoundId(value: string): value is RideSoundId {
  return isRingtoneId(value);
}

export { migrateLegacyRideSoundToRingtone };
