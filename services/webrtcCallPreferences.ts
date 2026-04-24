import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RingtoneId } from '@/constants/ringtoneCatalog';

import { isRingtoneId } from '@/constants/ringtoneCatalog';

import { migrateLegacyWebrtcCallSoundId } from '@/constants/webrtcCallSounds';



const STORAGE_KEY = 'zamba_webrtc_call_prefs_v1';



export type StoredWebrtcCallPrefs = {

  webrtc_call_enabled: boolean;

  /** Tom para chamada recebida — mesmo catálogo físico que notificações de corrida. */

  call_sound: RingtoneId;

  webrtc_call_vibration: boolean;

  /** 0–100 — apenas reprodução interna. */

  webrtc_call_volume: number;

};



const DEFAULTS: StoredWebrtcCallPrefs = {

  webrtc_call_enabled: true,

  call_sound: 'ring_classic',

  webrtc_call_vibration: true,

  webrtc_call_volume: 90,

};



function clampVol(n: number): number {

  if (Number.isNaN(n)) return DEFAULTS.webrtc_call_volume;

  return Math.max(0, Math.min(100, Math.round(n)));

}



function parseCallSound(o: Partial<StoredWebrtcCallPrefs> & { webrtc_call_sound?: string }): RingtoneId {

  const raw =

    typeof o.call_sound === 'string'

      ? o.call_sound

      : typeof o.webrtc_call_sound === 'string'

        ? o.webrtc_call_sound

        : null;

  if (!raw) return DEFAULTS.call_sound;

  if (isRingtoneId(raw)) return raw;

  const migrated = migrateLegacyWebrtcCallSoundId(raw);

  if (migrated) return migrated;

  return DEFAULTS.call_sound;

}



function parse(raw: string | null): StoredWebrtcCallPrefs {

  if (!raw) return { ...DEFAULTS };

  try {

    const o = JSON.parse(raw) as Partial<StoredWebrtcCallPrefs> & { webrtc_call_sound?: string };

    return {

      webrtc_call_enabled: typeof o.webrtc_call_enabled === 'boolean' ? o.webrtc_call_enabled : DEFAULTS.webrtc_call_enabled,

      call_sound: parseCallSound(o),

      webrtc_call_vibration:

        typeof o.webrtc_call_vibration === 'boolean' ? o.webrtc_call_vibration : DEFAULTS.webrtc_call_vibration,

      webrtc_call_volume: clampVol(typeof o.webrtc_call_volume === 'number' ? o.webrtc_call_volume : DEFAULTS.webrtc_call_volume),

    };

  } catch {

    return { ...DEFAULTS };

  }

}



export async function getWebrtcCallPreferences(): Promise<StoredWebrtcCallPrefs> {

  try {

    return parse(await AsyncStorage.getItem(STORAGE_KEY));

  } catch {

    return { ...DEFAULTS };

  }

}



export async function setWebrtcCallPreferences(next: StoredWebrtcCallPrefs): Promise<void> {

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, webrtc_call_volume: clampVol(next.webrtc_call_volume) }));

}



export async function patchWebrtcCallPreferences(partial: Partial<StoredWebrtcCallPrefs>): Promise<StoredWebrtcCallPrefs> {

  const cur = await getWebrtcCallPreferences();

  const merged: StoredWebrtcCallPrefs = {

    ...cur,

    ...partial,

    ...(partial.webrtc_call_volume !== undefined ? { webrtc_call_volume: clampVol(partial.webrtc_call_volume) } : {}),

  };

  await setWebrtcCallPreferences(merged);

  return merged;

}

