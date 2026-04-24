import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { driverService } from '@/services/driverService';
import type { DriverProfile, VehicleCategory } from '@/types/driver';

const STORAGE_KEY = 'zamba_driver_local_prefs_v1';

export type GpsAccuracyMode = 'high' | 'balanced';

export type LocalDriverPrefs = {
  vibrationOnRideOffer: boolean;
  backgroundLocationOptIn: boolean;
  gpsAccuracy: GpsAccuracyMode;
  maxRideDistanceKm: number;
  vehicleCategories: VehicleCategory[];
  debugPanelEnabled: boolean;
  sosQuickEnabled: boolean;
  shareTripSummary: string;
};

const defaultLocal: LocalDriverPrefs = {
  vibrationOnRideOffer: true,
  backgroundLocationOptIn: false,
  gpsAccuracy: 'high',
  maxRideDistanceKm: 15,
  vehicleCategories: ['economico', 'conforto'],
  debugPanelEnabled: false,
  sosQuickEnabled: true,
  shareTripSummary: 'standard',
};

function parseLocal(raw: string | null): LocalDriverPrefs {
  if (!raw) return { ...defaultLocal };
  try {
    const o = JSON.parse(raw) as Partial<LocalDriverPrefs>;
    return {
      ...defaultLocal,
      ...o,
      vehicleCategories: Array.isArray(o.vehicleCategories)
        ? (o.vehicleCategories as VehicleCategory[])
        : defaultLocal.vehicleCategories,
    };
  } catch {
    return { ...defaultLocal };
  }
}

export function useDriverPreferences() {
  const { userProfile, session, refreshState } = useAppAuth();
  const userId = session?.user?.id ?? null;

  const [local, setLocal] = useState<LocalDriverPrefs>(defaultLocal);
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled) setLocal(parseLocal(raw));
      } catch {
        if (!cancelled) setLocal({ ...defaultLocal });
      } finally {
        if (!cancelled) setLocalReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocalPersisted = useCallback((action: SetStateAction<LocalDriverPrefs>) => {
    setLocal((prev) => {
      const next = typeof action === 'function' ? (action as (p: LocalDriverPrefs) => LocalDriverPrefs)(prev) : action;
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const patchLocal = useCallback((partial: Partial<LocalDriverPrefs>) => {
    setLocalPersisted((prev) => ({ ...prev, ...partial }));
  }, [setLocalPersisted]);

  /** Campos oficiais em `drivers` (quando existirem). */
  const notificationsEnabled = userProfile?.notifications_enabled ?? true;
  const notificationSound = userProfile?.notification_sound ?? 'default';
  const mapType = userProfile?.map_type ?? 'normal';
  const map3d = userProfile?.map_3d ?? false;

  const setNotificationsEnabled = useCallback(
    async (value: boolean) => {
      if (!userId) return;
      await driverService.updateProfile(userId, { notifications_enabled: value });
      await refreshState(true);
    },
    [userId, refreshState],
  );

  const setNotificationSound = useCallback(
    async (sound: 'default' | 'silent') => {
      if (!userId) return;
      await driverService.updateProfile(userId, { notification_sound: sound });
      await refreshState(true);
    },
    [userId, refreshState],
  );

  const setMapType = useCallback(
    async (next: NonNullable<DriverProfile['map_type']>) => {
      if (!userId) return;
      await driverService.updateProfile(userId, { map_type: next });
      await refreshState(true);
    },
    [userId, refreshState],
  );

  const setMap3d = useCallback(
    async (value: boolean) => {
      if (!userId) return;
      await driverService.updateProfile(userId, { map_3d: value });
      await refreshState(true);
    },
    [userId, refreshState],
  );

  const rideSoundEnabled = notificationSound !== 'silent';

  const setRideSoundEnabled = useCallback(
    async (enabled: boolean) => {
      await setNotificationSound(enabled ? 'default' : 'silent');
    },
    [setNotificationSound],
  );

  return useMemo(
    () => ({
      userId,
      userProfile,
      localReady,
      local,
      patchLocal,
      notificationsEnabled,
      setNotificationsEnabled,
      notificationSound,
      setNotificationSound,
      rideSoundEnabled,
      setRideSoundEnabled,
      mapType,
      setMapType,
      map3d,
      setMap3d,
    }),
    [
      userId,
      userProfile,
      localReady,
      local,
      patchLocal,
      notificationsEnabled,
      setNotificationsEnabled,
      notificationSound,
      setNotificationSound,
      rideSoundEnabled,
      setRideSoundEnabled,
      mapType,
      setMapType,
      map3d,
      setMap3d,
    ],
  );
}
