import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Switch, Text, View } from 'react-native';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon?: IonName;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  first?: boolean;
};

export function SettingsSwitchRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
  first = false,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);

  return (
    <View style={[styles.switchRow, !first && styles.rowBorder]}>
      <View style={[styles.menuLeft, { flex: 1 }]}>
        {icon ? (
          <View style={[styles.menuIcon, { backgroundColor: colors.accentMuted }]}>
            <Ionicons name={icon} size={20} color={colors.accent} />
          </View>
        ) : null}
        <View style={[styles.menuTextCol, !icon && { marginLeft: 0 }]}>
          <Text style={[styles.menuTitle, disabled && { opacity: 0.5 }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.menuSub, disabled && { opacity: 0.5 }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accentMuted }}
        thumbColor={value ? colors.accent : colors.surfaceElevated}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}
