import type { NotificationContentInput } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ensureRideOfferNotificationsReady } from '@/services/rideOfferNotifications';
import { getWebrtcCallPreferences } from '@/services/webrtcCallPreferences';

const ANDROID_NOTIF_CHANNEL_ID = 'ride-offers';

/**
 * Fallback quando o app está em segundo plano durante a fase «a tocar» — som do sistema.
 */
export async function notifyWebrtcIncomingCall(): Promise<void> {
  if (Platform.OS === 'web') return;

  const prefs = await getWebrtcCallPreferences();
  if (!prefs.webrtc_call_enabled) return;

  await ensureRideOfferNotificationsReady();

  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') return;

  const content: NotificationContentInput = {
    title: 'Chamada por internet',
    body: 'Toque para abrir a aplicação',
    sound: 'default',
    ...(Platform.OS === 'android' && {
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  };
  if (prefs.webrtc_call_vibration) {
    content.vibrate = [0, 400, 250, 400];
  }

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: Platform.OS === 'android' ? { channelId: ANDROID_NOTIF_CHANNEL_ID } : null,
  });
}
