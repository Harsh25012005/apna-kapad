import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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
  const [loading, setLoading] = useState(false);

  const phoneDigits = phone.trim().replace(/\D/g, '');
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
        book_number: bookNumber.trim() || null,
      };

      if (isEditing) {
        await customersRepo.update(customerId!, shop.id, payload);
        showToast(t('form.updateSuccess'), 'success');
        navigation.goBack();
      } else {
        const created = await customersRepo.create({ shop_id: shop.id, ...payload });
        showToast(t('form.saveSuccess'), 'success');
        Alert.alert(t('form.addMeasurementsPromptTitle'), t('form.addMeasurementsPromptMessage'), [
          { text: t('form.addMeasurementsPromptNo'), style: 'cancel', onPress: () => navigation.goBack() },
          {
            text: t('form.addMeasurementsPromptYes'),
            onPress: () => navigation.replace('MeasurementForm', { customerId: created.id }),
          },
        ]);
      }
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
          contentContainerStyle={{ padding: 20, paddingBottom: 130 }}
          keyboardShouldPersistTaps="handled"
        >
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
            helperText={!phoneError && phoneDigits.length === 10 ? t('form.phoneValid') : undefined}
            required
          />
          <InputField
            label={t('form.bookNumberLabel')}
            value={bookNumber}
            onChangeText={setBookNumber}
            placeholder={t('form.bookNumberPlaceholder')}
            helperText={t('form.bookNumberHelper')}
          />
          <InputField
            label={t('form.addressLabel')}
            value={address}
            onChangeText={setAddress}
            placeholder={t('form.addressPlaceholder')}
          />
          <Button
            title={t(isEditing ? 'form.updateCustomer' : 'form.saveCustomer')}
            size="lg"
            onPress={handleSave}
            loading={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
