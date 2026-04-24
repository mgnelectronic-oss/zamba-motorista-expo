import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import { useAppTheme } from '@/contexts/AppThemeContext';
import type { ThemePreference } from '@/theme/types';

const OPTIONS: { key: ThemePreference; title: string; description: string }[] = [
  { key: 'light', title: 'Claro', description: 'Fundo claro em todo o aplicativo' },
  { key: 'dark', title: 'Escuro', description: 'Fundo escuro para reduzir o brilho' },
  { key: 'system', title: 'Automático', description: 'Segue o tema do telefone' },
];

export default function SettingsThemeScreen() {
  const { colors, preference, setPreference } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);

  return (
    <SettingsScreenLayout
      title="Tema do aplicativo"
      subtitle="Escolha como o Zamba Motorista deve aparecer. A alteração aplica-se a todo o app."
    >
      <View style={styles.list}>
        {OPTIONS.map((opt) => {
          const selected = preference === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => void setPreference(opt.key)}
              style={({ pressed }) => [
                styles.option,
                { borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.surface },
                pressed && { opacity: 0.94 },
              ]}
            >
              <View style={styles.optionTextCol}>
                <Text style={[styles.optionTitle, selected && { color: colors.accent }]}>{opt.title}</Text>
                <Text style={styles.optionDesc}>{opt.description}</Text>
              </View>
              <View style={[styles.radio, selected && { borderColor: colors.accent }]}>
                {selected ? <View style={[styles.radioInner, { backgroundColor: colors.accent }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </SettingsScreenLayout>
  );
}
