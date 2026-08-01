import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Header, InputField, RadioGroup, useToast } from '../../components/ui';
import { staffRepo } from '../../lib/data/repository';
import { useShop } from '../../context/AuthContext';
import type { SettingsScreenProps } from '../../navigation/types';
import type { WageType } from '../../types';

export default function StaffFormScreen({ navigation, route }: SettingsScreenProps<'StaffForm'>) {
  const { t } = useTranslation('staff');
  const staffId = route.params?.staffId;
  const shop = useShop();
  const showToast = useToast();

  const WAGE_TYPES: { label: string; value: WageType }[] = [
    { label: t('form.wageTypes.daily'), value: 'daily' },
    { label: t('form.wageTypes.monthly'), value: 'monthly' },
    { label: t('form.wageTypes.perPiece'), value: 'per_piece' },
  ];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wageType, setWageType] = useState<WageType>('monthly');
  const [wageAmount, setWageAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!staffId) return;
    void (async () => {
      const data = await staffRepo.get(staffId);
      if (!data) return;
      setName(data.name);
      setPhone(data.phone ?? '');
      setWageType(data.wage_type);
      setWageAmount(String(data.wage_amount ?? ''));
    })();
  }, [staffId]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('form.nameRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const parsedWage = Number(wageAmount.trim());
      const payload = {
        shop_id: shop.id,
        name: name.trim(),
        phone: phone.trim() || null,
        wage_type: wageType,
        wage_amount: Number.isFinite(parsedWage) && parsedWage > 0 ? parsedWage : 0,
        wage_amount_shirt: null,
        wage_amount_pant: null,
        wage_amount_pair: null,
      };

      if (staffId) {
        await staffRepo.update(staffId, shop.id, payload);
      } else {
        await staffRepo.create(payload);
      }

      showToast(staffId ? t('form.updateSuccess') : t('form.addSuccess'), 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('form.saveError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title={staffId ? t('form.titleEdit') : t('form.titleAdd')} onBack={() => navigation.goBack()} />
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
            onChangeText={setPhone}
            placeholder={t('form.phonePlaceholder')}
            keyboardType="phone-pad"
          />
          <View className="mb-4">
            <Text className="mb-1.5 text-base font-semibold text-gray-600 dark:text-gray-400">
              {t('form.wageTypeLabel')}
            </Text>
            <RadioGroup<WageType>
              variant="cards"
              direction="column"
              value={wageType}
              onChange={setWageType}
              options={WAGE_TYPES}
            />
          </View>
          <InputField
            label={wageType === 'per_piece' ? t('form.amountPerPieceLabel') : t('form.wageAmountLabel')}
            value={wageAmount}
            onChangeText={setWageAmount}
            placeholder={wageType === 'per_piece' ? t('form.amountPerPiecePlaceholder') : t('form.wageAmountPlaceholder')}
            keyboardType="numeric"
          />
          <Button
            title={staffId ? t('form.updateStaff') : t('form.saveStaff')}
            size="lg"
            onPress={handleSave}
            loading={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
