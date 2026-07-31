import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Registration is retried on every login/shop-load, but a missing FCM
// (google-services.json) config never resolves itself mid-session — so
// without this, the exact same warning would repeat on every auth event.
let loggedMissingFcmConfig = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for push and stores the Expo push token against the
 * shop so the send-push Edge Function can look it up. No-ops in Expo Go
 * (SDK 53+ dropped remote push there) and on simulators (no push capability),
 * and never throws — a failed registration shouldn't block app usage.
 */
export async function registerForPushNotifications(shopId: string): Promise<void> {
  if (isExpoGo || !Device.isDevice) return;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await supabase.from('device_tokens').upsert(
      { shop_id: shopId, expo_push_token: token, platform: Platform.OS },
      { onConflict: 'shop_id,expo_push_token' }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Firebase') || message.includes('FirebaseApp')) {
      // Expected until a Firebase project + google-services.json are wired
      // up for this app (https://docs.expo.dev/push-notifications/fcm-credentials/).
      // Logged once per session instead of on every login so it doesn't spam.
      if (!loggedMissingFcmConfig) {
        loggedMissingFcmConfig = true;
        console.log('[push] Android push disabled: no FCM credentials configured yet.');
      }
      return;
    }
    console.warn('[push] registration failed:', err);
  }
}
