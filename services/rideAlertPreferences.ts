import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RingtoneId } from '@/constants/ringtoneCatalog';

import { isRingtoneId, migrateLegacyRideSoundToRingtone } from '@/constants/ringtoneCatalog';



const STORAGE_KEY = 'zamba_ride_alert_prefs_v1';



export type StoredRideAlertPrefs = {

  notifications_enabled: boolean;

  sound_enabled: boolean;

  vibration_enabled: boolean;

  /** Tom para alertas de corrida (catálogo `ringtones/`). */

  notification_sound: RingtoneId;

  /** 0–100 — aplicado apenas a reprodução interna (foreground). */

  alert_volume: number;

};



const DEFAULTS: StoredRideAlertPrefs = {

  notifications_enabled: true,

  sound_enabled: true,

  vibration_enabled: true,

  notification_sound: 'flow',

  alert_volume: 85,

};



function clampVolume(n: number): number {

  if (Number.isNaN(n)) return DEFAULTS.alert_volume;

  return Math.max(0, Math.min(100, Math.round(n)));

}



function parseNotificationSound(o: Partial<StoredRideAlertPrefs> & { selected_sound?: string }): RingtoneId {

  const raw =

    typeof o.notification_sound === 'string'

      ? o.notification_sound

      : typeof o.selected_sound === 'string'

        ? o.selected_sound

        : null;

  if (!raw) return DEFAULTS.notification_sound;

  if (isRingtoneId(raw)) return raw;

  const migrated = migrateLegacyRideSoundToRingtone(raw);

  if (migrated) return migrated;

  return DEFAULTS.notification_sound;

}



function parse(raw: string | null): StoredRideAlertPrefs {

  if (!raw) return { ...DEFAULTS };

  try {

    const o = JSON.parse(raw) as Partial<StoredRideAlertPrefs> & { selected_sound?: string };

    return {

      notifications_enabled:

        typeof o.notifications_enabled === 'boolean' ? o.notifications_enabled : DEFAULTS.notifications_enabled,

      sound_enabled: typeof o.sound_enabled === 'boolean' ? o.sound_enabled : DEFAULTS.sound_enabled,

      vibration_enabled: typeof o.vibration_enabled === 'boolean' ? o.vibration_enabled : DEFAULTS.vibration_enabled,

      notification_sound: parseNotificationSound(o),

      alert_volume: clampVolume(typeof o.alert_volume === 'number' ? o.alert_volume : DEFAULTS.alert_volume),

    };

  } catch {

    return { ...DEFAULTS };

  }

}



export async function getRideAlertPreferences(): Promise<StoredRideAlertPrefs> {

  try {

    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    return parse(raw);

  } catch {

    return { ...DEFAULTS };

  }

}



export async function setRideAlertPreferences(next: StoredRideAlertPrefs): Promise<void> {

  const normalized: StoredRideAlertPrefs = {

    ...next,

    alert_volume: clampVolume(next.alert_volume),

  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

}



export async function patchRideAlertPreferences(partial: Partial<StoredRideAlertPrefs>): Promise<StoredRideAlertPrefs> {

  const cur = await getRideAlertPreferences();

  const merged: StoredRideAlertPrefs = {

    ...cur,

    ...partial,

    ...(partial.alert_volume !== undefined ? { alert_volume: clampVolume(partial.alert_volume) } : {}),

  };

  await setRideAlertPreferences(merged);

  return merged;

}



export { DEFAULTS as DEFAULT_RIDE_ALERT_PREFS };

