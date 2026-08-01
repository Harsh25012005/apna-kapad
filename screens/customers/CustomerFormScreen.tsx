import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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
  const [bookNumber, setBookNumber] = useState('');
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [bookNumberError, setBookNumberError] = useState('');
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
      setBookNumber(data.book_number ?? '');
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
    let hasError = false;
    if (!bookNumber.trim()) {
      setBookNumberError(t('form.bookNumberRequired'));
      hasError = true;
    } else {
      setBookNumberError('');
    }

    if (!name.trim()) {
      setError(t('form.nameRequired'));
      hasError = true;
    } else {
      setError('');
    }

    const digits = phone.trim().replace(/\D/g, '');
    if (!digits) {
      setPhoneError(t('form.phoneRequired'));
      hasError = true;
    } else if (digits.length !== 10) {
      setPhoneError(t('form.phoneInvalid'));
      hasError = true;
    } else {
      setPhoneError('');
    }

    if (hasError) return;

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        phone: digits,
        address: address.trim() || null,
        book_number: bookNumber.trim(),
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
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 bg-white dark:bg-gray-950"
          contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
        >
          <InputField
            label={t('form.bookNumberLabel')}
            value={bookNumber}
            onChangeText={(v) => {
              setBookNumber(v);
              setBookNumberError('');
            }}
            placeholder={t('form.bookNumberPlaceholder')}
            error={bookNumberError}
            required
          />
          <InputField
            label={t('form.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('form.namePlaceholder')}
            error={error}
            required
          />
          <InputField
            label={t('form.phoneLabel')}
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              setPhoneError('');
            }}
            placeholder={t('form.phonePlaceholder')}
            keyboardType="phone-pad"
            error={phoneError}
            required
          />
          <InputField
            label={t('form.addressLabel')}
            value={address}
            onChangeText={setAddress}
            placeholder={t('form.addressPlaceholder')}
          />
          <Button
            title={t(isEditing ? 'form.updateCustomer' : 'form.saveCustomer')}
            onPress={handleSave}
            loading={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
