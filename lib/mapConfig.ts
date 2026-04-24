import { GOOGLE_MAPS_API_KEY, isGoogleMapsConfigured } from '@/lib/mapsEnv';

export { isGoogleMapsConfigured, GOOGLE_MAPS_API_KEY };

/** Região inicial (Maputo) — base para ecrãs com mapa. */
export const DEFAULT_MAP_REGION = {
  latitude: -25.9692,
  longitude: 32.5732,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
} as const;
