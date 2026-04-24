/** Linhas de `driver_app_banners` — leitura na home do motorista. */
export interface DriverAppBanner {
  id: string;
  title: string | null;
  image_url: string | null;
  image_path: string | null;
  is_active: boolean;
  display_order: number;
  target_screen: string | null;
  target_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Configuração global do carrossel — `driver_app_banner_settings`. */
export interface DriverAppBannerSettings {
  id: string;
  auto_slide_enabled: boolean;
  slide_interval_seconds: number;
  created_at?: string;
  updated_at?: string;
}
