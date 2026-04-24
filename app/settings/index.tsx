import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsNavRow } from '@/components/settings/SettingsNavRow';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import { useAppTheme } from '@/contexts/AppThemeContext';

export default function SettingsIndexScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);

  return (
    <SettingsScreenLayout title="Configurações">
      <Text style={styles.sectionLabel}>Aparência</Text>
      <SettingsCard>
        <SettingsNavRow
          first
          icon="color-palette-outline"
          title="Tema"
          subtitle="Aparência do aplicativo"
          onPress={() => router.push('/settings/theme')}
        />
      </SettingsCard>

      <Text style={styles.sectionLabel}>Alertas e deslocação</Text>
      <SettingsCard>
        <SettingsNavRow
          first
          icon="notifications-outline"
          title="Notificações"
          subtitle="Corridas e chamadas de internet"
          onPress={() => router.push('/settings/notifications')}
        />
        <SettingsNavRow
          icon="location-outline"
          title="Localização"
          subtitle="GPS e permissões"
          onPress={() => router.push('/settings/location')}
        />
        <SettingsNavRow
          icon="options-outline"
          title="Operação"
          subtitle="Preferências de trabalho"
          onPress={() => router.push('/settings/operation')}
        />
      </SettingsCard>

      <Text style={styles.sectionLabel}>Conta e segurança</Text>
      <SettingsCard>
        <SettingsNavRow
          first
          icon="shield-checkmark-outline"
          title="Segurança"
          subtitle="Conta e proteção"
          onPress={() => router.push('/settings/security')}
        />
        <SettingsNavRow
          icon="shield-half-outline"
          title="Segurança em viagem"
          subtitle="Proteção durante viagens"
          onPress={() => router.push('/settings/trip-safety')}
        />
      </SettingsCard>
    </SettingsScreenLayout>
  );
}
