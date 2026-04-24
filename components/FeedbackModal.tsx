import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { useAppTheme } from '@/contexts/AppThemeContext';

export type FeedbackModalVariant = 'success' | 'error' | 'info';

export type FeedbackModalProps = {
  visible: boolean;
  variant: FeedbackModalVariant;
  title: string;
  message?: string;
  /** Etiqueta do botão principal (predefinição: OK). */
  confirmLabel?: string;
  onClose: () => void;
  /** Se true, tocar no fundo escurecido também chama `onClose`. */
  dismissOnBackdropPress?: boolean;
};

export function FeedbackModal({
  visible,
  variant,
  title,
  message,
  confirmLabel = 'OK',
  onClose,
  dismissOnBackdropPress = false,
}: FeedbackModalProps) {
  const { colors } = useAppTheme();

  const icon = useMemo(() => {
    switch (variant) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: colors.success, bg: colors.successBg };
      case 'error':
        return { name: 'alert-circle' as const, color: colors.danger, bg: colors.dangerMuted };
      default:
        return { name: 'information-circle' as const, color: colors.info, bg: colors.infoBg };
    }
  }, [variant, colors.success, colors.danger, colors.dangerMuted, colors.info, colors.infoBg]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar fundo"
            style={[styles.backdrop, { backgroundColor: colors.overlay }]}
            onPress={dismissOnBackdropPress ? onClose : undefined}
          />
        </Animated.View>

        <View style={styles.centerWrap} pointerEvents="box-none">
          <Animated.View
            entering={ZoomIn.duration(280).springify().damping(18).stiffness(220)}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderSubtle,
                shadowColor: '#000',
              },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
              <Ionicons name={icon.name} size={40} color={icon.color} />
            </View>

            <Text style={[styles.title, { color: colors.text }]} allowFontScaling={false}>
              {title}
            </Text>

            {message ? (
              <Text style={[styles.body, { color: colors.textMuted }]} allowFontScaling={false}>
                {message}
              </Text>
            ) : null}

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.accent, opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: colors.onAccent }]} allowFontScaling={false}>
                {confirmLabel}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
