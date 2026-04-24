import React from 'react';
import { Alert } from 'react-native';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsNavRow } from '@/components/settings/SettingsNavRow';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';

export default function SettingsSecurityScreen() {
  const soon = (title: string) =>
    Alert.alert(title, 'Esta funcionalidade será ligada à sua conta em breve.', [{ text: 'OK' }]);

  return (
    <SettingsScreenLayout title="Segurança">
      <SettingsCard>
        <SettingsNavRow
          first
          icon="key-outline"
          title="Alterar palavra-passe"
          subtitle="Atualizar credenciais de acesso"
          onPress={() => soon('Alterar palavra-passe')}
        />
        <SettingsNavRow
          icon="call-outline"
          title="Verificar número de telefone"
          subtitle="Confirmar o seu contacto"
          onPress={() => soon('Verificar telefone')}
        />
        <SettingsNavRow
          icon="desktop-outline"
          title="Sessões ativas"
          subtitle="Dispositivos com acesso à conta"
          onPress={() => soon('Sessões ativas')}
        />
      </SettingsCard>
    </SettingsScreenLayout>
  );
}
