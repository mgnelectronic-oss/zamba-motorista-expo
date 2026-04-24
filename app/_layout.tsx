import 'react-native-gesture-handler';
import { useEffect, useMemo } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AppAuthProvider } from '@/contexts/AppAuthContext';
import { AppThemeProvider, useAppTheme } from '@/contexts/AppThemeContext';
import { logEnvConfigStatus } from '@/lib/mapsEnv';
import { ensureRideOfferNotificationsReady } from '@/services/rideOfferNotifications';

export const unstable_settings = {
  initialRouteName: 'index',
};

function RootStackWithTheme() {
  const { colors, resolved } = useAppTheme();

  const navigationTheme = useMemo(() => {
    const base = resolved === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.accent,
      },
    };
  }, [colors, resolved]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="ride-request" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="activation" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="support" options={{ headerShown: false }} />
        <Stack.Screen name="theme-settings" options={{ headerShown: false }} />
        <Stack.Screen name="driver" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    logEnvConfigStatus();
    void ensureRideOfferNotificationsReady();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppAuthProvider>
          <AppThemeProvider>
            <RootStackWithTheme />
          </AppThemeProvider>
        </AppAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
