import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RingtoneId } from '@/constants/ringtoneCatalog';
import {
  getWebrtcCallPreferences,
  patchWebrtcCallPreferences,
  type StoredWebrtcCallPrefs,
} from '@/services/webrtcCallPreferences';

export function useWebrtcCallPreferences() {
  const [prefs, setPrefs] = useState<StoredWebrtcCallPrefs | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await getWebrtcCallPreferences();
      if (!cancelled) {
        setPrefs(p);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const p = await getWebrtcCallPreferences();
    setPrefs(p);
    return p;
  }, []);

  const patch = useCallback(async (partial: Partial<StoredWebrtcCallPrefs>) => {
    const next = await patchWebrtcCallPreferences(partial);
    setPrefs(next);
    return next;
  }, []);

  const setEnabled = useCallback(async (webrtc_call_enabled: boolean) => {
    await patch({ webrtc_call_enabled });
  }, [patch]);

  const setSound = useCallback(async (call_sound: RingtoneId) => {
    await patch({ call_sound });
  }, [patch]);

  const setVibration = useCallback(async (webrtc_call_vibration: boolean) => {
    await patch({ webrtc_call_vibration });
  }, [patch]);

  const setVolume = useCallback(async (webrtc_call_volume: number) => {
    await patch({ webrtc_call_volume });
  }, [patch]);

  return useMemo(
    () => ({
      ready,
      prefs,
      refresh,
      patch,
      setEnabled,
      setSound,
      setVibration,
      setVolume,
    }),
    [ready, prefs, refresh, patch, setEnabled, setSound, setVibration, setVolume],
  );
}
