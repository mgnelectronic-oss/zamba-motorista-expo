import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopupModal } from '@/components/wallet/TopupModal';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useWalletData } from '@/hooks/useWalletData';
import { formatCurrencyMzn } from '@/lib/formatMz';
import { isSupabaseConfigured } from '@/lib/env';
import { createSaldoStyles } from '@/theme/screens/saldoStyles';
import { MIN_BALANCE } from '@/types/driver';

type TabKey = 'topups' | 'discounts';

function getShortRef(id: string | null) {
  if (!id) return 'Corrida sem referência';
  return `Corrida #${id.substring(0, 8)}`;
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-MZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SaldoScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSaldoStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const safeTop = useMemo(() => {
    const androidBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
    return Math.max(insets.top, androidBar);
  }, [insets.top]);

  const { session } = useAppAuth();
  const userId = session?.user?.id;

  const {
    wallet,
    topups,
    loading,
    error,
    loadData,
    currentDiscountRate,
    discounts,
    loadingRate,
    loadingHistory,
    errorRate,
    errorHistory,
    loadDiscountData,
    reloadDiscountRate,
  } = useWalletData(userId);

  const [activeTab, setActiveTab] = useState<TabKey>('topups');
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const tabsYRef = useRef(0);

  const minRequired = wallet?.min_required_balance ?? MIN_BALANCE;
  const isOperational = wallet ? wallet.balance >= wallet.min_required_balance : false;

  const onRefresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) return;
    setRefreshing(true);
    try {
      await loadData(false);
    } finally {
      setRefreshing(false);
    }
  }, [userId, loadData]);

  const handleScrollToDiscounts = () => {
    setActiveTab('discounts');
    void reloadDiscountRate();
    if (tabsYRef.current > 0) {
      scrollRef.current?.scrollTo({ y: Math.max(0, tabsYRef.current - 24), animated: true });
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

  if (loading && !wallet && !error) {
    return (
      <SafeAreaView style={screenWrap} edges={['left', 'right']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingLabel}>A carregar carteira…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenWrap} edges={['left', 'right']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 12) + 88 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Carteira</Text>
            <Text style={styles.pageSub}>Gestão de saldo</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleScrollToDiscounts}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
              accessibilityLabel="Histórico de descontos"
            >
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
            </Pressable>
            <View style={styles.iconBtnGreen}>
              <Ionicons name="wallet" size={19} color="#FFF" />
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText} numberOfLines={3}>
              {error}
            </Text>
            <Pressable onPress={() => loadData(true)} style={styles.errorRetry}>
              <Text style={styles.errorRetryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Card principal — `Wallet.tsx` */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardInner}>
            <View style={styles.balanceTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.balanceKicker}>SALDO DISPONÍVEL</Text>
                <Text style={styles.balanceValue}>
                  {wallet !== null ? formatCurrencyMzn(Number(wallet.balance)) : formatCurrencyMzn(0)}
                </Text>
              </View>
              <View style={styles.cardIconWrap}>
                <Ionicons name="card-outline" size={18} color="#FFF" />
              </View>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceBottom}>
              <View>
                <Text style={styles.miniKicker}>Mínimo para operar</Text>
                <Text style={styles.miniStrong}>{minRequired} MT</Text>
              </View>
              <View style={styles.accountStateCol}>
                <Text style={styles.miniKicker}>Estado da conta</Text>
                <View style={[styles.statusPill, !isOperational && styles.statusPillBad]}>
                  <View style={[styles.statusDot, isOperational ? styles.statusDotOk : styles.statusDotBad]} />
                  <Text style={[styles.statusPillText, !isOperational && styles.statusPillTextBad]}>
                    {isOperational ? 'Pronta para operar' : 'Saldo insuficiente'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => setShowTopupModal(true)}
          style={({ pressed }) => [styles.primaryCta, pressed && { opacity: 0.95 }]}
        >
          <View style={styles.ctaIconWrap}>
            <Ionicons name="add" size={19} color="#FFF" />
          </View>
          <Text style={styles.primaryCtaText}>Recarregar Conta</Text>
        </Pressable>

        <View style={styles.infoBox}>
          <View style={styles.infoIconBox}>
            <Ionicons name="information-circle" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Informação importante</Text>
            <Text style={styles.infoBody}>
              Para realizar corridas você precisa manter pelo menos{' '}
              <Text style={styles.infoHighlight}>{minRequired} MT</Text> de saldo na sua conta. A taxa de serviço
              da plataforma é descontada da carteira após as corridas.
            </Text>
          </View>
        </View>

        <View
          onLayout={(e) => {
            tabsYRef.current = e.nativeEvent.layout.y;
          }}
          style={styles.tabBar}
        >
          <Pressable
            onPress={() => setActiveTab('topups')}
            style={[styles.tabBtn, activeTab === 'topups' && styles.tabBtnOn]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'topups' && styles.tabBtnTextOn]}>Recargas</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setActiveTab('discounts');
              void reloadDiscountRate();
            }}
            style={[styles.tabBtn, activeTab === 'discounts' && styles.tabBtnOn]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'discounts' && styles.tabBtnTextOn]}>Descontos</Text>
          </Pressable>
        </View>

        {activeTab === 'topups' ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Histórico de recargas</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {topups.length} {topups.length === 1 ? 'transação' : 'transações'}
                </Text>
              </View>
            </View>
            {topups.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="wallet-outline" size={24} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>Nenhuma recarga registada ainda</Text>
                <Text style={styles.emptySub}>Quando solicitar recargas elas aparecerão aqui.</Text>
              </View>
            ) : (
              topups.map((t) => {
                const ok = t.status === 'approved' || t.status === 'paid';
                const bad = t.status === 'rejected' || t.status === 'failed';
                const label = ok ? 'Aprovado' : bad ? 'Rejeitado' : 'Pendente';
                return (
                  <View key={t.id} style={styles.txCard}>
                    <View style={styles.txLeft}>
                      <View
                        style={[
                          styles.txIcon,
                          ok && styles.txIconOk,
                          bad && styles.txIconBad,
                          !ok && !bad && styles.txIconPending,
                        ]}
                      >
                        <Ionicons
                          name="trending-up"
                          size={18}
                          color={ok ? colors.accent : bad ? colors.danger : colors.warning}
                        />
                      </View>
                      <View>
                        <Text style={styles.txAmount}>+{t.amount} MT</Text>
                        <Text style={styles.txMethod}>{t.method === 'mpesa' ? 'M-Pesa' : 'eMola'}</Text>
                        <Text style={styles.txDate}>
                          {new Date(t.created_at).toLocaleDateString('pt-MZ', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        ok && styles.statusBadgeOk,
                        bad && styles.statusBadgeBad,
                        !ok && !bad && styles.statusBadgePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeLabel,
                          ok && styles.statusBadgeLabelOk,
                          bad && styles.statusBadgeLabelBad,
                          !ok && !bad && styles.statusBadgeLabelPending,
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.discountHead}>
              <Text style={styles.sectionTitle}>Histórico de descontos</Text>
              <Text style={styles.sectionSub}>Descontos automáticos aplicados por viagem</Text>
            </View>

            <View style={styles.rateCard}>
              <View style={styles.rateLeft}>
                <View style={styles.rateIcon}>
                  <Ionicons name="trending-up" size={18} color={colors.info} />
                </View>
                <View>
                  <Text style={styles.rateKicker}>Taxa atual de desconto</Text>
                  {loadingRate ? (
                    <ActivityIndicator size="small" color={colors.info} style={{ marginTop: 6 }} />
                  ) : errorRate ? (
                    <Text style={styles.rateError}>{errorRate}</Text>
                  ) : (
                    <Text style={styles.rateValue}>{currentDiscountRate}% por viagem</Text>
                  )}
                </View>
              </View>
              <Pressable onPress={() => reloadDiscountRate()} style={styles.rateRefresh} accessibilityLabel="Atualizar taxa">
                <Ionicons name="refresh" size={19} color={colors.info} />
              </Pressable>
            </View>

            {loadingHistory ? (
              <View style={styles.skeletonStack}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={styles.skeletonCard} />
                ))}
              </View>
            ) : errorHistory ? (
              <View style={styles.discountErrorBox}>
                <Text style={styles.discountErrorText}>{errorHistory}</Text>
                <Pressable onPress={() => loadDiscountData()}>
                  <Text style={styles.discountRetry}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : discounts.length === 0 ? (
              <View style={styles.emptyStateSoft}>
                <Text style={styles.emptySoftText}>Nenhum desconto registado ainda</Text>
              </View>
            ) : (
              discounts.map((d) => (
                <View key={d.id} style={styles.txCard}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.commTitle}>Comissão da viagem</Text>
                    <Text style={styles.commRef}>{getShortRef(d.ride_id)}</Text>
                    <Text style={styles.commDate}>{formatDateTime(d.created_at)}</Text>
                  </View>
                  <View style={styles.commRight}>
                    <Text style={styles.commDebit}>- {formatCurrencyMzn(Number(d.amount))}</Text>
                    <Text style={styles.commBal}>
                      {(d.balance_before ?? 0).toFixed(2)} MT → {(d.balance_after ?? 0).toFixed(2)} MT
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {userId ? (
        <TopupModal
          visible={showTopupModal}
          userId={userId}
          onClose={() => setShowTopupModal(false)}
          onSuccess={() => loadData(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
