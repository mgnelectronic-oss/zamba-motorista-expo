import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TripDetailsSheet } from '@/components/trips/TripDetailsSheet';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { createViagensStyles } from '@/theme/screens/viagensStyles';
import { formatAddress, formatCurrencyMzn, getInitials } from '@/lib/formatMz';
import { isSupabaseConfigured } from '@/lib/env';
import { driverService } from '@/services/driverService';
import type { DriverTripListRow, TripDetails, TripPeriod } from '@/types/trip';

export default function ViagensScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createViagensStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const safeTop = useMemo(() => {
    const androidBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
    return Math.max(insets.top, androidBar);
  }, [insets.top]);
  const { session } = useAppAuth();
  const userId = session?.user?.id;

  const [stats, setStats] = useState({
    today_earnings: 0,
    today_trips: 0,
    week_earnings: 0,
    week_trips: 0,
    month_earnings: 0,
    month_trips: 0,
  });
  const [trips, setTrips] = useState<DriverTripListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TripPeriod>('today');
  const [selectedTrip, setSelectedTrip] = useState<TripDetails | { id: string } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async (initial = false) => {
      if (!userId || !isSupabaseConfigured) return;
      if (initial) setLoading(true);
      else setIsUpdating(true);
      setError(null);
      try {
        const statsPromise = driverService.getDriverStats(userId).catch((err) => {
          console.warn('[Viagens] stats', err);
          return null;
        });
        const tripsPromise = driverService.getDriverTrips(userId, period).catch((err) => {
          console.warn('[Viagens] trips', err);
          return [] as DriverTripListRow[];
        });
        const [driverStats, driverTrips] = await Promise.all([statsPromise, tripsPromise]);
        if (driverStats) setStats(driverStats);
        setTrips(driverTrips || []);
      } catch (err) {
        console.error('[Viagens]', err);
        setError('Não foi possível carregar o histórico de viagens.');
      } finally {
        if (initial) setLoading(false);
        else setIsUpdating(false);
      }
    },
    [userId, period],
  );

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    void loadData(true);
  }, [userId, isSupabaseConfigured]);

  /** Igual a `History.tsx` (web): segundo efeito só quando `period` muda e `loading` já é false. */
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    if (loading) return;
    void loadData(false);
  }, [period]);

  const onRefresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) return;
    setRefreshing(true);
    try {
      await loadData(false);
    } finally {
      setRefreshing(false);
    }
  }, [userId, loadData]);

  const handleTripClick = async (tripId: string) => {
    if (!userId) return;
    setLoadingDetails(true);
    setSelectedTrip({ id: tripId });
    try {
      const details = await driverService.getTripDetails(userId, tripId);
      setSelectedTrip(details);
    } catch (err) {
      console.error('[Viagens] details', err);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes da viagem.');
      setSelectedTrip(null);
    } finally {
      setLoadingDetails(false);
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

  if (loading) {
    return (
      <SafeAreaView style={screenWrap} edges={['left', 'right']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>A carregar histórico…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={screenWrap} edges={['left', 'right']}>
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle" size={40} color="#DC2626" />
          <Text style={styles.errTitle}>Ops, algo deu errado</Text>
          <Text style={styles.errSub}>{error}</Text>
          <Pressable
            onPress={() => {
              setError(null);
              void loadData(true);
            }}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.retryBtnText}>TENTAR NOVAMENTE</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const earnings =
    period === 'today' ? stats.today_earnings : period === 'week' ? stats.week_earnings : stats.month_earnings;
  const tripCount =
    period === 'today' ? stats.today_trips : period === 'week' ? stats.week_trips : stats.month_trips;

  const listTitle =
    period === 'today' ? 'VIAGENS DE HOJE' : period === 'week' ? 'VIAGENS DA SEMANA' : 'VIAGENS DO MÊS';

  return (
    <SafeAreaView style={screenWrap} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBlock}>
          <Text style={styles.pageTitle}>Painel de Desempenho</Text>
          <Text style={styles.pageSub}>RESUMO DE GANHOS E VIAGENS</Text>
        </View>

        <View style={styles.periodWrap}>
          {(['today', 'week', 'month'] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, period === p && styles.periodBtnOn]}
            >
              <Text style={[styles.periodLabel, period === p && styles.periodLabelOn]}>
                {p === 'today' ? 'HOJE' : p === 'week' ? 'SEMANA' : 'MÊS'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.statsGrid}>
          {isUpdating ? (
            <View style={styles.statsOverlay}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null}
          <View style={styles.statCard}>
            <View style={styles.statIconGreen}>
              <Ionicons name="cash-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.statKicker}>GANHOS</Text>
            <Text style={styles.statValue}>{formatCurrencyMzn(earnings)}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconBlue}>
              <Ionicons name="navigate-outline" size={18} color="#2563EB" />
            </View>
            <Text style={styles.statKicker}>VIAGENS</Text>
            <Text style={styles.statValue}>{tripCount}</Text>
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{listTitle}</Text>
          <View style={styles.badgeGreen}>
            <Text style={styles.badgeGreenText}>
              {trips.length} {trips.length === 1 ? 'CONCLUÍDA' : 'CONCLUÍDAS'}
            </Text>
          </View>
        </View>

        <View style={styles.listArea}>
          {isUpdating ? (
            <View style={styles.listOverlay}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null}
          {trips.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="time-outline" size={32} color="#CBD5E1" />
              <Text style={styles.emptyText}>NENHUMA VIAGEM NESTE PERÍODO</Text>
            </View>
          ) : (
            trips.map((trip) => {
              const tripDate = trip.completed_at ? new Date(trip.completed_at) : new Date(trip.created_at ?? 0);
              const value = trip.final_fare ?? trip.price_estimate ?? 0;
              const passengerName = 'Cliente';
              return (
                <Pressable
                  key={trip.id}
                  onPress={() => handleTripClick(trip.id)}
                  style={({ pressed }) => [styles.tripCard, pressed && { opacity: 0.96 }]}
                >
                  <View style={styles.tripTop}>
                    <View style={styles.tripLeft}>
                      <View style={styles.avatarSm}>
                        <Text style={styles.avatarSmText}>{getInitials(passengerName)}</Text>
                      </View>
                      <View>
                        <Text style={styles.clientName}>{passengerName}</Text>
                        <View style={styles.timeRow}>
                          <Ionicons name="time-outline" size={11} color="#94A3B8" />
                          <Text style={styles.timeText}>
                            {tripDate.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })} •{' '}
                            {tripDate.toLocaleDateString('pt-MZ')}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.tripRight}>
                      <Text style={styles.priceText}>{formatCurrencyMzn(Number(value))}</Text>
                      <View style={styles.paidBadge}>
                        <Ionicons name="checkmark-circle" size={11} color="#15803D" />
                        <Text style={styles.paidText}>PAGO</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.routeMini}>
                    <View style={styles.routeMiniRow}>
                      <View style={[styles.dotSm, styles.dotBlue]} />
                      <Text style={styles.routeMiniText} numberOfLines={2}>
                        {formatAddress(trip.pickup_address ?? '')}
                      </Text>
                    </View>
                    <View style={styles.routeMiniRow}>
                      <View style={[styles.dotSm, { backgroundColor: colors.accent }]} />
                      <Text style={styles.routeMiniText} numberOfLines={2}>
                        {formatAddress(trip.dropoff_address ?? '')}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <TripDetailsSheet
        visible={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        trip={
          selectedTrip && 'pickup_address' in selectedTrip && selectedTrip.pickup_address
            ? (selectedTrip as TripDetails)
            : null
        }
        loading={loadingDetails}
      />
    </SafeAreaView>
  );
}
