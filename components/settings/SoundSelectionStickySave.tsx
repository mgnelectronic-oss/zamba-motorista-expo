import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ThemeColors } from '@/theme/types';

type Props = {
  visible: boolean;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  colors: ThemeColors;
};

/**
 * Barra inferior fixa (sobre o scroll): botão Salvar com animação fade + slide ~200ms.
 */
export function SoundSelectionStickySave({ visible, onSave, saving, colors }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : 20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [visible, opacity, translateY]);

  const pb = Math.max(insets.bottom, 12);

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.container, { paddingBottom: pb }]}
    >
      <Animated.View
        style={[
          styles.shadowWrap,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View
          style={[
            styles.inner,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderSubtle,
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 10,
                },
                android: { elevation: 6 },
              }),
            },
          ]}
        >
          <Pressable
            onPress={() => {
              if (!visible || saving) return;
              if (Platform.OS !== 'web') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              void onSave();
            }}
            disabled={!visible || saving}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.accent },
              pressed && !saving && { opacity: 0.9 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={[styles.btnLabel, { color: colors.onAccent }]}>Salvar</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  shadowWrap: {
    width: '100%',
    maxWidth: 520,
  },
  inner: {
    borderRadius: 16,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
