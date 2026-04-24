import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon?: IonName;
  title: string;
  subtitle?: string;
  value: string;
  first?: boolean;
};

export function SettingsValueRow({ icon, title, subtitle, value, first = false }: Props) {
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
          <Text style={styles.menuTitle}>{title}</Text>
          {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
        </View>
      </View>
      <Text style={styles.valueText} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
