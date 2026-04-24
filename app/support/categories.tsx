import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { SUPPORT_CATEGORY_GROUPS } from '@/types/support';
import { createSupportStyles } from '@/theme/screens/supportStyles';

export default function CategoriasSuporteScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSupportStyles(colors), [colors]);

  return (
    <SettingsScreenLayout title="Categorias de Suporte">
      {SUPPORT_CATEGORY_GROUPS.map((group) => (
        <View key={group.groupTitle} style={styles.groupCard}>
          <Text style={styles.groupLabel}>{group.groupTitle}</Text>
          <View style={styles.card}>
            {group.items.map((item, idx) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/support/contact?category=${encodeURIComponent(item.id)}`)}
                style={({ pressed }) => [
                  styles.row,
                  idx > 0 && styles.rowBorder,
                  idx === 0 && styles.rowFirst,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.rowIcon, { backgroundColor: colors.accentMuted }]}>
                    <Ionicons name="folder-outline" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.rowTextCol}>
                    <Text style={styles.rowTitle}>{item.label}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </SettingsScreenLayout>
  );
}
