import React from 'react';
import { View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

const ARROW_BLUE = '#4285F4';

type Props = {
  /** Rotação em graus (bearing). */
  headingDeg: number;
  size?: number;
};

/**
 * Seta tipo navegação (azul Google) com halo branco — rotação pelo bearing.
 */
export function DriverNavigationArrow({ headingDeg, size = 34 }: Props) {
  return (
    <View
      style={{
        width: size + 8,
        height: size + 8,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size + 8,
          height: size + 8,
          borderRadius: (size + 8) / 2,
          backgroundColor: 'rgba(255,255,255,0.95)',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
          elevation: 3,
        }}
      >
        <View style={{ transform: [{ rotate: `${headingDeg}deg` }] }}>
          <Svg width={size} height={size} viewBox="0 0 48 48">
            <Polygon
              points="24,6 40,38 24,30 8,38"
              fill={ARROW_BLUE}
              stroke="#1a5fb4"
              strokeWidth={0.5}
            />
          </Svg>
        </View>
      </View>
    </View>
  );
}
