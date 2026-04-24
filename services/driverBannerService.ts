import { supabase } from '@/lib/supabase';
import type { DriverAppBanner, DriverAppBannerSettings } from '@/types/driverBanners';

function nowMs(): number {
  return Date.now();
}

/** Incluir se starts_at é null ou já passou. */
function hasStarted(startsAt: string | null): boolean {
  if (startsAt == null || startsAt === '') return true;
  const t = new Date(startsAt).getTime();
  return !Number.isNaN(t) && t <= nowMs();
}

/** Incluir se ends_at é null ou ainda não passou. */
function hasNotEnded(endsAt: string | null): boolean {
  if (endsAt == null || endsAt === '') return true;
  const t = new Date(endsAt).getTime();
  return !Number.isNaN(t) && t >= nowMs();
}

export const driverBannerService = {
  async fetchSettings(): Promise<DriverAppBannerSettings | null> {
    const { data, error } = await supabase
      .from('driver_app_banner_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as DriverAppBannerSettings | null;
  },

  /**
   * Banners ativos, ordenados por `display_order` asc; filtrados por janela temporal no cliente.
   */
  async fetchActiveBannersForHome(): Promise<DriverAppBanner[]> {
    const { data, error } = await supabase
      .from('driver_app_banners')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    const rows = (data ?? []) as DriverAppBanner[];

    return rows.filter((b) => hasStarted(b.starts_at) && hasNotEnded(b.ends_at));
  },
};
