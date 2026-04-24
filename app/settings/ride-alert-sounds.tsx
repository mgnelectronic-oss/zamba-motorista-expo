import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SoundSelectionStickySave } from '@/components/settings/SoundSelectionStickySave';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import {
  RIDE_SOUND_CATEGORY_LABELS_PT,
  RIDE_SOUND_CATEGORY_ORDER,
  RIDE_SOUND_OPTIONS,
  type RideSoundId,
} from '@/constants/rideSounds';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useRideAlertPreferences } from '@/hooks/useRideAlertPreferences';
import { stopRideAlert } from '@/services/rideAlert';
import { playPreview } from '@/services/rideAlertPreviewController';
import { stopRingtonePreview } from '@/services/ringtonePreviewAudio';

const SCROLL_EXTRA_WHEN_SAVE_VISIBLE = 104;

export default function RideAlertSoundsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  const { ready, prefs, refresh, setNotificationSound } = useRideAlertPreferences();

  /** Valor oficial (persistido) — única fonte após refresh. */
  const savedSound = prefs?.notification_sound;
  const volumePercent = prefs?.alert_volume ?? 85;

  /** Seleção temporária na UI até Salvar. */
  const [selectedSound, setSelectedSound] = useState<RideSoundId | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready && savedSound !== undefined) {
      setSelectedSound(savedSound);
    }
  }, [ready, savedSound]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        void stopRingtonePreview();
      };
    }, [refresh]),
  );

  const onPick = (id: RideSoundId) => {
    setSelectedSound(id);
    void (async () => {
      await stopRideAlert();
      await playPreview(id, volumePercent, { playUntilEnd: true });
    })();
  };

  const hasChanges =
    ready &&
    savedSound !== undefined &&
    selectedSound !== null &&
    selectedSound !== savedSound;

  const onSave = async () => {
    if (!hasChanges || selectedSound === null || saving) return;
    setSaving(true);
    try {
      await setNotificationSound(selectedSound);
      await stopRideAlert();
      await stopRingtonePreview();
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const sectionOptions = useMemo(() => {
    return RIDE_SOUND_CATEGORY_ORDER.map((category) => ({
      category,
      label: RIDE_SOUND_CATEGORY_LABELS_PT[category],
      items: RIDE_SOUND_OPTIONS.filter((o) => o.category === category),
    })).filter((s) => s.items.length > 0);
  }, []);

  const displayId = selectedSound ?? savedSound;

  return (
    <SettingsScreenLayout
      title="Som da notificação"
      subtitle="Toque num tom para ouvir a pré-visualização. O tom em uso só muda ao tocar em Salvar (a biblioteca é partilhada com as chamadas de internet)."
      scrollExtraBottom={hasChanges ? SCROLL_EXTRA_WHEN_SAVE_VISIBLE : 0}
      footerOverlay={
        <SoundSelectionStickySave visible={hasChanges} onSave={onSave} saving={saving} colors={colors} />
      }
    >
      {!ready || !prefs || selectedSound === null ? (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          <SettingsCard>
            {sectionOptions.map((section, sectionIndex) => (
              <View key={section.category}>
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      paddingHorizontal: 16,
                      marginTop: sectionIndex === 0 ? 4 : 18,
                      marginBottom: 2,
                    },
                  ]}
                >
                  {section.label}
                </Text>
                {section.items.map((opt, index) => {
                  const isSelected = displayId === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => onPick(opt.id)}
                      style={({ pressed }) => [
                        styles.switchRow,
                        index > 0 && styles.rowBorder,
                        { paddingVertical: 16 },
                        pressed && { opacity: 0.92 },
                      ]}
                    >
                      <View style={[styles.menuLeft, { flex: 1 }]}>
                        <View style={[styles.menuIcon, { backgroundColor: colors.accentMuted }]}>
                          <Ionicons name="musical-notes-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={styles.menuTextCol}>
                          <Text style={styles.menuTitle}>{opt.labelPt}</Text>
                          <Text style={[styles.menuSub, { marginTop: 4 }]}>{opt.descriptionPt}</Text>
                        </View>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </SettingsCard>
        </>
      )}
    </SettingsScreenLayout>
  );
}
