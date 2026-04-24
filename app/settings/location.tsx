import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { SettingsSwitchRow } from '@/components/settings/SettingsSwitchRow';
import { SettingsNavRow } from '@/components/settings/SettingsNavRow';
import { SettingsValueRow } from '@/components/settings/SettingsValueRow';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useDriverPreferences } from '@/hooks/useDriverPreferences';

function permissionLabel(status: Location.PermissionStatus | null): string {
  if (!status) return 'A verificar…';
  switch (status) {
    case Location.PermissionStatus.GRANTED:
      return 'Concedida';
    case Location.PermissionStatus.DENIED:
      return 'Negada';
    case Location.PermissionStatus.UNDETERMINED:
      return 'Não pedida';
    default:
      return String(status);
  }
}

export default function SettingsLocationScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  const { localReady, local, patchLocal } = useDriverPreferences();

  const [fg, setFg] = useState<Location.PermissionStatus | null>(null);
  const [bg, setBg] = useState<Location.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const f = await Location.getForegroundPermissionsAsync();
      setFg(f.status);
      try {
        const b = await Location.getBackgroundPermissionsAsync();
        setBg(b.status);
      } catch {
        setBg(null);
      }
    } catch {
      setFg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const testLocation = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== Location.PermissionStatus.GRANTED) {
          Alert.alert('Permissão', 'É necessário permitir localização para testar.');
          void refresh();
          return;
        }
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: local.gpsAccuracy === 'high' ? Location.Accuracy.Highest : Location.Accuracy.Balanced,
      });
      Alert.alert(
        'Localização',
        `Lat: ${pos.coords.latitude.toFixed(5)}\nLng: ${pos.coords.longitude.toFixed(5)}\nPrecisão: ${
          pos.coords.accuracy != null ? `${Math.round(pos.coords.accuracy)} m` : '—'
        }`,
      );
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível obter a localização.');
    }
  }, [local.gpsAccuracy, refresh]);

  const cycleAccuracy = useCallback(() => {
    void patchLocal({
      gpsAccuracy: local.gpsAccuracy === 'high' ? 'balanced' : 'high',
    });
  }, [local.gpsAccuracy, patchLocal]);

  return (
    <SettingsScreenLayout
      title="Localização"
      subtitle="GPS e permissões. A preferência de segundo plano fica neste dispositivo até existir suporte completo no servidor."
    >
      {loading || !localReady ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
      ) : (
        <>
          <SettingsCard>
            <SettingsValueRow
              first
              icon="navigate-outline"
              title="Estado da permissão"
              subtitle="Acesso à localização em uso"
              value={permissionLabel(fg)}
            />
            {bg != null ? (
              <SettingsValueRow
                icon="layers-outline"
                title="Localização em segundo plano"
                subtitle="Estado no sistema"
                value={permissionLabel(bg)}
              />
            ) : null}
            <SettingsNavRow
              icon="analytics-outline"
              title="Precisão do GPS"
              subtitle={local.gpsAccuracy === 'high' ? 'Alta — máximo detalhe' : 'Equilibrada — melhor bateria'}
              onPress={cycleAccuracy}
            />
          </SettingsCard>

          <SettingsCard>
            <SettingsSwitchRow
              first
              icon="sync-outline"
              title="Atualização em segundo plano"
              subtitle="Preferência local — requer permissão nas definições do SO"
              value={local.backgroundLocationOptIn}
              onValueChange={(v) => void patchLocal({ backgroundLocationOptIn: v })}
            />
          </SettingsCard>

          <SettingsCard>
            <Pressable
              onPress={() => void testLocation()}
              style={({ pressed }) => [styles.primaryBtn, { marginTop: 0, marginBottom: 0 }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.primaryBtnText}>Testar localização</Text>
            </Pressable>
          </SettingsCard>
        </>
      )}
    </SettingsScreenLayout>
  );
}
