import React, { useMemo } from 'react';
import { Alert, Text } from 'react-native';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsNavRow } from '@/components/settings/SettingsNavRow';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import { useAppTheme } from '@/contexts/AppThemeContext';

export default function SettingsTripSafetyScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);

  const soon = (title: string) =>
    Alert.alert(title, 'Disponível numa próxima versão, com partilha e contactos ligados ao servidor.', [
      { text: 'OK' },
    ]);

  return (
    <SettingsScreenLayout
      title="Segurança em viagem"
      subtitle="Proteção durante viagens. Preferências locais e futuras integrações de partilha em tempo real."
    >
      <SettingsCard>
        <SettingsNavRow
          first
          icon="people-outline"
          title="Contatos de emergência"
          subtitle="Quem contactar em situação crítica"
          onPress={() => soon('Contatos de emergência')}
        />
        <SettingsNavRow
          icon="warning-outline"
          title="SOS rápido"
          subtitle="Atalho para pedido de ajuda"
          onPress={() => soon('SOS rápido')}
        />
        <SettingsNavRow
          icon="share-social-outline"
          title="Preferências de partilha de viagem"
          subtitle="Quem pode seguir a sua rota"
          onPress={() => soon('Partilha de viagem')}
        />
      </SettingsCard>
      <Text style={[styles.hint, { marginTop: 14 }]}>
        Estes fluxos serão ligados a tabelas e políticas no Supabase quando estiverem definidos no projeto.
      </Text>
    </SettingsScreenLayout>
  );
}
