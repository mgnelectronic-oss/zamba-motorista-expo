import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createSettingsStyles } from '@/components/settings/createSettingsStyles';
import { useAppTheme } from '@/contexts/AppThemeContext';

type Props = {
  title: string;
  children: React.ReactNode;
  /** Texto introdutório no topo do scroll (subpáginas). */
  subtitle?: string;
  /** Conteúdo fixo sobreposto no fundo (ex.: barra Salvar). */
  footerOverlay?: React.ReactNode;
  /** Espaço extra no fundo do scroll para o conteúdo não ficar tapado pelo overlay. */
  scrollExtraBottom?: number;
};

export function SettingsScreenLayout({
  title,
  subtitle,
  children,
  footerOverlay,
  scrollExtraBottom = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);

  const safeTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  );

  const scrollPadBottom = Math.max(insets.bottom, 16) + 28 + scrollExtraBottom;

  return (
    <SafeAreaView style={[styles.root, { paddingTop: safeTop, flex: 1 }]} edges={['left', 'right']}>
      <View style={styles.topBar}>
        <View style={{ width: 40, alignItems: 'flex-start' }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        </View>
        <Text style={[styles.topTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { paddingBottom: scrollPadBottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
          {children}
        </ScrollView>
        {footerOverlay}
      </View>
    </SafeAreaView>
  );
}
