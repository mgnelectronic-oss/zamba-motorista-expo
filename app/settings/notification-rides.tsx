import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsNavRow } from '@/components/settings/SettingsNavRow';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { SettingsSwitchRow } from '@/components/settings/SettingsSwitchRow';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import { labelForRideSound } from '@/constants/rideSounds';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useRideAlertPreferences } from '@/hooks/useRideAlertPreferences';
import { stopRideAlert } from '@/services/rideAlert';
import {
  isPreviewActive,
  playPreview,
  setPreviewVolume,
  stopPreview,
} from '@/services/rideAlertPreviewController';
import { stopRingtonePreview } from '@/services/ringtonePreviewAudio';

const PERSIST_DEBOUNCE_MS = 120;
const PREVIEW_START_DEBOUNCE_MS = 80;

export default function NotificationRidesSettingsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  const {
    ready,
    prefs,
    refresh,
    setNotificationsEnabled,
    setSoundEnabled,
    setVibrationEnabled,
    setAlertVolume,
  } = useRideAlertPreferences();

  const n = prefs?.notifications_enabled ?? false;
  const soundOn = prefs?.sound_enabled ?? false;
  const vibrationOn = prefs?.vibration_enabled ?? false;
  const volume = prefs?.alert_volume ?? 85;
  const soundId = prefs?.notification_sound ?? 'flow';

  const [localVol, setLocalVol] = useState(volume);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ready) setLocalVol(volume);
  }, [ready, volume]);

  const soundRowDisabled = !n || !soundOn;
  const volumeDisabled = soundRowDisabled;

  const schedulePersist = useCallback(
    (r: number) => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        void setAlertVolume(r);
      }, PERSIST_DEBOUNCE_MS);
    },
    [setAlertVolume],
  );

  const onVolumeChange = useCallback(
    (v: number) => {
      const r = Math.round(v);
      setLocalVol(r);
      schedulePersist(r);

      if (volumeDisabled || !soundOn) {
        if (previewStartTimerRef.current) clearTimeout(previewStartTimerRef.current);
        void stopPreview();
        return;
      }

      if (r <= 0) {
        if (previewStartTimerRef.current) clearTimeout(previewStartTimerRef.current);
        void stopPreview();
        return;
      }

      if (isPreviewActive()) {
        void setPreviewVolume(r);
      }

      if (previewStartTimerRef.current) clearTimeout(previewStartTimerRef.current);
      previewStartTimerRef.current = setTimeout(() => {
        if (!isPreviewActive()) {
          void stopRideAlert();
          void playPreview(soundId, r, { playUntilEnd: true });
        }
      }, PREVIEW_START_DEBOUNCE_MS);
    },
    [volumeDisabled, soundOn, soundId, schedulePersist],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        if (previewStartTimerRef.current) clearTimeout(previewStartTimerRef.current);
        void stopRingtonePreview();
      };
    }, [refresh]),
  );

  return (
    <SettingsScreenLayout
      title="Corridas"
      subtitle="Alertas de novas ofertas quando o app está aberto — guardado neste dispositivo."
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
              icon="notifications-outline"
              title="Ativar notificações"
              subtitle="Alertas de novas corridas e notificações locais"
              value={n}
              onValueChange={(v) => void setNotificationsEnabled(v)}
            />
            <SettingsSwitchRow
              icon="volume-high-outline"
              title="Som de novas corridas"
              subtitle="Áudio no app quando chega uma oferta (primeiro plano)"
              value={soundOn}
              onValueChange={(v) => void setSoundEnabled(v)}
              disabled={!n}
            />
            <SettingsSwitchRow
              icon="phone-portrait-outline"
              title="Vibração ao receber corrida"
              subtitle="Feedback háptico com nova oferta"
              value={vibrationOn}
              onValueChange={(v) => void setVibrationEnabled(v)}
              disabled={!n}
            />
          </SettingsCard>

          <Text style={styles.sectionLabel}>Personalização</Text>

          <SettingsCard>
            <SettingsNavRow
              first
              icon="musical-note-outline"
              title="Som da notificação"
              subtitle={soundRowDisabled ? 'Ative som de novas corridas' : labelForRideSound(soundId)}
              onPress={() => router.push('/settings/ride-alert-sounds')}
              disabled={soundRowDisabled}
            />
            <View style={[styles.switchRow, styles.rowBorder, volumeDisabled && { opacity: 0.45 }]}>
              <View style={[styles.menuLeft, { flex: 1 }]}>
                <View style={[styles.menuIcon, { backgroundColor: colors.accentMuted }]}>
                  <Ionicons name="volume-medium-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuTitle}>Volume do alerta</Text>
                  <Text style={styles.menuSub}>
                    Ajuste em tempo real (0%–100%) — os sons partilham a biblioteca com as chamadas de internet
                  </Text>
                </View>
              </View>
              <Text style={[styles.valueText, { minWidth: 44 }]}>{localVol}%</Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 18, paddingTop: 4 }}>
              <Slider
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={localVol}
                onValueChange={onVolumeChange}
                disabled={volumeDisabled}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.accent}
              />
            </View>
          </SettingsCard>

          <Text style={styles.hint}>
            Com o ecrã desligado ou app em segundo plano, usa-se a notificação do sistema (som e vibração
            padrão do telefone) — os tons personalizados aplicam-se quando o app está aberto. Pré-visualização
            na lista de sons (tocar num item).
          </Text>
        </>
      )}
    </SettingsScreenLayout>
  );
}
