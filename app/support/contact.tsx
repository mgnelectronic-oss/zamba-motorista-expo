import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FeedbackModal, type FeedbackModalVariant } from '@/components/FeedbackModal';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { isSupabaseConfigured } from '@/lib/env';
import { criarTicketSuporte } from '@/services/supportService';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL, getSupportCategoryLabel } from '@/types/support';
import { createSupportStyles } from '@/theme/screens/supportStyles';

function openEmail() {
  const q = encodeURIComponent('Pedido de suporte — Zamba Motorista');
  void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${q}`);
}

type FeedbackState = {
  visible: boolean;
  variant: FeedbackModalVariant;
  title: string;
  message?: string;
  navigateBackOnClose: boolean;
};

const FEEDBACK_CLOSED: FeedbackState = {
  visible: false,
  variant: 'success',
  title: '',
  message: undefined,
  navigateBackOnClose: false,
};

export default function SuporteContatoScreen() {
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();
  const category = typeof categoryParam === 'string' ? categoryParam : 'outro';
  const label = getSupportCategoryLabel(category);

  const { colors } = useAppTheme();
  const styles = useMemo(() => createSupportStyles(colors), [colors]);

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(FEEDBACK_CLOSED);

  const openFeedback = (opts: Omit<FeedbackState, 'visible'>) => {
    setFeedback({ ...opts, visible: true });
  };

  const closeFeedback = () => {
    setFeedback((prev) => {
      const goBack = prev.navigateBackOnClose;
      if (goBack) {
        queueMicrotask(() => router.back());
      }
      return FEEDBACK_CLOSED;
    });
  };

  const send = async () => {
    const text = message.trim();
    if (!text) {
      openFeedback({
        variant: 'error',
        title: 'Mensagem vazia',
        message: 'Descreva o seu problema antes de enviar.',
        navigateBackOnClose: false,
      });
      return;
    }
    if (!isSupabaseConfigured) {
      openFeedback({
        variant: 'error',
        title: 'Configuração',
        message: 'Supabase não está configurado.',
        navigateBackOnClose: false,
      });
      return;
    }

    setSending(true);
    try {
      await criarTicketSuporte(category, text);
      setMessage('');
      openFeedback({
        variant: 'success',
        title: 'Mensagem enviada',
        message: 'Nossa equipe vai analisar em breve',
        navigateBackOnClose: true,
      });
    } catch {
      openFeedback({
        variant: 'error',
        title: 'Erro ao enviar',
        message: 'Tente novamente',
        navigateBackOnClose: false,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <SettingsScreenLayout title="Falar com o Suporte">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>{label}</Text>
        </View>

        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Descreva o seu problema"
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.input}
          editable={!sending}
          textAlignVertical="top"
        />

        <Pressable
          onPress={() => void send()}
          disabled={sending}
          style={({ pressed }) => [styles.primaryBtn, (pressed || sending) && { opacity: 0.9 }]}
        >
          {sending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Enviar mensagem</Text>
          )}
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Outros canais</Text>
        <View style={styles.card}>
          <Pressable
            onPress={() => void Linking.openURL(SUPPORT_WHATSAPP_URL)}
            style={({ pressed }) => [styles.secondaryRow, pressed && { opacity: 0.92 }]}
          >
            <View style={[styles.secondaryIcon, { backgroundColor: 'rgba(22, 163, 74, 0.12)' }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.secondaryTitle}>WhatsApp</Text>
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
      </KeyboardAvoidingView>

      {feedback.visible ? (
        <FeedbackModal
          visible
          variant={feedback.variant}
          title={feedback.title}
          message={feedback.message}
          confirmLabel="OK"
          onClose={closeFeedback}
        />
      ) : null}
    </SettingsScreenLayout>
  );
}
