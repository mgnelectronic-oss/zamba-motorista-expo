import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { DEFAULT_MAP_REGION, isGoogleMapsConfigured } from '@/lib/mapConfig';

/**
 * Pré-visualização mínima do mapa no ecrã inicial (só iOS/Android com chave configurada).
 * Web: placeholder — react-native-maps não é usado da mesma forma.
 */
export function HomeMapPreview() {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Mapa: use a app iOS/Android para o mapa nativo.</Text>
      </View>
    );
  }

  if (!isGoogleMapsConfigured) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Mapa (preview)</Text>
        <Text style={styles.fallbackText}>
          Configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY no .env e reinicie o bundler (npx expo start -c).
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_MAP_REGION}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        mapType="standard"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 400,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    backgroundColor: '#E5E7EB',
  },
  map: { ...StyleSheet.absoluteFillObject },
  fallback: {
    width: '100%',
    maxWidth: 400,
    minHeight: 100,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
  },
  fallbackTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  fallbackText: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
});
