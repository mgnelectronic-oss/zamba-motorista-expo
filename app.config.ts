import 'dotenv/config';
import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Injeta a API key do Google Maps no iOS/Android em prebuild/EAS (Map SDK nativo).
 * O valor vem de `.env` → EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (nunca hardcoded).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();
  const mapsKeyFallback = (
    (config.android?.config as { googleMaps?: { apiKey?: string } } | undefined)?.googleMaps?.apiKey ?? ''
  ).trim();
  /** Evita substituir a chave do `app.json` por string vazia quando o .env não está carregado no prebuild. */
  const resolvedMapsKey = mapsKey || mapsKeyFallback;

  if (!resolvedMapsKey) {
    console.warn(
      '[app.config] Sem chave Maps: defina EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ou android.config.googleMaps.apiKey. ' +
        'Necessário para `npx expo prebuild` / EAS Build e APK release.',
    );
  }

  const iosBackgroundModes = Array.from(
    new Set([...(config.ios?.infoPlist?.UIBackgroundModes ?? []), 'audio'] as string[]),
  );

  return {
    ...config,
    name: config.name ?? 'zamba-motorista-expo',
    slug: config.slug ?? 'zamba-motorista-expo',
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        UIBackgroundModes: iosBackgroundModes,
      },
      config: {
        ...config.ios?.config,
        ...(resolvedMapsKey ? { googleMapsApiKey: resolvedMapsKey } : {}),
      },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: resolvedMapsKey || '',
        },
      },
    },
  };
};
