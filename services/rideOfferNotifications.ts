import type { NotificationContentInput } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getRideAlertPreferences } from '@/services/rideAlertPreferences';

/** Canal Android — prioridade máxima, vibração e visibilidade na lock screen. */
export const RIDE_OFFER_CHANNEL_ID = 'ride-offers';

let channelReady = false;
let permissionsRequested = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Canal + permissões (Android 13+ / iOS). Idempotente.
 * Não altera o backend Supabase.
 */
export async function ensureRideOfferNotificationsReady(): Promise<void> {
  if (Platform.OS === 'web') return;

  if (Platform.OS === 'android' && !channelReady) {
    await Notifications.setNotificationChannelAsync(RIDE_OFFER_CHANNEL_ID, {
      name: 'Novas corridas',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      enableVibrate: true,
    });
    channelReady = true;
  }

  if (!permissionsRequested) {
    permissionsRequested = true;
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  }
}

/**
 * Notificação local imediata (app em background ou inativo): som e vibração via sistema.
 */
export async function notifyNewRideOfferLocal(): Promise<void> {
  if (Platform.OS === 'web') return;

  const prefs = await getRideAlertPreferences();
  if (!prefs.notifications_enabled) return;

  await ensureRideOfferNotificationsReady();

  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') return;

  const content: NotificationContentInput = {
    title: 'Nova corrida 🚗',
    body: 'Você tem uma nova solicitação',
    sound: 'default',
    ...(Platform.OS === 'android' && {
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  };
  if (prefs.vibration_enabled) {
    content.vibrate = [0, 500, 500];
  }

  await Notifications.scheduleNotificationAsync({
    content,
    trigger:
      Platform.OS === 'android'
        ? { channelId: RIDE_OFFER_CHANNEL_ID }
        : null,
  });
}
