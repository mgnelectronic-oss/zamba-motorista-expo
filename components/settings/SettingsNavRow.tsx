import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IonName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  /** Se true, não desenha borda superior (primeiro item do card). */
  first?: boolean;
  showChevron?: boolean;
  disabled?: boolean;
};

export function SettingsNavRow({
  icon,
  title,
  subtitle,
  onPress,
  first = false,
  showChevron = true,
  disabled = false,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowBorder,
        pressed && !disabled && { opacity: 0.92 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={styles.menuLeft}>
        <View style={[styles.menuIcon, { backgroundColor: colors.accentMuted }]}>
          <Ionicons name={icon} size={20} color={colors.accent} />
        </View>
        <View style={styles.menuTextCol}>
          <Text style={styles.menuTitle}>{title}</Text>
          {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {showChevron ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
    </Pressable>
  );
}
