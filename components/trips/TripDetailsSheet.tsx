import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TripDetails } from '@/types/trip';
import type { ThemeColors } from '@/theme/types';
import { formatAddress, formatCurrencyMzn, getInitials } from '@/lib/formatMz';
import { useAppTheme } from '@/contexts/AppThemeContext';

function statusBadgeLabel(status: string | null | undefined): string {
  switch (status) {
    case 'completed':
      return 'CONCLUÍDA';
    case 'cancelled':
      return 'CANCELADA';
    case 'ontrip':
      return 'EM VIAGEM';
    default:
      return (status ?? '—').toUpperCase();
  }
}

export type TripDetailsSheetProps = {
  visible: boolean;
  onClose: () => void;
  trip: TripDetails | null;
  loading: boolean;
};

export function TripDetailsSheet({ visible, onClose, trip, loading }: TripDetailsSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createTripDetailsStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const passenger = trip?.passenger;
  const p = Array.isArray(passenger) ? passenger[0] : passenger;
  const showContent = !loading && trip && trip.pickup_address;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8, backgroundColor: colors.modalBg }]}
          pointerEvents="box-none"
        >
          <View style={styles.handle} />
          {loading || !showContent ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>CARREGANDO DETALHES...</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollInner}
            >
              <View style={styles.headerRow}>
                <View style={styles.headerTextCol}>
                  <Text style={styles.title}>Detalhes da Viagem</Text>
                  <Text style={styles.dateLine}>
                    {new Date(trip.created_at).toLocaleDateString('pt-MZ')} •{' '}
                    {new Date(trip.created_at).toLocaleTimeString('pt-MZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar"
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.cardMuted}>
                <View style={styles.clientRow}>
                  {p?.avatar_url ? (
                    <Image
                      source={{ uri: p.avatar_url }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>{getInitials(p?.full_name)}</Text>
                    </View>
                  )}
                  <View style={styles.clientText}>
                    <Text style={styles.kicker}>CLIENTE</Text>
                    <Text style={styles.clientName}>{p?.full_name || 'Desconhecido'}</Text>
                  </View>
                  {p?.phone ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${p.phone}`)}
                      style={({ pressed }) => [styles.phoneBtn, pressed && { opacity: 0.9 }]}
                    >
                      <Ionicons name="call" size={17} color={colors.accent} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <Text style={styles.sectionKicker}>ROTA DA VIAGEM</Text>
              <View style={styles.routeCard}>
                <View style={styles.routeLine} />
                <View style={styles.routeBlock}>
                  <View style={[styles.dot, styles.dotBlue]} />
                  <View>
                    <Text style={styles.routeLabel}>ORIGEM</Text>
                    <Text style={styles.routeAddr}>{formatAddress(trip.pickup_address)}</Text>
                  </View>
                </View>
                <View style={styles.routeBlock}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <View>
                    <Text style={styles.routeLabel}>DESTINO</Text>
                    <Text style={styles.routeAddr}>{formatAddress(trip.dropoff_address)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.valueRow}>
                <View>
                  <Text style={styles.kicker}>VALOR FINAL</Text>
                  <View style={styles.badgeRow}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                    <Text style={styles.badgeText}>{statusBadgeLabel(trip.status)}</Text>
                  </View>
                </View>
                <Text style={[styles.bigValue, { color: colors.accent }]}>
                  {formatCurrencyMzn(trip.final_fare ?? trip.price_estimate ?? 0)}
                </Text>
              </View>

              <View style={styles.techWrap}>
                <Text style={styles.sectionKickerMuted}>INFORMAÇÕES TÉCNICAS</Text>
                <Text style={styles.mono} selectable>
                  ID: {trip.id}
                </Text>
                <Text style={styles.mono} selectable>
                  Criada: {new Date(trip.created_at).toLocaleString('pt-MZ')}
                </Text>
                {trip.completed_at ? (
                  <Text style={styles.mono} selectable>
                    Concluída: {new Date(trip.completed_at).toLocaleString('pt-MZ')}
                  </Text>
                ) : null}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createTripDetailsStyles(c: ThemeColors) {
  return StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: 18,
    paddingTop: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 20 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  scrollInner: {
    paddingBottom: 18,
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: '600',
    color: c.textSecondary,
    letterSpacing: 0.8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.2,
  },
  dateLine: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: c.textSecondary,
    lineHeight: 17,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMuted: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.borderSubtle,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: c.textSecondary,
  },
  clientText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 9,
    fontWeight: '700',
    color: c.textSecondary,
    letterSpacing: 0.85,
    marginBottom: 3,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    lineHeight: 20,
  },
  phoneBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionKicker: {
    fontSize: 9,
    fontWeight: '800',
    color: c.textSecondary,
    letterSpacing: 0.95,
    marginBottom: 8,
  },
  sectionKickerMuted: {
    fontSize: 9,
    fontWeight: '700',
    color: c.textSecondary,
    letterSpacing: 0.65,
    marginBottom: 6,
  },
  routeCard: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    position: 'relative',
  },
  routeLine: {
    position: 'absolute',
    left: 18,
    top: 22,
    bottom: 22,
    width: 2,
    backgroundColor: c.tripDetailRouteLine,
    borderRadius: 1,
  },
  routeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    zIndex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 2,
    borderWidth: 2,
    borderColor: c.surfaceElevated,
  },
  dotBlue: { backgroundColor: c.info },
  routeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: c.textSecondary,
    letterSpacing: 0.65,
    marginBottom: 3,
  },
  routeAddr: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text,
    lineHeight: 18,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    backgroundColor: c.successBg,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: c.success,
    letterSpacing: 0.45,
  },
  bigValue: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 24,
  },
  techWrap: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    gap: 6,
  },
  mono: {
    fontSize: 10,
    lineHeight: 15,
    color: c.textSecondary,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
}
