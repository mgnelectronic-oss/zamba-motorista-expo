import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/contexts/AppThemeContext';
import type { ActiveOfferUI } from '@/types/rideFlow';

type Props = {
  visible: boolean;
  offer: ActiveOfferUI | null;
  responding: boolean;
  onAccept: () => void;
  onReject: () => void;
  /** Chamado quando o tempo chega a zero — parar som imediatamente. */
  onExpireSound?: () => void;
  /** Após ~1s em «Tempo expirado» — fechar modal e limpar estado. */
  onExpireDismiss?: () => void;
};

type Phase = 'active' | 'expired';

export function NewRideOfferModal({
  visible,
  offer,
  responding,
  onAccept,
  onReject,
  onExpireSound,
  onExpireDismiss,
}: Props) {
  const { colors } = useAppTheme();
  const [phase, setPhase] = useState<Phase>('active');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [barColor, setBarColor] = useState(() => colors.accent);
  const phaseRef = useRef<Phase>('active');
  const expiredHandledRef = useRef(false);
  const backdropOpacity = useSharedValue(0);
  const progress = useSharedValue(1);

  phaseRef.current = phase;

  useEffect(() => {
    if (!offer) {
      expiredHandledRef.current = false;
      setPhase('active');
      return;
    }
    expiredHandledRef.current = false;
    setPhase('active');
    setBarColor(colors.accent);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só nova oferta (id); hydrate altera o objeto sem mudar id
  }, [offer?.id, colors.accent]);

  useEffect(() => {
    if (!offer || offer.status !== 'expired') return;
    if (expiredHandledRef.current) return;
    expiredHandledRef.current = true;
    setPhase('expired');
    setBarColor(colors.textMuted);
    onExpireSound?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id/status cobrem transições relevantes
  }, [offer?.id, offer?.status, onExpireSound, colors.textMuted]);

  useEffect(() => {
    if (phase !== 'expired') return;
    progress.value = 0;
    setBarColor(colors.textMuted);
    const t = setTimeout(() => onExpireDismiss?.(), 1000);
    return () => clearTimeout(t);
  }, [phase, onExpireDismiss, progress, colors.textMuted]);

  const tickOffer = useCallback(() => {
    if (!offer) return;
    const end = new Date(offer.expiresAt).getTime();
    const start = new Date(offer.offeredAt).getTime();
    const total = Math.max(1, end - start);
    const remMs = Math.max(0, end - Date.now());
    progress.value = remMs / total;
    setRemainingSeconds(Math.ceil(remMs / 1000));

    const pct = (remMs / total) * 100;
    if (phaseRef.current === 'expired' || offer.status === 'expired') {
      setBarColor(colors.textMuted);
    } else if (pct <= 30) {
      setBarColor(colors.danger);
    } else if (pct <= 60) {
      setBarColor('#EAB308');
    } else {
      setBarColor(colors.accent);
    }

    if (remMs <= 0 && phaseRef.current === 'active' && !expiredHandledRef.current) {
      expiredHandledRef.current = true;
      setPhase('expired');
      onExpireSound?.();
    }
  }, [offer, onExpireSound, colors.accent, colors.danger, colors.textMuted, progress]);

  useEffect(() => {
    if (!visible || !offer || offer.status !== 'pending') return;
    if (phase !== 'active') return;

    tickOffer();
    const id = setInterval(tickOffer, 16);
    return () => clearInterval(id);
  }, [visible, offer, phase, tickOffer]);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
    }
  }, [visible, backdropOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (!offer) return null;

  const show = visible && (offer.status === 'pending' || offer.status === 'expired');
  const pending = offer.status === 'pending' && phase === 'active';
  const showExpiredCopy = phase === 'expired' || offer.status === 'expired';

  const blurTint: 'dark' | 'light' = 'dark';

  return (
    <Modal visible={show} transparent animationType="none" statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
          {Platform.OS === 'web' ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.78)' }]} />
          ) : (
            <>
              <BlurView intensity={Platform.OS === 'ios' ? 55 : 42} tint={blurTint} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.38)' }]} />
            </>
          )}
        </Animated.View>

        <View style={styles.centerWrap} pointerEvents="box-none">
          <Animated.View
            entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
            style={{
              borderRadius: 28,
              overflow: 'hidden',
              backgroundColor: colors.modalBg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 22,
              paddingTop: 16,
              paddingBottom: 20,
            }}
          >
            <Animated.View
              entering={ZoomIn.duration(220).easing(Easing.out(Easing.cubic))}
              style={{ overflow: 'hidden' }}
            >
              <View
                style={{
                  height: 4,
                  width: '100%',
                  backgroundColor: colors.borderSubtle,
                  borderRadius: 2,
                  marginBottom: 12,
                  overflow: 'hidden',
                }}
              >
                <Animated.View
                  style={[
                    {
                      height: 4,
                      backgroundColor: barColor,
                      borderRadius: 2,
                      alignSelf: 'flex-start',
                    },
                    barStyle,
                  ]}
                />
              </View>

              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: colors.accentMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <Ionicons name="navigate" size={28} color={colors.accent} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                  {showExpiredCopy ? 'Tempo expirado' : 'Nova corrida!'}
                </Text>
                {!showExpiredCopy ? (
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      fontWeight: '800',
                      color: colors.accent,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {offer.vehicleCategory}
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: 12, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: colors.infoBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="location" size={16} color={colors.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8 }}>
                      PARTIDA
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {offer.origin.trim() || '—'}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: colors.accentMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="location" size={16} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8 }}>
                      DESTINO
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {offer.destination.trim() || '—'}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: colors.surfaceElevated,
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: colors.accentMuted,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {offer.passengerAvatar ? (
                    <Image
                      source={{ uri: offer.passengerAvatar }}
                      style={{ width: 48, height: 48 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.accent }}>
                      {(offer.passengerName || 'C').charAt(0)}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                    {offer.passengerName?.trim() || 'Cliente'}
                  </Text>
                  {offer.passengerPhone ? (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 }}>
                      {offer.passengerPhone}
                    </Text>
                  ) : null}
                </View>
              </View>

              {pending ? (
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <Pressable
                    onPress={onReject}
                    disabled={responding}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: responding ? 0.6 : 1,
                    }}
                  >
                    {responding ? (
                      <ActivityIndicator color={colors.textMuted} />
                    ) : (
                      <>
                        <Ionicons name="close" size={20} color={colors.textMuted} />
                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textSecondary }}>Recusar</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={onAccept}
                    disabled={responding}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 14,
                      backgroundColor: colors.accent,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: responding ? 0.85 : 1,
                    }}
                  >
                    {responding ? (
                      <ActivityIndicator color={colors.onAccent} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color={colors.onAccent} />
                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.onAccent }}>Aceitar</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : null}

              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 9,
                  fontWeight: '700',
                  color: colors.textMuted,
                  letterSpacing: 0.6,
                }}
              >
                {showExpiredCopy
                  ? 'A oferta já não está disponível'
                  : pending
                    ? `Expira em ${remainingSeconds} ${remainingSeconds === 1 ? 'segundo' : 'segundos'}`
                    : 'Esta oferta já não está disponível'}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});
