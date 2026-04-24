import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { ZambaColors } from '@/constants/zambaColors';

/**
 * Ponto de entrada: espelha o redirecionamento do web (`/` → login ou home)
 * após `initializeApp` em `AppContext.tsx`.
 */
export default function Index() {
  const { isLoadingApp, session } = useAppAuth();

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
