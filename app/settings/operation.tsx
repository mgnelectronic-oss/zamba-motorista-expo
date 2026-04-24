import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { SettingsSwitchRow } from '@/components/settings/SettingsSwitchRow';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useDriverPreferences } from '@/hooks/useDriverPreferences';
import type { VehicleCategory } from '@/types/driver';

const CAT_LABEL: Record<VehicleCategory, string> = {
  economico: 'Económico',
  conforto: 'Conforto',
  moto: 'Moto',
  txopela: 'Txopela',
};

const ALL_CATS: VehicleCategory[] = ['economico', 'conforto', 'moto', 'txopela'];

export default function SettingsOperationScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  const { userId, localReady, local, patchLocal, mapType, setMapType, map3d, setMap3d } = useDriverPreferences();

  const toggleCategory = useCallback(
    (cat: VehicleCategory) => {
      const set = new Set(local.vehicleCategories);
      if (set.has(cat)) {
        if (set.size <= 1) {
          Alert.alert('Categorias', 'Selecione pelo menos uma categoria.');
          return;
        }
        set.delete(cat);
      } else {
        set.add(cat);
      }
      void patchLocal({ vehicleCategories: Array.from(set) as VehicleCategory[] });
    },
    [local.vehicleCategories, patchLocal],
  );

  const pickDistance = useCallback(() => {
    const options = [5, 10, 15, 20, 30, 50];
    Alert.alert(
      'Distância máxima',
      'Raio aproximado para receber pedidos de corrida (preferência local).',
      [
        ...options.map((km) => ({
          text: `${km} km`,
          onPress: () => void patchLocal({ maxRideDistanceKm: km }),
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
    );
  }, [patchLocal]);

  const dbDisabled = !userId;

  return (
    <SettingsScreenLayout
      title="Operação"
      subtitle="Preferências de trabalho. Tipo de mapa e modo 3D sincronizam com a sua conta."
    >
      {!localReady ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          <SettingsCard>
            <Text style={[styles.menuSub, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }]}>
              Tipo de mapa
            </Text>
            <Pressable
              onPress={() => void setMapType('normal')}
              style={({ pressed }) => [
                styles.row,
                styles.rowBorder,
                { paddingVertical: 14 },
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.menuTitle}>Normal</Text>
              <Text style={{ color: mapType === 'normal' ? colors.accent : colors.textMuted, fontWeight: '700' }}>
                {mapType === 'normal' ? '✓' : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void setMapType('satellite')}
              style={({ pressed }) => [
                styles.row,
                { paddingVertical: 14 },
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.menuTitle}>Satélite</Text>
              <Text style={{ color: mapType === 'satellite' ? colors.accent : colors.textMuted, fontWeight: '700' }}>
                {mapType === 'satellite' ? '✓' : ''}
              </Text>
            </Pressable>
          </SettingsCard>

          <SettingsCard>
            <SettingsSwitchRow
              first
              icon="cube-outline"
              title="Modo 3D"
              subtitle="Inclinação e perspetiva no mapa (quando suportado)"
              value={map3d}
              onValueChange={(v) => void setMap3d(v)}
              disabled={dbDisabled}
            />
          </SettingsCard>

          <SettingsCard>
            <Pressable
              onPress={pickDistance}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.accentMuted }]}>
                  <Text style={{ color: colors.accent, fontWeight: '900' }}>km</Text>
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuTitle}>Distância máxima para receber corridas</Text>
                  <Text style={styles.menuSub}>Preferência local neste dispositivo</Text>
                </View>
              </View>
              <Text style={styles.valueText}>{local.maxRideDistanceKm} km</Text>
            </Pressable>
          </SettingsCard>

          <SettingsCard>
            <Text style={[styles.menuSub, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }]}>
              Categorias ativas do veículo
            </Text>
            {ALL_CATS.map((cat) => (
              <SettingsSwitchRow
                key={cat}
                first={false}
                title={CAT_LABEL[cat]}
                subtitle="Receber pedidos compatíveis"
                value={local.vehicleCategories.includes(cat)}
                onValueChange={() => toggleCategory(cat)}
              />
            ))}
          </SettingsCard>

          {dbDisabled ? (
            <Text style={[styles.hint, { marginTop: 12 }]}>Inicie sessão para sincronizar mapa com a conta.</Text>
          ) : null}
        </>
      )}
    </SettingsScreenLayout>
  );
}
