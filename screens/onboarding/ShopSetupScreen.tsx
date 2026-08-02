import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, ImagePickerField, InputField, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../lib/storage';
import { setAppLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '../../lib/i18n';

type ShopSetupErrors = { shopName?: string; ownerName?: string };

/** Endonyms — deliberately not translated, each option shows its own script. */
const LANGUAGE_ENDONYMS: Record<AppLanguage, string> = {
  en: 'English',
  gu: 'ગુજરાતી',
  hi: 'हिन्दी',
};

export default function ShopSetupScreen() {
  const { user, refreshShop } = useAuth();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const { t, i18n } = useTranslation('auth');
  const currentLanguage = (i18n.language as AppLanguage) || 'en';

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<ShopSetupErrors>({});
  const [loading, setLoading] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const validate = () => {
    const next: ShopSetupErrors = {};
    if (!shopName.trim()) next.shopName = t('shopSetup.errorShopNameRequired');
    if (!ownerName.trim()) next.ownerName = t('shopSetup.errorOwnerNameRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !user) return;
    setLoading(true);
    try {
      const { data: shop, error } = await supabase
        .from('shops')
        .insert({
          owner_id: user.id,
          shop_name: shopName.trim(),
          owner_name: ownerName.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (logoUri) {
        try {
          const logoUrl = await uploadImage({
            bucket: 'shop-logos',
            shopId: shop.id,
            localUri: logoUri,
            fileName: 'logo',
          });
          await supabase.from('shops').update({ logo_url: logoUrl }).eq('id', shop.id);
        } catch {
          // The shop row is already saved — a failed logo upload shouldn't
          // block onboarding. The owner can re-upload from Settings later.
          showToast(t('shopSetup.logoUploadFailed'), 'info');
        }
      }

      await refreshShop();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('shopSetup.errorSave'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-white dark:bg-gray-950">
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-950"
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{t('shopSetup.title')}</Text>
        <Text className="font-sans mb-6 text-base text-gray-500 dark:text-gray-400">
          {t('shopSetup.subtitle')}
        </Text>

        <View className="mb-6">
          <Text className="mb-1.5 text-base font-bold text-gray-600 dark:text-gray-400">
            {t('shopSetup.language')}
          </Text>
          <View className="flex-row gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = lang === currentLanguage;
              return (
                <Pressable
                  key={lang}
                  onPress={() => setAppLanguage(lang)}
                  className={`min-h-[52px] flex-1 items-center justify-center rounded-md border py-3 ${
                    active ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                  }`}
                >
                  <Text
                    className={`font-sans text-base font-medium ${
                      active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {LANGUAGE_ENDONYMS[lang]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="font-sans mt-1.5 text-base text-gray-400 dark:text-gray-500">{t('shopSetup.languageHint')}</Text>
        </View>

        <InputField
          label={t('shopSetup.shopName')}
          value={shopName}
          onChangeText={setShopName}
          placeholder={t('shopSetup.shopNamePlaceholder')}
          error={errors.shopName}
          required
        />

        <InputField
          label={t('shopSetup.ownerName')}
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder={t('shopSetup.ownerNamePlaceholder')}
          error={errors.ownerName}
          required
        />

        {/* Progressive disclosure: only the two fields above are required to
            get into the app. Everything else — logo, address, phone — is an
            optional expansion the user opts into, not a gate they must clear. */}
        {showMoreDetails ? (
          <View className="mb-2">
            <ImagePickerField label={t('shopSetup.shopLogo')} uri={logoUri} onChange={setLogoUri} />

            <InputField
              label={t('shopSetup.address')}
              value={address}
              onChangeText={setAddress}
              placeholder={t('shopSetup.addressPlaceholder')}
            />

            <InputField
              label={t('shopSetup.phone')}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('shopSetup.phonePlaceholder')}
              keyboardType="phone-pad"
            />
          </View>
        ) : (
          <Pressable onPress={() => setShowMoreDetails(true)} className="mb-6 py-2">
            <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">
              {t('shopSetup.addMoreDetails')}
            </Text>
            <Text className="font-sans mt-1 text-base text-gray-500 dark:text-gray-400">
              {t('shopSetup.addMoreDetailsHint')}
            </Text>
          </Pressable>
        )}

        <Button title={t('shopSetup.continue')} size="lg" onPress={handleSave} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
