import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { isSupabaseConfigured } from '@/lib/env';
import { formatCurrencyMzn, getInitials } from '@/lib/formatMz';
import { resolveProfilePhotoUrl } from '@/lib/profilePhoto';
import { authService } from '@/services/authService';
import { driverService } from '@/services/driverService';
import type { DriverDocument, DriverProfile, DriverWallet } from '@/types/driver';
import { MIN_BALANCE } from '@/types/driver';
import { createPerfilStyles, type PerfilStyles } from '@/theme/screens/perfilStyles';

export default function PerfilScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createPerfilStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const safeTop = useMemo(() => {
    const androidBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
    return Math.max(insets.top, androidBar);
  }, [insets.top]);

  const { session, refreshState } = useAppAuth();
  const userId = session?.user?.id;
  const email = session?.user?.email ?? '';

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [documents, setDocuments] = useState<DriverDocument | null>(null);
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileAvatars, setProfileAvatars] = useState<{ avatar_url: string | null; selfie_url: string | null } | null>(
    null,
  );
  const [photoPreviewUri, setPhotoPreviewUri] = useState<string | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      if (isMounted.current) setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const safetyTimeout = setTimeout(() => {
      if (isMounted.current) setLoading(false);
    }, 5000);

    try {
      const [p, d, w, av] = await Promise.all([
        driverService.getProfile(userId),
        driverService.getDocuments(userId),
        driverService.getWallet(userId),
        driverService.getProfileAvatars(userId),
      ]);
      if (isMounted.current) {
        setProfile(p);
        setDocuments(d);
        setWallet(w);
        setProfileAvatars(av);
      }
    } catch {
      if (isMounted.current) {
        setError('Não foi possível carregar o perfil. Verifique a ligação.');
      }
    } finally {
      clearTimeout(safetyTimeout);
      if (isMounted.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const profilePhotoUrl = resolveProfilePhotoUrl({
    avatarUrl: profileAvatars?.avatar_url,
    selfieUrl: profileAvatars?.selfie_url,
    driverDocumentPhotoUrl: documents?.driver_selfie ?? null,
  });
  const showAvatarImage =
    !!profilePhotoUrl &&
    (profilePhotoUrl.startsWith('http') || profilePhotoUrl.startsWith('file'));
  const initials = getInitials(profile?.full_name);

  const status = profile?.verification_status || 'pending_documents';
  const isApproved = status === 'verified' || status === 'approved';
  const isPendingReview = status === 'pending_review';
  const isRejected = status === 'rejected';
  const isPendingDocs = status === 'pending_documents' || status === 'pending';
  const balance = wallet?.balance ?? 0;
  const minOp = wallet?.min_required_balance ?? MIN_BALANCE;
  const hasBalance = balance >= minOp;

  const getStatusMessage = () => {
    if (!isApproved) {
      if (isPendingDocs) return 'Carregue os documentos para validar a conta';
      if (isPendingReview) return 'Aguarde a aprovação da conta';
      if (isRejected) return profile?.rejection_reason || 'Documentos rejeitados. Atualize e reenvie.';
      return 'Aguarde a aprovação da conta';
    }
    if (!hasBalance) return 'Saldo insuficiente para operar';
    return 'Conta apta para operar';
  };

  const getActivationSubtitle = () => {
    if (isApproved) return 'Conta verificada';
    if (isPendingReview) return 'Ver dados enviados';
    if (isRejected) return 'Corrigir e reenviar';
    return 'Carregar dados e documentos';
  };

  const handleLogout = async () => {
    try {
      setSigningOut(true);
      await authService.signOut();
      await refreshState();
      router.replace('/(auth)/login');
    } catch {
      Alert.alert('Erro', 'Não foi possível encerrar a sessão.');
    } finally {
      setSigningOut(false);
    }
  };

  const screenWrap = [styles.root, { paddingTop: safeTop }];

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={screenWrap} edges={['left', 'right']}>
        <View style={styles.centerBox}>
          <Text style={styles.configTitle}>Supabase não configurado</Text>
          <Text style={styles.configSub}>Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !profile && !error) {
    return (
      <SafeAreaView style={screenWrap} edges={['left', 'right']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingLabel}>A carregar perfil…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const message = getStatusMessage();
  let badgeStyle = styles.badgeNeutral;
  let badgeIcon: keyof typeof Ionicons.glyphMap = 'alert-circle-outline';
  let badgeIconColor = colors.warning;

  if (isApproved && hasBalance) {
    badgeStyle = styles.badgeOk;
    badgeIcon = 'checkmark-circle';
    badgeIconColor = colors.success;
  } else if (isApproved && !hasBalance) {
    badgeStyle = styles.badgeWarn;
    badgeIcon = 'alert-circle';
    badgeIconColor = colors.danger;
  } else if (isPendingReview) {
    badgeStyle = styles.badgeInfo;
    badgeIcon = 'time-outline';
    badgeIconColor = colors.info;
  }

  return (
    <SafeAreaView style={screenWrap} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 12) + 88 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Pressable
            onPress={() => {
              if (showAvatarImage && profilePhotoUrl) setPhotoPreviewUri(profilePhotoUrl);
            }}
            style={({ pressed }) => [styles.avatarPress, pressed && { opacity: 0.92 }]}
            disabled={!showAvatarImage}
            accessibilityRole="imagebutton"
            accessibilityLabel="Foto de perfil"
          >
            <View style={styles.avatarWrap}>
              {showAvatarImage ? (
                <Image source={{ uri: profilePhotoUrl! }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
          </Pressable>
          <Text style={styles.name}>{profile?.full_name || 'Motorista Zamba'}</Text>
          {profile?.phone ? (
            <View style={styles.rowCenter}>
              <Ionicons name="call-outline" size={14} color={colors.accent} />
              <Text style={styles.phone}>{profile.phone}</Text>
            </View>
          ) : null}
          <View style={styles.rowCenter}>
            <Ionicons name="mail-outline" size={12} color={colors.textMuted} />
            <Text style={styles.mail} numberOfLines={1}>
              {email || '—'}
            </Text>
          </View>
          <View style={styles.badgeWrap}>
            <View style={[styles.badge, badgeStyle]}>
              <Ionicons name={badgeIcon} size={14} color={badgeIconColor} />
              <Text
                style={[
                  styles.badgeText,
                  isApproved && hasBalance && styles.badgeTextOk,
                  isApproved && !hasBalance && styles.badgeTextErr,
                  isPendingReview && styles.badgeTextInfo,
                ]}
              >
                {message}
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadData()} style={styles.errorRetry}>
              <Text style={styles.errorRetryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push('/(tabs)/saldo')}
          style={({ pressed }) => [styles.walletCard, pressed && { opacity: 0.96 }]}
        >
          <View style={styles.walletTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletKicker}>Saldo da carteira</Text>
              <Text style={styles.walletValue}>{formatCurrencyMzn(balance)}</Text>
            </View>
            <View style={styles.walletIconBox}>
              <Ionicons name="wallet-outline" size={22} color="#FFF" />
            </View>
          </View>
          <View style={styles.walletDivider} />
          <View style={styles.walletFooter}>
            <Text style={styles.walletMin}>
              Mínimo para operar: {minOp} MT
            </Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.55)" />
          </View>
        </Pressable>

        <View style={styles.menuCard}>
          <MenuRow
            styles={styles}
            icon="shield-checkmark"
            iconBg={colors.accentMuted}
            iconColor={colors.accent}
            title="Ativação da conta"
            subtitle={getActivationSubtitle()}
            onPress={() => router.push('/activation')}
            showDivider
          />
          <MenuRow
            styles={styles}
            icon="wallet-outline"
            iconBg={colors.infoBg}
            iconColor={colors.info}
            title="Carteira"
            subtitle="Recargas e saldo"
            onPress={() => router.push('/(tabs)/saldo')}
            showDivider
          />
          <MenuRow
            styles={styles}
            icon="settings-outline"
            iconBg={colors.chipBg}
            iconColor={colors.textSecondary}
            title="Configurações"
            subtitle="Preferências do app"
            onPress={() => router.push('/settings' as never)}
            showDivider
          />
          <MenuRow
            styles={styles}
            icon="headset-outline"
            iconBg={colors.warningBg}
            iconColor={colors.warning}
            title="Suporte"
            subtitle="Ajuda e atendimento ao cliente"
            onPress={() => router.push('/support')}
            showDivider
          />
          <MenuRow
            styles={styles}
            icon="information-circle-outline"
            iconBg="rgba(147,51,234,0.15)"
            iconColor="#A855F7"
            title="Sobre"
            subtitle="Informações sobre o aplicativo"
            onPress={() => setShowAbout(true)}
            showDivider
          />
          <Pressable
            onPress={handleLogout}
            disabled={signingOut}
            style={({ pressed }) => [styles.logoutRow, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(220,38,38,0.1)' }]}>
                <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.logoutTitle}>Sair</Text>
                <Text style={styles.logoutSub}>Encerrar sessão</Text>
              </View>
            </View>
            {signingOut ? (
              <ActivityIndicator size="small" color="#FCA5A5" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#FECACA" />
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={!!photoPreviewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPreviewUri(null)}
      >
        <Pressable style={styles.photoPreviewOverlay} onPress={() => setPhotoPreviewUri(null)}>
          {photoPreviewUri ? (
            <Image source={{ uri: photoPreviewUri }} style={styles.photoPreviewImg} contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>

      <Modal visible={showAbout} transparent animationType="fade" onRequestClose={() => setShowAbout(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAbout(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalIconCircle, { backgroundColor: 'rgba(147,51,234,0.12)' }]}>
              <Ionicons name="information-circle-outline" size={32} color="#9333EA" />
            </View>
            <Text style={styles.modalTitle}>Sobre o Zamba</Text>
            <Text style={styles.modalSub}>Versão 1.0.0 (Build 2026)</Text>
            <View style={styles.aboutBox}>
              <Text style={styles.aboutKicker}>Plataforma</Text>
              <Text style={styles.aboutVal}>Zamba Driver App</Text>
              <Text style={[styles.aboutKicker, { marginTop: 8 }]}>Desenvolvimento</Text>
              <Text style={styles.aboutVal}>Zamba Mobility Solutions</Text>
              <Text style={[styles.aboutKicker, { marginTop: 8 }]}>Copyright</Text>
              <Text style={styles.aboutCopy}>© 2026 Zamba. Todos os direitos reservados.</Text>
            </View>
            <Pressable style={styles.modalBtnDark} onPress={() => setShowAbout(false)}>
              <Text style={styles.modalBtnDarkText}>Entendido</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function MenuRow({
  styles,
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  onPress,
  showDivider,
}: {
  styles: PerfilStyles;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, showDivider && styles.menuRowBorder, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.menuLeft}>
        <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.menuTextCol}>
          <Text style={styles.menuTitle}>{title}</Text>
          <Text style={styles.menuSub}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}
