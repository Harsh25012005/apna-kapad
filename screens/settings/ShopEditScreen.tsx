import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Header, ImagePickerField, InputField, useToast } from '../../components/ui';
import { useAuth, useShop } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../lib/storage';
import type { SettingsScreenProps } from '../../navigation/types';

type ShopEditErrors = { shopName?: string; ownerName?: string };

export default function ShopEditScreen({ navigation }: SettingsScreenProps<'ShopEdit'>) {
  const shop = useShop();
  const { refreshShop } = useAuth();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const { t } = useTranslation('settings');

  const [shopName, setShopName] = useState(shop.shop_name ?? '');
  const [ownerName, setOwnerName] = useState(shop.owner_name ?? '');
  const [address, setAddress] = useState(shop.address ?? '');
  const [phone, setPhone] = useState(shop.phone ?? '');
  const [logoUri, setLogoUri] = useState<string | null>(shop.logo_url ?? null);
  const [errors, setErrors] = useState<ShopEditErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: ShopEditErrors = {};
    if (!shopName.trim()) next.shopName = t('shopEdit.errorShopNameRequired');
    if (!ownerName.trim()) next.ownerName = t('shopEdit.errorOwnerNameRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      let logoUrl = shop.logo_url ?? null;
      if (logoUri && logoUri !== shop.logo_url) {
        try {
          logoUrl = await uploadImage({
            bucket: 'shop-logos',
            shopId: shop.id,
            localUri: logoUri,
            fileName: 'logo',
          });
        } catch {
          showToast(t('shopEdit.logoUploadFailed'), 'info');
        }
      }

      const { error } = await supabase
        .from('shops')
        .update({
          shop_name: shopName.trim(),
          owner_name: ownerName.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          logo_url: logoUrl,
        })
        .eq('id', shop.id);
      if (error) throw error;

      await refreshShop();
      showToast(t('shopEdit.saveSuccess'), 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('shopEdit.saveError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white dark:bg-gray-950">
      <Header title={t('shopEdit.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-950"
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ImagePickerField label={t('shopEdit.shopLogo')} uri={logoUri} onChange={setLogoUri} />

        <InputField
          label={t('shopEdit.shopName')}
          value={shopName}
          onChangeText={setShopName}
          placeholder={t('shopEdit.shopNamePlaceholder')}
          error={errors.shopName}
          required
        />

        <InputField
          label={t('shopEdit.ownerName')}
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder={t('shopEdit.ownerNamePlaceholder')}
          error={errors.ownerName}
          required
        />

        <InputField
          label={t('shopEdit.address')}
          value={address}
          onChangeText={setAddress}
          placeholder={t('shopEdit.addressPlaceholder')}
        />

        <InputField
          label={t('shopEdit.phone')}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('shopEdit.phonePlaceholder')}
          keyboardType="phone-pad"
        />

        <Button title={t('shopEdit.save')} onPress={handleSave} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
