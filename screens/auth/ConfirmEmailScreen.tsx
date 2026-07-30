import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  getInstalledMailApps,
  openMailApp,
  openSpecificMailApp,
  type MailAppOption,
} from '../../lib/mailApp';
import type { AuthScreenProps } from '../../navigation/types';

/** How long to disable "Resend" for, so Supabase's rate limit isn't tripped. */
const RESEND_COOLDOWN_SECONDS = 60;

export default function ConfirmEmailScreen({ navigation, route }: AuthScreenProps<'ConfirmEmail'>) {
  const { email } = route.params;
  const { resendConfirmationEmail } = useAuth();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const { t } = useTranslation('auth');

  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [mailApps, setMailApps] = useState<MailAppOption[]>([]);
  const [showMailPicker, setShowMailPicker] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Coming back from the mail app is the most likely moment for confirmation
  // to have just happened, so re-check the session then. The deep link
  // handler in AuthContext covers the case where the link opened the app
  // directly; this covers the user confirming on another device or the link
  // opening in a browser instead.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void supabase.auth.refreshSession();
    });
    return () => subscription.remove();
  }, []);

  const handleOpenMail = async () => {
    // On iOS several clients may be installed and there's no system chooser,
    // so offer one. Android's APP_EMAIL intent already handles this natively.
    const installed = await getInstalledMailApps();
    if (installed.length > 1) {
      setMailApps(installed);
      setShowMailPicker(true);
      return;
    }

    const opened = await openMailApp();
    if (!opened) showToast(t('confirmEmail.errorNoMailApp'), 'info');
  };

  const handlePickMailApp = async (app: MailAppOption) => {
    setShowMailPicker(false);
    const opened = await openSpecificMailApp(app);
    if (!opened) showToast(t('confirmEmail.errorNoMailApp'), 'info');
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendConfirmationEmail(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      showToast(t('confirmEmail.resent'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('confirmEmail.errorResend'), 'error');
    } finally {
      setResending(false);
    }
  };

  // Manual escape hatch: if the session is now confirmed, AuthProvider's
  // listener swaps the navigator over automatically once it refreshes.
  const handleCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (!data.session?.user?.email_confirmed_at) {
        showToast(t('confirmEmail.notConfirmedYet'), 'info');
      }
    } catch {
      showToast(t('confirmEmail.notConfirmedYet'), 'info');
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
    >
      <View className="flex-1 justify-center">
        <View className="mb-6 h-14 w-14 items-center justify-center rounded-md bg-primary-50">
          <FontAwesome5 name="envelope-open-text" size={22} color="#1D4ED8" />
        </View>

        <Text className="mb-1 text-2xl font-bold text-gray-900">{t('confirmEmail.title')}</Text>
        <Text className="font-sans mb-2 text-base text-gray-500">
          {t('confirmEmail.subtitle')}
        </Text>
        <Text className="mb-8 text-base font-semibold text-gray-900">{email}</Text>

        <Button title={t('confirmEmail.openMailApp')} onPress={handleOpenMail} />

        <View className="mt-3">
          <Button
            title={t('confirmEmail.alreadyConfirmed')}
            variant="secondary"
            onPress={handleCheck}
            loading={checking}
          />
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-1">
          <Text className="font-sans text-sm text-gray-500">{t('confirmEmail.noEmail')}</Text>
          <Pressable onPress={handleResend} disabled={resending || cooldown > 0}>
            <Text
              className={`text-sm font-semibold ${
                resending || cooldown > 0 ? 'text-gray-400' : 'text-primary-600'
              }`}
            >
              {cooldown > 0 ? t('confirmEmail.resendIn', { seconds: cooldown }) : t('confirmEmail.resend')}
            </Text>
          </Pressable>
        </View>

        <Pressable className="mt-6 items-center" onPress={() => navigation.navigate('Login')}>
          <Text className="text-sm font-semibold text-gray-500">{t('confirmEmail.backToLogin')}</Text>
        </Pressable>
      </View>

      <BottomSheet visible={showMailPicker} onClose={() => setShowMailPicker(false)}>
        <Text className="mb-3 text-base font-semibold text-gray-900">
          {t('confirmEmail.chooseMailApp')}
        </Text>
        <View className="gap-2">
          {mailApps.map((app) => (
            <Pressable
              key={app.key}
              onPress={() => handlePickMailApp(app)}
              className="flex-row items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3.5 active:bg-gray-100"
            >
              <Text className="text-sm font-semibold text-gray-800">{app.label}</Text>
              <FontAwesome5 name="chevron-right" size={12} color="#9CA3AF" />
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </ScrollView>
  );
}
