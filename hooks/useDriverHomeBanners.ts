import { useCallback, useEffect, useMemo, useState } from 'react';
import { driverBannerService } from '@/services/driverBannerService';
import type { DriverAppBanner } from '@/types/driverBanners';

const DEFAULT_INTERVAL = 5;

export type DriverHomeCarouselSettings = {
  auto_slide_enabled: boolean;
  slide_interval_seconds: number;
};

export function useDriverHomeBanners(enabled: boolean) {
  const [autoSlideEnabled, setAutoSlideEnabled] = useState(false);
  const [slideIntervalSec, setSlideIntervalSec] = useState(DEFAULT_INTERVAL);
  const [banners, setBanners] = useState<DriverAppBanner[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const settingsRow = await driverBannerService.fetchSettings();

      if (settingsRow) {
        setAutoSlideEnabled(!!settingsRow.auto_slide_enabled);
        const sec =
          typeof settingsRow.slide_interval_seconds === 'number' && settingsRow.slide_interval_seconds > 0
            ? settingsRow.slide_interval_seconds
            : DEFAULT_INTERVAL;
        setSlideIntervalSec(sec);
      } else {
        setAutoSlideEnabled(false);
        setSlideIntervalSec(DEFAULT_INTERVAL);
      }

      const list = await driverBannerService.fetchActiveBannersForHome();
      setBanners(list.filter((b) => b.image_url && String(b.image_url).trim() !== ''));
    } catch (e) {
      if (__DEV__) console.warn('[useDriverHomeBanners]', e);
      setAutoSlideEnabled(false);
      setSlideIntervalSec(DEFAULT_INTERVAL);
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const carouselSettings: DriverHomeCarouselSettings = useMemo(
    () => ({
      auto_slide_enabled: autoSlideEnabled,
      slide_interval_seconds: Math.max(3, slideIntervalSec),
    }),
    [autoSlideEnabled, slideIntervalSec],
  );

  return {
    carouselSettings,
    banners,
    loading,
    reload: load,
  };
}
