import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar, Card, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAppGuide } from '../../context/AppGuideContext';
import { useTheme } from '../../context/ThemeContext';
import { haptics } from '../../lib/haptics';
import { setAppLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '../../lib/i18n';
import { THEME_MODES, type ThemeMode } from '../../lib/theme';
import type { SettingsScreenProps } from '../../navigation/types';

const LANGUAGE_LABEL_KEY: Record<AppLanguage, string> = {
  en: 'language.english',
  gu: 'language.gujarati',
  hi: 'language.hindi',
};

const THEME_LABEL_KEY: Record<ThemeMode, string> = {
  light: 'themeLight',
  dark: 'themeDark',
  system: 'themeSystem',
};

export default function SettingsScreen({ navigation }: SettingsScreenProps<'SettingsHome'>) {
  const { shop, user, signOut } = useAuth();
  const { openGuide } = useAppGuide();
  const { mode, setMode } = useTheme();
  const showToast = useToast();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(['settings', 'common']);
  const currentLanguage = (i18n.language as AppLanguage) || 'en';

  const changeLanguage = async (language: AppLanguage) => {
    haptics.tap();
    try {
      await setAppLanguage(language);
    } catch {
      showToast(t('errorChangeLanguage'), 'error');
    }
  };

  const changeTheme = (next: ThemeMode) => {
    haptics.tap();
    void setMode(next);
  };

  const confirmSignOut = () => {
    haptics.warning();
    Alert.alert(t('signOutConfirmTitle'), t('signOutConfirmMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            showToast(err instanceof Error ? err.message : t('errorSignOut'), 'error');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-950"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 160, gap: 20 }}
    >
      <View className="py-2">
        <Text className="text-[18px] font-semibold text-[#101828] dark:text-gray-50">{t('title')}</Text>
      </View>

      {/* Profile hero card */}
      <View className="items-center rounded-xl bg-[#101828] px-5 py-7 dark:border dark:border-gray-700">
        <Pressable
          onPress={() => navigation.navigate('ShopEdit')}
          hitSlop={8}
          className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
        >
          <FontAwesome5 name="pen" size={13} color="#FFFFFF" />
        </Pressable>
        {shop?.logo_url ? (
          <Image
            source={{ uri: shop.logo_url }}
            className="h-20 w-20 rounded-full border-2 border-white/20"
          />
        ) : (
          <Avatar name={shop?.shop_name} size="lg" />
        )}
        <Text className="mt-3 text-lg font-semibold text-white">{shop?.shop_name}</Text>
        {shop?.owner_name ? (
          <View className="mt-1.5 flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
            <FontAwesome5 name="user" size={10} color="#98A2B3" />
            <Text className="font-sans text-xs font-medium text-[#D0D5DD]">{shop.owner_name}</Text>
          </View>
        ) : null}
        <Text className="font-sans mt-2 text-xs text-[#667085]">{user?.email}</Text>
      </View>

      {/* Business section */}
      <SectionCard title={t('business')}>
        <MenuRow
          icon="file-invoice-dollar"
          iconBg="bg-blue-50 dark:bg-blue-950"
          iconColor="#1D4ED8"
          label={t('billingAndPayments')}
          onPress={() => navigation.navigate('Billing')}
        />
        <MenuRow
          icon="chart-line"
          iconBg="bg-emerald-50 dark:bg-emerald-950"
          iconColor="#047857"
          label={t('revenue:menuTitle')}
          onPress={() => navigation.navigate('Revenue')}
        />
        <MenuRow
          icon="user-friends"
          iconBg="bg-purple-50 dark:bg-purple-950"
          iconColor="#7C3AED"
          label={t('staffManagement')}
          onPress={() => navigation.navigate('Staff')}
          isLast
        />
      </SectionCard>

      {/* Appearance section */}
      <SectionCard title={t('appearance')}>
        <View className="flex-row gap-2 py-3">
          {THEME_MODES.map((themeMode) => {
            const active = themeMode === mode;
            return (
              <Pressable
                key={themeMode}
                onPress={() => changeTheme(themeMode)}
                className={`flex-1 items-center rounded-md border py-2.5 ${
                  active
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-950'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                }`}
              >
                <Text
                  className={`font-sans text-sm font-medium ${
                    active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {t(THEME_LABEL_KEY[themeMode])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      {/* Language section */}
      <SectionCard title={t('common:language.title')}>
        <View className="flex-row gap-2 py-3">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const active = lang === currentLanguage;
            return (
              <Pressable
                key={lang}
                onPress={() => changeLanguage(lang)}
                className={`flex-1 items-center rounded-md border py-2.5 ${
                  active
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-950'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                }`}
              >
                <Text
                  className={`font-sans text-sm font-medium ${
                    active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {t(`common:${LANGUAGE_LABEL_KEY[lang]}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      {/* Help section */}
      <SectionCard title={t('help')}>
        <MenuRow icon="compass" iconBg="bg-emerald-50 dark:bg-emerald-950" iconColor="#047857" label={t('howToUse')} onPress={openGuide} isLast />
      </SectionCard>

      <Pressable
        onPress={confirmSignOut}
        className="flex-row items-center justify-center rounded-md border border-red-100 bg-red-50 py-3.5 active:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:active:bg-red-900"
      >
        <FontAwesome5 name="sign-out-alt" size={14} color="#DC2626" />
        <Text className="ml-2 text-sm font-semibold text-danger">{t('signOut')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {title}
      </Text>
      <Card>{children}</Card>
    </View>
  );
}

function MenuRow({
  icon,
  iconBg = 'bg-gray-100 dark:bg-gray-800',
  iconColor = '#6B7280',
  label,
  value,
  onPress,
  isLast = false,
}: {
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  iconBg?: string;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const className = `flex-row items-center justify-between py-3.5 ${
    isLast ? '' : 'border-b border-gray-100 dark:border-gray-800'
  }`;

  const content: ReactNode = (
    <>
      <View className="flex-row items-center">
        <View className={`h-9 w-9 items-center justify-center rounded-md ${iconBg}`}>
          <FontAwesome5 name={icon} size={14} color={iconColor} />
        </View>
        <Text className="font-sans ml-3 text-sm font-medium text-gray-800 dark:text-gray-200">{label}</Text>
      </View>
      {value ? (
        <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{value}</Text>
      ) : onPress ? (
        <FontAwesome5 name="chevron-right" size={12} color="#9CA3AF" />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={className}>
        {content}
      </Pressable>
    );
  }
  return <View className={className}>{content}</View>;
}
