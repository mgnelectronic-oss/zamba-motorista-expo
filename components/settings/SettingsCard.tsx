import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';

export function SettingsCard({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);

  return <View style={styles.menuCard}>{children}</View>;
}
