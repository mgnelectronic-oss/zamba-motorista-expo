import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsNavRow } from '@/components/settings/SettingsNavRow';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { SettingsSwitchRow } from '@/components/settings/SettingsSwitchRow';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import { labelForWebrtcCallSound } from '@/constants/webrtcCallSounds';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useWebrtcCallPreferences } from '@/hooks/useWebrtcCallPreferences';
import { startWebrtcRingSoundPreview, stopWebrtcRingPreview } from '@/services/webrtcCallRing';

const VOLUME_PREVIEW_DEBOUNCE_MS = 120;

export default function WebrtcCallsSettingsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  const { ready, prefs, refresh, setEnabled, setVibration, setVolume } = useWebrtcCallPreferences();
  const volumePreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enabled = prefs?.webrtc_call_enabled ?? false;
  const vol = prefs?.webrtc_call_volume ?? 90;
  const soundId = prefs?.call_sound ?? 'ring_classic';
  const vibr = prefs?.webrtc_call_vibration ?? true;

  const soundRowDisabled = !enabled;
  const volumeDisabled = soundRowDisabled;

  const scheduleVolumePreview = useCallback(
    (nextVol: number) => {
      if (volumeDisabled || nextVol <= 0) return;
      if (volumePreviewTimerRef.current != null) {
        clearTimeout(volumePreviewTimerRef.current);
      }
      volumePreviewTimerRef.current = setTimeout(() => {
        volumePreviewTimerRef.current = null;
        void startWebrtcRingSoundPreview(soundId, { volumePercent: nextVol });
      }, VOLUME_PREVIEW_DEBOUNCE_MS);
    },
    [soundId, volumeDisabled],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        if (volumePreviewTimerRef.current != null) {
          clearTimeout(volumePreviewTimerRef.current);
          volumePreviewTimerRef.current = null;
        }
        void stopWebrtcRingPreview();
      };
    }, [refresh]),
  );

  const onVolumeChange = (v: number) => {
    const rounded = Math.round(v);
    void setVolume(rounded);
    if (rounded <= 0) {
      if (volumePreviewTimerRef.current != null) {
        clearTimeout(volumePreviewTimerRef.current);
        volumePreviewTimerRef.current = null;
      }
      void stopWebrtcRingPreview();
      return;
    }
    scheduleVolumePreview(rounded);
  };

  return (
    <SettingsScreenLayout
      title="Chamadas de internet"
      subtitle="Toque e vibração ao receber chamadas de voz pela internet durante a corrida — guardado neste dispositivo."
    >
      {!ready || !prefs ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          <SettingsCard>
            <SettingsSwitchRow
              first
              icon="call-outline"
              title="Ativar chamadas de internet"
              subtitle="Permitir toque e vibração nestas chamadas"
              value={enabled}
              onValueChange={(v) => void setEnabled(v)}
            />
            <SettingsNavRow
              icon="musical-note-outline"
              title="Som de chamada"
              subtitle={soundRowDisabled ? 'Ative as chamadas de internet' : labelForWebrtcCallSound(soundId)}
              onPress={() => router.push('/settings/webrtc-call-sounds')}
              disabled={soundRowDisabled}
            />
            <SettingsSwitchRow
              icon="phone-portrait-outline"
              title="Vibração durante chamada"
              subtitle="Enquanto toca (até atender ou recusar)"
              value={vibr}
              onValueChange={(v) => void setVibration(v)}
              disabled={!enabled}
            />
            <View style={[styles.switchRow, styles.rowBorder, volumeDisabled && { opacity: 0.45 }]}>
              <View style={[styles.menuLeft, { flex: 1 }]}>
                <View style={[styles.menuIcon, { backgroundColor: colors.accentMuted }]}>
                  <Ionicons name="volume-medium-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuTitle}>Volume da chamada</Text>
                  <Text style={styles.menuSub}>
                    Ajuste em tempo real — o som seleccionado toca ao mudar o nível (0%–100%)
                  </Text>
                </View>
              </View>
              <Text style={[styles.valueText, { minWidth: 44 }]}>{vol}%</Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 18, paddingTop: 4 }}>
              <Slider
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={vol}
                onValueChange={onVolumeChange}
                disabled={volumeDisabled}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.accent}
              />
            </View>
          </SettingsCard>

          <Text style={styles.hint}>
            Quando a chamada é aceite, recusada, cancelada ou expira, o toque para de imediato. Com o ecrã fora do
            aplicativo, usa-se a notificação do sistema como reforço.
          </Text>
        </>
      )}
    </SettingsScreenLayout>
  );
}
