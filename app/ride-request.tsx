import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { ZambaColors } from '@/constants/zambaColors';

/**
 * Destino explícito para `router.push('/ride-request')`, deep links e notificações.
 * A oferta em tempo real aparece no ecrã inicial (tabs); com corrida ativa usa-se `/driver/active`.
 */
export default function RideRequestScreen() {
  const { session, isLoadingApp } = useAppAuth();
  const params = useLocalSearchParams<{ ride_id?: string | string[] }>();

  const rideId = (() => {
    const r = params.ride_id;
    if (typeof r === 'string' && r.length > 0) return r;
    if (Array.isArray(r) && r[0]) return r[0];
    return undefined;
  })();

  if (isLoadingApp) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ZambaColors.green} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (rideId) {
    return <Redirect href={{ pathname: '/driver/active', params: { ride_id: rideId } } as never} />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ZambaColors.bg,
  },
});
