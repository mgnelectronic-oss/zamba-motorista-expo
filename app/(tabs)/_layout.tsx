import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DriverTabBar } from '@/components/DriverTabBar';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useAppTheme } from '@/contexts/AppThemeContext';
import Ionicons from '@expo/vector-icons/Ionicons';

type Ion = keyof typeof Ionicons.glyphMap;

function TabBarIcon({ name, color }: { name: Ion; color: string }) {
  return <Ionicons name={name} size={26} color={color} />;
}

export default function TabLayout() {
  const { isLoadingApp, session } = useAppAuth();
  const { colors } = useAppTheme();

  if (isLoadingApp) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <DriverTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="viagens"
        options={{
          title: 'Viagens',
          tabBarIcon: ({ color }) => <TabBarIcon name="time-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="saldo"
        options={{
          title: 'Saldo',
          tabBarIcon: ({ color }) => <TabBarIcon name="wallet-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <TabBarIcon name="person-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
