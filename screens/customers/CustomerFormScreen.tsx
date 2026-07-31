import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Header, InputField, LoadingSpinner, useToast } from '../../components/ui';
import { customersRepo } from '../../lib/data/repository';
import { useShop } from '../../context/AuthContext';
import type { CustomersScreenProps } from '../../navigation/types';

export default function CustomerFormScreen({ navigation, route }: CustomersScreenProps<'CustomerForm'>) {
  const customerId = route.params?.customerId;
  const isEditing = Boolean(customerId);

  const { t } = useTranslation('customers');
  const shop = useShop();
  const showToast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  const load = useCallback(async () => {
    if (!customerId) return;
    try {
      const data = await customersRepo.get(customerId);
      if (!data) throw new Error(t('form.loadError'));

      setName(data.name ?? '');
      setPhone(data.phone ?? '');
      setAddress(data.address ?? '');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('form.loadError'), 'error');
    } finally {
      setFetching(false);
    }
  }, [customerId, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('form.nameRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      };

      if (isEditing) {
        await customersRepo.update(customerId!, shop.id, payload);
      } else {
        await customersRepo.create({ shop_id: shop.id, ...payload });
      }

      showToast(t(isEditing ? 'form.updateSuccess' : 'form.saveSuccess'), 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('form.saveError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <LoadingSpinner fullScreen text={t('form.loading')} />;

  return (
    <>
      <Header
        title={t(isEditing ? 'form.editTitle' : 'form.title')}
        onBack={() => navigation.goBack()}
      />
      <ScrollView className="flex-1 bg-white dark:bg-gray-950" contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
        <InputField
          label={t('form.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('form.namePlaceholder')}
          error={error}
        />
        <InputField
          label={t('form.phoneLabel')}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('form.phonePlaceholder')}
          keyboardType="phone-pad"
        />
        <InputField
          label={t('form.addressLabel')}
          value={address}
          onChangeText={setAddress}
          placeholder={t('form.addressPlaceholder')}
          multiline
        />
        <Button
          title={t(isEditing ? 'form.updateCustomer' : 'form.saveCustomer')}
          onPress={handleSave}
          loading={loading}
        />
      </ScrollView>
    </>
  );
}
