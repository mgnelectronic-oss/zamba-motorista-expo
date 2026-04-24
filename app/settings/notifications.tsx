import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsNavRow } from '@/components/settings/SettingsNavRow';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import { useAppTheme } from '@/contexts/AppThemeContext';

export default function NotificationsHubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);

  return (
    <SettingsScreenLayout
      title="Notificações"
      subtitle="Escolha o que configurar: ofertas de corrida ou chamadas de voz pela internet."
    >
      <Text style={styles.sectionLabel}>Tipos de alerta</Text>
      <SettingsCard>
        <SettingsNavRow
          first
          icon="navigate-outline"
          title="Corridas"
          subtitle="Novas ofertas, som, vibração e volume do alerta"
          onPress={() => router.push('/settings/notification-rides')}
        />
        <SettingsNavRow
          icon="call-outline"
          title="Chamadas de internet"
          subtitle="Toque e vibração quando recebe uma chamada de voz na corrida"
          onPress={() => router.push('/settings/webrtc-calls')}
        />
      </SettingsCard>
    </SettingsScreenLayout>
  );
}
