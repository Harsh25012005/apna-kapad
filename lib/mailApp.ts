import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export type MailAppOption = {
  /** Stable id, also used as the translation key suffix. */
  key: string;
  label: string;
  url: string;
};

/**
 * iOS has no "open the user's mail app" intent, so the installed clients have
 * to be probed one by one. Each scheme here must also be declared in
 * app.config.js under ios.infoPlist.LSApplicationQueriesSchemes, otherwise
 * canOpenURL always answers false.
 */
const IOS_MAIL_APPS: MailAppOption[] = [
  { key: 'gmail', label: 'Gmail', url: 'googlegmail://' },
  { key: 'outlook', label: 'Outlook', url: 'ms-outlook://' },
  { key: 'yahoo', label: 'Yahoo Mail', url: 'ymail://' },
  { key: 'proton', label: 'Proton Mail', url: 'protonmail://' },
  { key: 'spark', label: 'Spark', url: 'readdle-spark://' },
  { key: 'appleMail', label: 'Mail', url: 'message://' },
];

/** Which mail clients are actually installed (iOS only; empty on Android). */
export async function getInstalledMailApps(): Promise<MailAppOption[]> {
  if (Platform.OS !== 'ios') return [];

  const checks = await Promise.all(
    IOS_MAIL_APPS.map(async (app) => {
      try {
        return (await Linking.canOpenURL(app.url)) ? app : null;
      } catch {
        return null;
      }
    })
  );

  return checks.filter((app): app is MailAppOption => app !== null);
}

/**
 * Opens the phone's mail app at its inbox.
 *
 * Android has a dedicated intent category for this, which hands off to the
 * user's default mail app — or shows the system chooser when several are
 * installed, which is exactly the behaviour we want.
 */
export async function openMailApp(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
        category: 'android.intent.category.APP_EMAIL',
        flags: 268435456, // FLAG_ACTIVITY_NEW_TASK
      });
      return true;
    } catch {
      // Fall through to mailto:, which most Android mail clients also claim.
    }

    try {
      await Linking.openURL('mailto:');
      return true;
    } catch {
      return false;
    }
  }

  // iOS: open the single installed client, or the first match as a default.
  // Callers that want to let the user pick should use getInstalledMailApps().
  const installed = await getInstalledMailApps();
  for (const app of installed) {
    try {
      await Linking.openURL(app.url);
      return true;
    } catch {
      // Try the next one.
    }
  }

  return false;
}

/** Opens one specific client, used by the picker sheet. */
export async function openSpecificMailApp(app: MailAppOption): Promise<boolean> {
  try {
    await Linking.openURL(app.url);
    return true;
  } catch {
    return false;
  }
}
