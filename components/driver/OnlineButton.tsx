import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RadarPulse } from '@/components/driver/RadarPulse';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { onlineToggleDiameter } from '@/lib/responsive';

const RED_ON = '#DC2626';
const OFFLINE_FOREGROUND = '#0F172A';

export type OnlineButtonProps = {
  isOnline: boolean;
  isToggling: boolean;
  disabled: boolean;
  onPress: () => void;
  loading?: boolean;
};

/**
 * Botão circular ONLINE/OFFLINE — diâmetro ~30% da largura (limites 92–140) para iOS/Android alinhados.
 */
export function OnlineButton({
  isOnline,
  isToggling,
  disabled,
  onPress,
  loading = false,
}: OnlineButtonProps) {
  const { colors } = useAppTheme();
  const { width: winW } = useWindowDimensions();

  const dims = useMemo(() => {
    const btn = onlineToggleDiameter(winW);
    const icon = Math.max(36, Math.round(btn * 0.393));
    const stack = Math.ceil(btn * 2.15);
    const labelSize = Math.max(9, Math.round((winW / 375) * 10));
    return { btn, icon, stack, labelSize };
  }, [winW]);

  const dyn = useMemo(
    () =>
      StyleSheet.create({
        stack: {
          alignItems: 'center',
          justifyContent: 'center',
          marginVertical: winW * 0.02,
          minWidth: dims.stack,
          minHeight: dims.stack,
          overflow: 'visible',
        },
        loaderWrap: {
          width: dims.btn,
          height: dims.btn + dims.labelSize + 12,
          alignItems: 'center',
          justifyContent: 'center',
          marginVertical: winW * 0.02,
        },
        press: {
          width: dims.btn,
          height: dims.btn,
          borderRadius: dims.btn / 2,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: Math.max(4, Math.round(dims.btn * 0.05)),
          zIndex: 3,
        },
        iconBox: {
          width: dims.icon,
          height: dims.icon,
          borderRadius: Math.max(10, Math.round(dims.icon * 0.32)),
          alignItems: 'center',
          justifyContent: 'center',
        },
        label: {
          marginTop: Math.max(3, Math.round(dims.btn * 0.035)),
          fontSize: dims.labelSize,
          fontWeight: '800',
          letterSpacing: Math.max(1, dims.labelSize * 0.14),
          textTransform: 'uppercase',
          lineHeight: Math.round(dims.labelSize * 1.35),
          textAlign: 'center',
        },
      }),
    [dims, winW],
  );

  if (loading) {
    return (
      <View style={dyn.loaderWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const ionSize = Math.max(22, Math.round(dims.icon * 0.62));

  return (
    <View style={dyn.stack} collapsable={false}>
      {isOnline ? <RadarPulse diameter={dims.btn} style={styles.radar} /> : null}

      <Pressable
        onPress={onPress}
        disabled={disabled || isToggling}
        style={({ pressed }) => [
          dyn.press,
          isOnline ? styles.pressOn : styles.pressOff,
          (disabled || isToggling) && styles.pressDisabled,
          pressed && !disabled && !isToggling && { transform: [{ scale: 0.96 }] },
        ]}
      >
        <View style={[dyn.iconBox, isOnline ? styles.iconBoxOn : styles.iconBoxOff]}>
          <Ionicons name="power" size={ionSize} color={isOnline ? '#FFFFFF' : OFFLINE_FOREGROUND} />
        </View>
        <Text
          style={[dyn.label, isOnline ? styles.labelOn : styles.labelOff]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {isToggling ? '…' : isOnline ? 'ONLINE' : 'OFFLINE'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  radar: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 0,
  },
  pressOn: {
    backgroundColor: RED_ON,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#991B1B',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 28,
      },
      android: { elevation: 14 },
    }),
  },
  pressOff: {
    backgroundColor: '#E8EEF4',
    borderWidth: 1,
    borderColor: '#94A3B8',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.09,
        shadowRadius: 18,
      },
      android: { elevation: 9 },
    }),
  },
  pressDisabled: {
    opacity: 0.5,
  },
  iconBoxOn: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  iconBoxOff: {
    backgroundColor: '#CFD8E6',
    borderWidth: 1,
    borderColor: '#64748B',
  },
  labelOn: {
    color: '#FFFFFF',
  },
  labelOff: {
    color: OFFLINE_FOREGROUND,
  },
});
