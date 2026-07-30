import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, ImagePickerField, InputField, Toggle, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../lib/storage';

type ShopSetupErrors = { shopName?: string; ownerName?: string };

export default function ShopSetupScreen() {
  const { user, refreshShop } = useAuth();
  const showToast = useToast();

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [hasTailoring, setHasTailoring] = useState(true);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<ShopSetupErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: ShopSetupErrors = {};
    if (!shopName.trim()) next.shopName = 'Shop name is required';
    if (!ownerName.trim()) next.ownerName = 'Owner name is required';
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
          has_tailoring: hasTailoring,
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
          showToast('Shop saved, but the logo could not be uploaded', 'info');
        }
      }

      await refreshShop();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save shop details', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">Set up your shop</Text>
      <Text className="mb-6 text-sm text-gray-500">
        Tell us a bit about your shop to get started.
      </Text>

      <ImagePickerField label="Shop Logo" uri={logoUri} onChange={setLogoUri} />

      <InputField
        label="Shop Name"
        value={shopName}
        onChangeText={setShopName}
        placeholder="e.g. Vaghela Tailors"
        leftIcon="store"
        error={errors.shopName}
      />

      <InputField
        label="Owner Name"
        value={ownerName}
        onChangeText={setOwnerName}
        placeholder="e.g. Harsh Vaghela"
        leftIcon="user"
        error={errors.ownerName}
      />

      <InputField
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="Shop address"
        leftIcon="map-marker-alt"
        multiline
      />

      <InputField
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="10-digit phone number"
        leftIcon="phone"
        keyboardType="phone-pad"
      />

      <View className="mb-6 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
        <View className="flex-1 pr-4">
          <Text className="text-base text-gray-800">Do you also do tailoring?</Text>
          <Text className="text-xs text-gray-500">Enables order tracking & measurements</Text>
        </View>
        <Toggle value={hasTailoring} onChange={setHasTailoring} />
      </View>

      <Button title="Continue" onPress={handleSave} loading={loading} />
    </ScrollView>
  );
}
