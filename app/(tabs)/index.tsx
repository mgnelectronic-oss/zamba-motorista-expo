import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/lib/supabase';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { OnlineButton } from '@/components/driver/OnlineButton';
import { driverService } from '@/services/driverService';
import type { DriverProfile, DriverWallet } from '@/types/driver';
import { MIN_BALANCE } from '@/types/driver';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { normalize } from '@/lib/responsive';
import { createDriverHomeStyles } from '@/theme/screens/driverHomeStyles';
import { useDriverOffers } from '@/hooks/useDriverOffers';
import { useDriverHomeBanners } from '@/hooks/useDriverHomeBanners';
import { NewRideOfferModal } from '@/components/ride/NewRideOfferModal';
import { DriverHomeBannerCarousel } from '@/components/driver/DriverHomeBannerCarousel';

/** Espelha `ScreenState` de `Zamba-Motorista-/src/pages/DriverHome.tsx`. */
type ScreenState =
  | 'loading'
  | 'error'
  | 'blocked'
  | 'new_driver'
  | 'pending_docs'
  | 'pending_review'
  | 'rejected'
  | 'blocked_insufficient_balance'
  | 'online_busy'
  | 'online_ready'
  | 'offline';

type GpsUi = 'idle' | 'active' | 'error' | 'denied';

function navSoon(feature: string) {
  Alert.alert('Navegação', `O ecrã «${feature}» será ligado na próxima fase do projeto Expo.`);
}

function StatusBanner({
  state,
  profile,
}: {
  state: ScreenState;
  profile: DriverProfile | null;
}) {
  const { colors } = useAppTheme();
  const { width: winW } = useWindowDimensions();
  const styles = useMemo(() => createDriverHomeStyles(colors, winW), [colors, winW]);
  const bannerIcon = useMemo(() => normalize(20, winW), [winW]);

  if (
    state === 'online_ready' ||
    state === 'online_busy' ||
    state === 'offline' ||
    state === 'loading' ||
    state === 'error' ||
    state === 'new_driver'
  ) {
    return null;
  }

  let title = '';
  let desc = '';
  let actionText = '';
  let onPress = () => navSoon('Ativação');

  let bg = '#FFF7ED';
  let border = '#FFEDD5';
  let titleC = '#9A3412';
  let descC = '#78716C';
  let iconBg = '#FFF';

  if (state === 'pending_docs') {
    title = 'Conta não verificada';
    desc = 'Complete o seu registo e carregue os documentos para ativar a conta';
    actionText = 'Completar registo';
    onPress = () => navSoon('Ativação da conta');
  } else if (state === 'pending_review') {
    title = 'Conta em análise';
    desc = 'Os seus documentos estão a ser analisados. Aguarde a aprovação.';
    actionText = 'Ver status';
    onPress = () => navSoon('Estado da conta');
    bg = '#EFF6FF';
    border = '#DBEAFE';
    titleC = '#1E3A8A';
    descC = '#64748B';
  } else if (state === 'rejected') {
    title = 'Conta rejeitada';
    desc = profile?.rejection_reason || 'Houve um problema com os seus documentos.';
    actionText = 'Corrigir e reenviar';
    onPress = () => navSoon('Ativação da conta');
    bg = '#FEF2F2';
    border = '#FECACA';
    titleC = '#991B1B';
    descC = '#78716C';
  } else if (state === 'blocked') {
    title = 'Conta bloqueada';
    desc = 'A sua conta foi suspensa. Contacte o suporte.';
    actionText = 'Suporte';
    onPress = () => navSoon('Definições');
    bg = '#FEF2F2';
    border = '#FECACA';
    titleC = '#991B1B';
  } else if (state === 'blocked_insufficient_balance') {
    title = 'Saldo insuficiente';
    desc = 'Recarregue a sua carteira para poder operar.';
    actionText = 'Recarregar';
    onPress = () => router.push('./saldo');
  } else {
    return null;
  }

  return (
    <View style={[styles.bannerRow, { backgroundColor: bg, borderColor: border }]}>
      <View style={[styles.bannerIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name="alert-circle" size={bannerIcon} color={titleC} />
      </View>
      <View style={styles.bannerTextCol}>
        <Text style={[styles.bannerTitle, { color: titleC }]} allowFontScaling={false}>
          {title}
        </Text>
        <Text style={[styles.bannerDesc, { color: descC }]} allowFontScaling={false}>
          {desc}
        </Text>
      </View>
      <Pressable onPress={onPress} style={styles.bannerBtn}>
        <Text style={styles.bannerBtnText} allowFontScaling={false}>
          {actionText}
        </Text>
      </Pressable>
    </View>
  );
}

export default function DriverHomeScreen() {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => createDriverHomeStyles(colors, windowWidth), [colors, windowWidth]);
  const scrollPad = useMemo(() => normalize(20, windowWidth), [windowWidth]);
  const cardIconMd = useMemo(() => normalize(32, windowWidth), [windowWidth]);
  const cardIconSm = useMemo(() => normalize(28, windowWidth), [windowWidth]);
  const gpsWarnIcon = useMemo(() => normalize(20, windowWidth), [windowWidth]);
  const primaryBtnIcon = useMemo(() => normalize(16, windowWidth), [windowWidth]);

  const insets = useSafeAreaInsets();
  /**
   * Inset superior real: com `android.edgeToEdgeEnabled` o conteúdo vai até sob a status bar.
   * Em alguns dispositivos `insets.top` pode vir 0; no Android usamos `StatusBar.currentHeight`
   * como mínimo absoluto (documentação RN / edge-to-edge).
   */
  const safeTop = useMemo(() => {
    const androidStatus =
      Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
    return Math.max(insets.top, androidStatus);
  }, [insets.top]);

  const { session, userProfile: ctxProfile, refreshState } = useAppAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const isTogglingRef = useRef(false);
  /** Invalida `setIsOnline` vindos de pedidos `loadData` antigos após escrita bem-sucedida do toggle (evita corrida). */
  const onlineSyncGenRef = useRef(0);
  const isMountedRef = useRef(true);
  const [isBusy, setIsBusy] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsUi>('idle');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setProfile(ctxProfile);
  }, [ctxProfile]);

  const userId = session?.user?.id;

  const stopGpsTracking = useCallback(() => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    setGpsStatus('idle');
  }, []);

  const startGpsTracking = useCallback(
    async (uid: string) => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const ask = await Location.requestForegroundPermissionsAsync();
          if (ask.status !== 'granted') {
            setGpsStatus('denied');
            return;
          }
        }

        locationSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 15,
          },
          (pos) => {
            const { latitude, longitude } = pos.coords;
            lastCoordsRef.current = { lat: latitude, lng: longitude };
            setGpsStatus('active');
          },
        );

        if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = setInterval(async () => {
          if (!lastCoordsRef.current || !uid) return;
          const { lat, lng } = lastCoordsRef.current;
          try {
            await driverService.updateCurrentLocation(uid, lat, lng);
          } catch {
            /* silencioso — igual ao web em falhas pontuais */
          }
        }, 10000);
      } catch {
        setGpsStatus('error');
      }
    },
    [],
  );

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('TIMEOUT')), ms);
        promise
          .then((v) => {
            clearTimeout(t);
            resolve(v);
          })
          .catch((e) => {
            clearTimeout(t);
            reject(e);
          });
      });

    const loadData = async (isBackgroundRefresh = false, retryCount = 0) => {
      if (!isMounted) return;

      const fetchGenAtStart = onlineSyncGenRef.current;

      if (!isBackgroundRefresh && retryCount === 0 && !profile) {
        setIsLoading(true);
      }

      try {
        setError(null);

        const [p, w] = (await withTimeout(
          Promise.all([driverService.getProfile(userId), driverService.getWallet(userId)]),
          15000,
        )) as [DriverProfile | null, DriverWallet | null];

        if (!isMounted) return;
        setProfile(p);
        setWallet(w);

        if (!isTogglingRef.current && fetchGenAtStart === onlineSyncGenRef.current) {
          setIsOnline(p?.is_online || false);
        }

        const activeRide = await withTimeout(driverService.getActiveRide(p?.id || '', userId), 15000);

        if (!isMounted) return;
        if (activeRide) {
          setIsBusy(true);
          setCurrentRideId(activeRide.id);
        } else {
          setIsBusy(false);
          setCurrentRideId(null);
          if (p?.is_busy) {
            await driverService.setBusyStatus(userId, false);
          }
        }

        const approved =
          p?.account_status === 'active' &&
          (p?.verification_status === 'approved' || p?.verification_status === 'verified');

        if (p?.is_online && approved) {
          void startGpsTracking(userId);
        } else {
          stopGpsTracking();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'TIMEOUT') {
          if (retryCount < 2) {
            return loadData(isBackgroundRefresh, retryCount + 1);
          }
          if (isMounted) setError('Tempo limite de conexão excedido. Verifique a sua internet.');
        } else if (retryCount < 1) {
          return loadData(isBackgroundRefresh, retryCount + 1);
        } else if (isMounted) {
          setError(msg || 'Erro ao carregar dados');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadData();

    const profileChannel = supabase
      .channel('driver_profile_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const row = payload.new as DriverProfile;
          setProfile(row);
          if (!isTogglingRef.current) setIsOnline(row.is_online);
          setIsBusy(row.is_busy);
        },
      )
      .subscribe();

    const walletChannel = supabase
      .channel('driver_wallet_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_wallets' },
        () => {
          if (!isMounted) return;
          void driverService.getWallet(userId).then((wal) => {
            if (isMounted) setWallet(wal);
          });
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      stopGpsTracking();
      void supabase.removeChannel(profileChannel);
      void supabase.removeChannel(walletChannel);
    };
  }, [userId, reloadTrigger, startGpsTracking, stopGpsTracking]);

  useEffect(() => {
    if (!isBusy || isResuming || !userId) return;
    const rideId = currentRideId;
    if (rideId) {
      router.replace({ pathname: '/driver/active', params: { ride_id: rideId } } as never);
      return;
    }
    setIsResuming(true);
    driverService
      .getActiveRide(profile?.id || '', userId)
      .then((ride) => {
        if (ride) {
          setCurrentRideId(ride.id);
          router.replace({ pathname: '/driver/active', params: { ride_id: ride.id } } as never);
        }
      })
      .finally(() => setIsResuming(false));
  }, [isBusy, currentRideId, userId, profile?.id, isResuming]);

  const screenState = useMemo((): ScreenState => {
    if (isLoading && !profile) return 'loading';
    if (error) return 'error';
    if (!profile) return 'new_driver';
    if (profile.is_blocked) return 'blocked';

    const verificationStatus =
      profile.verification_status || profile.approval_status || 'pending_documents';

    if (verificationStatus === 'rejected') return 'rejected';
    if (verificationStatus === 'pending_documents' || profile.account_status === 'incomplete') {
      return 'pending_docs';
    }
    if (verificationStatus === 'pending_review' || verificationStatus === 'pending') {
      return 'pending_review';
    }

    if (!wallet) return 'loading';
    if (wallet.balance < MIN_BALANCE) return 'blocked_insufficient_balance';
    if (isBusy || currentRideId) return 'online_busy';
    if (isOnline) return 'online_ready';
    return 'offline';
  }, [isLoading, error, profile, wallet, isBusy, currentRideId, isOnline]);

  const isApproved =
    profile?.account_status === 'active' &&
    (profile?.verification_status === 'approved' || profile?.verification_status === 'verified');

  const offersListening =
    !!userId &&
    !!profile?.id &&
    isApproved &&
    isOnline &&
    screenState === 'online_ready';

  const onAcceptedGoToRide = useCallback((id: string, pickup?: { lat: number; lng: number }) => {
    const hasPickup =
      pickup &&
      Number.isFinite(pickup.lat) &&
      Number.isFinite(pickup.lng) &&
      pickup.lat >= -90 &&
      pickup.lat <= 90 &&
      pickup.lng >= -180 &&
      pickup.lng <= 180;
    router.replace({
      pathname: '/driver/active',
      params: {
        ride_id: id,
        ...(hasPickup ? { pickup_lat: String(pickup.lat), pickup_lng: String(pickup.lng) } : {}),
      },
    } as never);
  }, []);

  const { activeOffer, responding, accept, reject, dismissOffer, onOfferExpireSound } = useDriverOffers({
    userId,
    driverId: profile?.id,
    listening: offersListening,
    onAcceptedGoToRide,
  });

  const { carouselSettings, banners: promoBanners, loading: promoBannersLoading } =
    useDriverHomeBanners(isApproved);

  const toggleOnline = async () => {
    if (!userId) return;
    if (isTogglingRef.current || (screenState !== 'offline' && screenState !== 'online_ready')) return;

    const hasCategory = !!profile?.vehicle_category;
    const hasBalance = (wallet?.balance || 0) >= MIN_BALANCE;

    if (!hasCategory) {
      navSoon('Perfil (categoria)');
      return;
    }
    if (!hasBalance) {
      router.push('./saldo');
      return;
    }

    const nextStatus = !isOnline;
    setIsToggling(true);
    isTogglingRef.current = true;

    try {
      const TOGGLE_MS = 20000;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('TIMEOUT')), TOGGLE_MS);
        void driverService
          .setOnlineStatus(userId, nextStatus)
          .then(() => {
            clearTimeout(t);
            resolve();
          })
          .catch((e) => {
            clearTimeout(t);
            reject(e instanceof Error ? e : new Error(String(e)));
          });
      });
      onlineSyncGenRef.current += 1;
      if (isMountedRef.current) setIsOnline(nextStatus);
      if (nextStatus) {
        /** Não bloquear o desbloqueio do botão se o GPS demorar ou falhar silenciosamente */
        void startGpsTracking(userId).catch(() => {
          if (isMountedRef.current) setGpsStatus('error');
        });
      } else {
        stopGpsTracking();
      }
      if (isMountedRef.current) {
        void refreshState(true);
      }
    } catch (e) {
      if (__DEV__) console.warn('[DriverHome] setOnlineStatus', e);
      if (isMountedRef.current) {
        const msg =
          e instanceof Error && e.message === 'TIMEOUT'
            ? 'Tempo limite esgotado. Verifique a rede e tente novamente.'
            : 'Não foi possível atualizar o seu estado. Tente novamente.';
        Alert.alert('Estado', msg);
      }
    } finally {
      isTogglingRef.current = false;
      if (isMountedRef.current) setIsToggling(false);
    }
  };

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={[styles.safeMain, { paddingTop: safeTop }]} edges={['left', 'right']}>
        <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText} allowFontScaling={false}>
          A preparar o seu painel…
        </Text>
        </View>
      </SafeAreaView>
    );
  }

  const cardTitleApproved = isResuming
    ? 'A restaurar…'
    : screenState === 'online_busy'
      ? 'Em corrida'
      : isOnline
        ? 'Ativo e Pronto'
        : 'Indisponível';

  const cardSubApproved = isResuming
    ? 'A carregar detalhes da viagem ativa…'
    : screenState === 'online_busy'
      ? 'Finalize a viagem atual para receber novas solicitações.'
      : isOnline
        ? 'Você está pronto para receber novas solicitações.'
        : 'Ative o botão abaixo para começar a receber corridas.';

  const homeCardBody = (
    <>
      <Text style={styles.cardTitle} allowFontScaling={false}>
        {cardTitleApproved}
      </Text>
      <Text style={styles.cardSub} allowFontScaling={false}>
        {cardSubApproved}
      </Text>

      <View style={styles.powerWrap}>
        {screenState === 'online_busy' ? (
          isResuming ? (
            <ActivityIndicator
              size="large"
              color={colors.accent}
              style={{ marginVertical: normalize(24, windowWidth) }}
            />
          ) : (
            <View style={styles.busyOuter}>
              <View style={styles.busyRing} />
              <View style={styles.busyInner}>
                <Ionicons name="navigate" size={cardIconMd} color="#FFF" />
              </View>
            </View>
          )
        ) : (
          <OnlineButton
            isOnline={isOnline}
            isToggling={isToggling}
            disabled={isToggling || (screenState !== 'offline' && screenState !== 'online_ready')}
            onPress={toggleOnline}
            loading={isResuming}
          />
        )}
      </View>

      {screenState === 'online_busy' && !isResuming ? (
        <Pressable
          onPress={() => {
            const id = currentRideId;
            if (id) {
              router.push({ pathname: '/driver/active', params: { ride_id: id } } as never);
            } else {
              setIsResuming(true);
              driverService
                .getActiveRide(profile?.id || '', userId || '')
                .then((ride) => {
                  if (ride) {
                    router.push({ pathname: '/driver/active', params: { ride_id: ride.id } } as never);
                  }
                })
                .finally(() => setIsResuming(false));
            }
          }}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.rowCenter}>
            <Ionicons name="navigate" size={primaryBtnIcon} color="#FFF" />
            <Text
              style={[styles.primaryBtnText, { marginLeft: normalize(8, windowWidth) }]}
              allowFontScaling={false}
            >
              Retomar corrida
            </Text>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.statusChip, !isOnline && styles.statusChipMuted]}>
          <View
            style={[
              styles.statusDot,
              isOnline ? styles.statusDotOn : styles.statusDotOff,
            ]}
          />
          <Text
            style={[styles.statusChipText, isOnline ? styles.statusChipTextOn : styles.statusChipTextOff]}
            allowFontScaling={false}
          >
            {isOnline ? 'ATIVO E PRONTO' : 'INDISPONÍVEL'}
          </Text>
        </View>
      )}
    </>
  );

  if (!isApproved) {
    return (
      <SafeAreaView style={[styles.safeMain, { paddingTop: safeTop }]} edges={['left', 'right']}>
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: normalize(12, windowWidth),
              paddingBottom: insets.bottom + normalize(24, windowWidth),
              paddingLeft: scrollPad,
              paddingRight: scrollPad,
              minHeight: '100%',
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.card}>
          {screenState === 'new_driver' ? (
            <>
              <View style={styles.iconCircleBlue}>
                <Ionicons name="person-remove-outline" size={cardIconMd} color="#2563EB" />
              </View>
              <Text style={styles.cardTitle} allowFontScaling={false}>
                Perfil de motorista não encontrado
              </Text>
              <Text style={styles.cardSub} allowFontScaling={false}>
                Não foi possível carregar o seu registo de motorista. Verifique a ligação ou complete o
                registo na versão web. Se o problema continuar, contacte o suporte.
              </Text>
              <Pressable
                onPress={() => setReloadTrigger((n) => n + 1)}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.primaryBtnText} allowFontScaling={false}>
                  Tentar novamente
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.iconCircleBlue}>
                <Ionicons name="shield-checkmark" size={cardIconMd} color="#2563EB" />
              </View>
              <Text style={styles.cardTitle} allowFontScaling={false}>
                Verifique a sua conta
              </Text>
              <Text style={styles.cardSub} allowFontScaling={false}>
                A sua conta ainda não está pronta para receber corridas. Conclua a verificação para começar a
                operar.
              </Text>
              <Pressable
                onPress={() => router.push('/activation')}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.primaryBtnText} allowFontScaling={false}>
                  Completar verificação
                </Text>
              </Pressable>
            </>
          )}
        </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeMain, { paddingTop: safeTop }]} edges={['left', 'right']}>
      <View style={styles.approvedRoot}>
        {/* Altura sempre reservada: evita salto vertical banner/card ao alternar offline ↔ online */}
        <View style={styles.gpsRowSlot}>
          {(screenState === 'online_ready' || screenState === 'online_busy') ? (
            <View style={styles.gpsPill}>
              <View
                style={[
                  styles.gpsDot,
                  {
                    backgroundColor:
                      gpsStatus === 'active' ? '#22C55E' : gpsStatus === 'denied' ? '#F97316' : '#EF4444',
                  },
                ]}
              />
              <Text style={styles.gpsPillText} allowFontScaling={false}>
                {gpsStatus === 'active'
                  ? 'GPS ATIVO'
                  : gpsStatus === 'denied'
                    ? 'GPS NEGADO'
                    : 'ERRO GPS'}
              </Text>
            </View>
          ) : null}
        </View>

        {gpsStatus === 'denied' && isOnline && (
          <View style={styles.gpsWarn}>
            <Ionicons name="alert-circle" size={gpsWarnIcon} color="#C2410C" />
            <View style={{ flex: 1 }}>
              <Text style={styles.gpsWarnTitle} allowFontScaling={false}>
                Localização desativada
              </Text>
              <Text style={styles.gpsWarnSub} allowFontScaling={false}>
                Ative a localização para receber corridas.
              </Text>
            </View>
          </View>
        )}

        <StatusBanner state={screenState} profile={profile} />

        {!promoBannersLoading ? (
          <DriverHomeBannerCarousel
            banners={promoBanners}
            carouselSettings={carouselSettings}
            styles={styles}
          />
        ) : null}

        <NewRideOfferModal
          visible={offersListening && !!activeOffer}
          offer={activeOffer}
          responding={responding}
          onAccept={accept}
          onReject={reject}
          onExpireSound={onOfferExpireSound}
          onExpireDismiss={dismissOffer}
        />

        <View style={styles.cardCenterWrap}>
          <View style={styles.card}>
            {screenState === 'error' ? (
              <>
                <View style={styles.iconCircleRed}>
                  <Ionicons name="alert-circle" size={cardIconSm} color="#DC2626" />
                </View>
                <Text style={styles.cardTitle} allowFontScaling={false}>
                  Erro de conexão
                </Text>
                <Text style={styles.errorText} allowFontScaling={false}>
                  {error || 'Não foi possível carregar os dados.'}
                </Text>
                <Pressable
                  onPress={() => setReloadTrigger((n) => n + 1)}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.secondaryBtnText} allowFontScaling={false}>
                    Tentar novamente
                  </Text>
                </Pressable>
              </>
            ) : (
              homeCardBody
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
