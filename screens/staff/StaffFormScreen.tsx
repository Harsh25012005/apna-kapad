import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Header, InputField, useToast } from '../../components/ui';
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
  const [wageAmountShirt, setWageAmountShirt] = useState('');
  const [wageAmountPant, setWageAmountPant] = useState('');
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
      setWageAmountShirt(data.wage_amount_shirt != null ? String(data.wage_amount_shirt) : '');
      setWageAmountPant(data.wage_amount_pant != null ? String(data.wage_amount_pant) : '');
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
      const isPerPiece = wageType === 'per_piece';
      const parsedWage = Number(wageAmount.trim());
      const parsedShirt = Number(wageAmountShirt.trim());
      const parsedPant = Number(wageAmountPant.trim());
      const payload = {
        shop_id: shop.id,
        name: name.trim(),
        phone: phone.trim() || null,
        wage_type: wageType,
        wage_amount: isPerPiece
          ? 0
          : Number.isFinite(parsedWage) && parsedWage > 0
            ? parsedWage
            : 0,
        wage_amount_shirt: isPerPiece && Number.isFinite(parsedShirt) && parsedShirt > 0 ? parsedShirt : null,
        wage_amount_pant: isPerPiece && Number.isFinite(parsedPant) && parsedPant > 0 ? parsedPant : null,
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
          contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
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
          <Dropdown<WageType>
            label={t('form.wageTypeLabel')}
            value={wageType}
            onChange={setWageType}
            options={WAGE_TYPES}
            placeholder={t('form.wageTypePlaceholder')}
          />
          {wageType === 'per_piece' ? (
            <>
              <InputField
                label={t('form.amountPerShirtLabel')}
                value={wageAmountShirt}
                onChangeText={setWageAmountShirt}
                placeholder={t('form.amountPerShirtPlaceholder')}
                keyboardType="numeric"
              />
              <InputField
                label={t('form.amountPerPantLabel')}
                value={wageAmountPant}
                onChangeText={setWageAmountPant}
                placeholder={t('form.amountPerPantPlaceholder')}
                keyboardType="numeric"
              />
            </>
          ) : (
            <InputField
              label={t('form.wageAmountLabel')}
              value={wageAmount}
              onChangeText={setWageAmount}
              placeholder={t('form.wageAmountPlaceholder')}
              keyboardType="numeric"
            />
          )}
          <Button
            title={staffId ? t('form.updateStaff') : t('form.saveStaff')}
            onPress={handleSave}
            loading={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
