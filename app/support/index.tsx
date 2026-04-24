import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { isSupabaseConfigured } from '@/lib/env';
import { listarTicketsDoUsuario } from '@/services/supportService';
import {
  SUPPORT_COMMON_CATEGORIES,
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_URL,
  getSupportCategoryLabel,
  supportStatusLabel,
  type SupportTicketRow,
} from '@/types/support';
import { createSupportStyles } from '@/theme/screens/supportStyles';

function openEmail() {
  const q = encodeURIComponent('Pedido de suporte — Zamba Motorista');
  void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${q}`);
}

export default function SuporteInicioScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSupportStyles(colors), [colors]);

  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listaVisivel = useMemo(
    () => (mostrarTodos ? tickets : tickets.slice(0, 5)),
    [tickets, mostrarTodos],
  );

  const loadTickets = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listarTicketsDoUsuario();
      setTickets(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'Sessão expirada, faça login novamente') {
        setTickets([]);
        setError(null);
      } else {
        setError(msg || 'Erro ao carregar solicitações.');
        setTickets([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTickets();
    }, [loadTickets]),
  );

  const statusColor = (s: SupportTicketRow['status']) => {
    if (s === 'resolved') return colors.success;
    if (s === 'in_progress') return colors.info;
    return colors.warning;
  };

  return (
    <SettingsScreenLayout title="Suporte">
      <Text style={styles.sectionLabel}>Problemas comuns</Text>
      <View style={styles.card}>
        {SUPPORT_COMMON_CATEGORIES.map((c, idx) => (
          <Pressable
            key={c.id}
            onPress={() => router.push(`/support/contact?category=${encodeURIComponent(c.id)}`)}
            style={({ pressed }) => [
              styles.row,
              idx > 0 && styles.rowBorder,
              idx === 0 && styles.rowFirst,
              pressed && { opacity: 0.92 },
            ]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="help-circle-outline" size={22} color={colors.accent} />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>{c.label}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => router.push('/support/categories')}
        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.94 }]}
      >
        <Text style={styles.primaryBtnText}>Ver todos os problemas</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Falar com o suporte</Text>
      <View style={styles.card}>
        <Pressable
          onPress={() => router.push('/support/chat')}
          style={({ pressed }) => [styles.secondaryRow, pressed && { opacity: 0.92 }]}
        >
          <View style={[styles.secondaryIcon, { backgroundColor: colors.accentMuted }]}>
            <Ionicons name="chatbubbles-outline" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.secondaryTitle}>Chat</Text>
            <Text style={styles.secondarySub}>Conversa com o suporte no app</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL(SUPPORT_WHATSAPP_URL)}
          style={({ pressed }) => [styles.secondaryRow, styles.rowBorder, pressed && { opacity: 0.92 }]}
        >
          <View style={[styles.secondaryIcon, { backgroundColor: 'rgba(22, 163, 74, 0.12)' }]}>
            <Ionicons name="logo-whatsapp" size={22} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.secondaryTitle}>WhatsApp</Text>
            <Text style={styles.secondarySub}>Abre conversa com o atendimento</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => void openEmail()}
          style={({ pressed }) => [styles.secondaryRow, styles.rowBorder, pressed && { opacity: 0.92 }]}
        >
          <View style={[styles.secondaryIcon, { backgroundColor: colors.infoBg }]}>
            <Ionicons name="mail-outline" size={22} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.secondaryTitle}>Email</Text>
            <Text style={styles.secondarySub}>{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Minhas solicitações</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.card}>
        {loading ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : tickets.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma solicitação ainda</Text>
        ) : (
          <>
            {listaVisivel.map((t, i) => (
              <View key={t.id} style={[styles.ticketItem, i === 0 && { borderTopWidth: 0 }]}>
                <View style={styles.ticketTop}>
                  <Text style={styles.ticketCategory} numberOfLines={2}>
                    {getSupportCategoryLabel(t.category)}
                  </Text>
                  <Text style={[styles.ticketStatus, { color: statusColor(t.status) }]}>
                    {supportStatusLabel(t.status)}
                  </Text>
                </View>
                <Text style={styles.ticketDate}>
                  {new Date(t.created_at).toLocaleString('pt-PT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
            {tickets.length > 5 ? (
              <Pressable
                onPress={() => setMostrarTodos((v) => !v)}
                style={({ pressed }) => [styles.ticketsToggleRow, pressed && { opacity: 0.86 }]}
              >
                <Text style={styles.ticketsToggleText}>
                  {mostrarTodos ? 'Ver menos' : 'Ver mais'}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </SettingsScreenLayout>
  );
}
