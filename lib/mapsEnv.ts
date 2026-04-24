import Constants from 'expo-constants';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

const extra = Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined;

export const GOOGLE_MAPS_API_KEY =
  (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim() || (extra?.googleMapsApiKey ?? '').trim();

export const isGoogleMapsConfigured = GOOGLE_MAPS_API_KEY.length > 0;

let envLogged = false;

/** Chamada única (ex.: no root layout) para avisos claros em __DEV__. */
export function logEnvConfigStatus(): void {
  if (envLogged || !__DEV__) return;
  envLogged = true;

  if (!SUPABASE_URL) {
    console.error('[env] EXPO_PUBLIC_SUPABASE_URL está vazia ou ausente. Defina no ficheiro .env na raiz.');
  }

  if (!SUPABASE_ANON_KEY) {
    console.error('[env] EXPO_PUBLIC_SUPABASE_ANON_KEY está vazia ou ausente. Defina no ficheiro .env na raiz.');
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn(
      '[env] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY está vazia — o mapa nativo pode não renderizar até configurar o .env e refazer prebuild.',
    );
  }
}
