import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { normalize } from '@/lib/responsive';

/**
 * Barra inferior custom: item ativo com fundo verde arredondado, ícone/texto brancos e sombra;
 * itens inativos discretos (#4B5563), sem fundo.
 */
export function DriverTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors } = useAppTheme();
  const { width: winW } = useWindowDimensions();
  const bottomPad = Math.max(insets.bottom, normalize(12, winW));

  const sizes = useMemo(
    () => ({
      icon: Math.round(normalize(26, winW)),
      label: Math.max(9, Math.round(normalize(10, winW))),
      rowMinH: normalize(58, winW),
      tabMinH: normalize(50, winW),
      tabActiveMinH: normalize(56, winW),
      padV: normalize(8, winW),
      padVActive: normalize(10, winW),
      padH: normalize(4, winW),
      padHActive: normalize(6, winW),
      radius: normalize(18, winW),
      radiusActive: normalize(20, winW),
      labelMarginTop: normalize(4, winW),
      rowPadH: normalize(6, winW),
    }),
    [winW],
  );

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          paddingTop: normalize(10, winW),
        },
      ]}
    >
      <View
        style={[styles.row, { paddingBottom: bottomPad, minHeight: sizes.rowMinH, paddingHorizontal: sizes.rowPadH }]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = (options.title as string) ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const color = isFocused ? colors.tabActiveLabel : colors.tabInactive;
          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color,
            size: sizes.icon,
          });

          return (
            <View key={route.key} style={styles.tabSlot}>
              <PlatformPressable
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={() => {
                  if (process.env.EXPO_OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  onPress();
                }}
                onLongPress={onLongPress}
                style={styles.pressable}
              >
                <View
                  style={[
                    styles.tabInner,
                    {
                      paddingVertical: isFocused ? sizes.padVActive : sizes.padV,
                      paddingHorizontal: isFocused ? sizes.padHActive : sizes.padH,
                      borderRadius: isFocused ? sizes.radiusActive : sizes.radius,
                      minHeight: isFocused ? sizes.tabActiveMinH : sizes.tabMinH,
                    },
                    isFocused && [styles.tabInnerActive, { backgroundColor: colors.tabActiveBg }],
                  ]}
                >
                  {icon}
                  <Text
                    style={[
                      styles.label,
                      {
                        marginTop: sizes.labelMarginTop,
                        fontSize: sizes.label,
                        lineHeight: Math.round(sizes.label * 1.25),
                      },
                      isFocused && styles.labelActive,
                      { color },
                    ]}
                    numberOfLines={1}
                    allowFontScaling={false}
                  >
                    {label.toLocaleUpperCase('pt-PT')}
                  </Text>
                </View>
              </PlatformPressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  tabInnerActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.38,
        shadowRadius: 10,
      },
      android: {
        elevation: 12,
        shadowColor: '#16A34A',
      },
    }),
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
