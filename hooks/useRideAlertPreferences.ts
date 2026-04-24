import { useCallback, useEffect, useMemo, useState } from 'react';

import type { RingtoneId } from '@/constants/ringtoneCatalog';

import {

  getRideAlertPreferences,

  patchRideAlertPreferences,

  type StoredRideAlertPrefs,

} from '@/services/rideAlertPreferences';



export function useRideAlertPreferences() {

  const [prefs, setPrefs] = useState<StoredRideAlertPrefs | null>(null);

  const [ready, setReady] = useState(false);



  useEffect(() => {

    let cancelled = false;

    void (async () => {

      const p = await getRideAlertPreferences();

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

    const p = await getRideAlertPreferences();

    setPrefs(p);

    return p;

  }, []);



  const patch = useCallback(async (partial: Partial<StoredRideAlertPrefs>) => {

    const next = await patchRideAlertPreferences(partial);

    setPrefs(next);

    return next;

  }, []);



  const setNotificationsEnabled = useCallback(async (notifications_enabled: boolean) => {

    await patch({ notifications_enabled });

  }, [patch]);



  const setSoundEnabled = useCallback(async (sound_enabled: boolean) => {

    await patch({ sound_enabled });

  }, [patch]);



  const setVibrationEnabled = useCallback(async (vibration_enabled: boolean) => {

    await patch({ vibration_enabled });

  }, [patch]);



  const setNotificationSound = useCallback(async (notification_sound: RingtoneId) => {

    await patch({ notification_sound });

  }, [patch]);



  /** @deprecated usar `setNotificationSound` */

  const setSelectedSound = setNotificationSound;



  const setAlertVolume = useCallback(async (alert_volume: number) => {

    await patch({ alert_volume });

  }, [patch]);



  return useMemo(

    () => ({

      ready,

      prefs,

      refresh,

      patch,

      setNotificationsEnabled,

      setSoundEnabled,

      setVibrationEnabled,

      setNotificationSound,

      setSelectedSound,

      setAlertVolume,

    }),

    [

      ready,

      prefs,

      refresh,

      patch,

      setNotificationsEnabled,

      setSoundEnabled,

      setVibrationEnabled,

      setNotificationSound,

      setSelectedSound,

      setAlertVolume,

    ],

  );

}

