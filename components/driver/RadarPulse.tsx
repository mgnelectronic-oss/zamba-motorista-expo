import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * Radar online — valores de animação (useNativeDriver: opacity + transform):
 * - scale: 1 → ~1.76 (expansão suave a partir do diâmetro do botão)
 * - opacity: início mais visível, desvanecimento contínuo
 * - duration: 2800ms por onda, loop infinito
 * - 3 ondas com delay 0 / 750 / 1500 ms
 */
const SCALE_MIN = 1;
const SCALE_MAX = 1.76;
const OPACITY_START = 0.58;
const OPACITY_END = 0;
const WAVE_DURATION_MS = 2800;
const WAVE_DELAYS_MS = [0, 750, 1500] as const;

const RING_BORDER = 'rgba(220, 38, 38, 0.88)';
const RING_WIDTH = 2.5;

type RingProps = {
  size: number;
  delayMs: number;
};

function PulseRing({ size, delayMs }: RingProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(progress, {
          toValue: 1,
          duration: WAVE_DURATION_MS,
          easing: Easing.bezier(0.33, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [delayMs, progress]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SCALE_MIN, SCALE_MAX],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.45, 1],
    outputRange: [OPACITY_START, OPACITY_START * 0.92, OPACITY_START * 0.38, OPACITY_END],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: RING_BORDER,
          borderWidth: RING_WIDTH,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

export type RadarPulseProps = {
  diameter?: number;
  style?: ViewStyle;
};

/**
 * Ondas animadas atrás do botão (apenas online). Contentor dimensionado para não cortar a expansão máxima.
 */
export function RadarPulse({ diameter = 112, style }: RadarPulseProps) {
  const maxScale = SCALE_MAX;
  const pad = (diameter / 2) * (maxScale - 1) + 12;
  const container = diameter + pad * 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          width: container,
          height: container,
        },
        style,
      ]}
    >
      {WAVE_DELAYS_MS.map((delayMs, index) => (
        <View key={index} style={styles.ringSlot} pointerEvents="none">
          <PulseRing size={diameter} delayMs={delayMs} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
});
