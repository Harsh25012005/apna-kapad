import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, DatePickerField, Dropdown, Header, InputField, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { useShop } from '../../context/AuthContext';
import type { SettingsScreenProps } from '../../navigation/types';
import type { Enums } from '../../lib/database.types';
import type { Staff } from '../../types';

type WorkType = Enums<'work_item_type'>;

/** Local YYYY-MM-DD (the column is a plain `date`, so avoid UTC shifting). */
function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export default function StaffWorkEntryFormScreen({
  navigation,
  route,
}: SettingsScreenProps<'StaffWorkEntryForm'>) {
  const { t } = useTranslation('staff');
  const { staffId } = route.params;
  const shop = useShop();
  const showToast = useToast();

  const WORK_TYPES: { label: string; value: WorkType }[] = [
    { label: t('workEntry.types.pant'), value: 'pant' },
    { label: t('workEntry.types.shirt'), value: 'shirt' },
    { label: t('workEntry.types.pant_shirt'), value: 'pant_shirt' },
  ];

  const [staff, setStaff] = useState<Staff | null>(null);
  const [workDate, setWorkDate] = useState<Date>(new Date());
  const [workType, setWorkType] = useState<WorkType>('pant');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('staff').select('*').eq('id', staffId).single();
      if (data) setStaff(data);
    })();
  }, [staffId]);

  const rateFor = (type: WorkType): number => {
    if (!staff) return 0;
    if (type === 'pant') return Number(staff.wage_amount_pant ?? 0);
    if (type === 'shirt') return Number(staff.wage_amount_shirt ?? 0);
    return Number(staff.wage_amount_pair ?? 0);
  };

  const rate = rateFor(workType);
  const parsedQty = Number(quantity.trim());
  const previewQty = Number.isFinite(parsedQty) && parsedQty > 0 ? Math.floor(parsedQty) : 0;

  const handleSave = async () => {
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError(t('workEntry.quantityRequired'));
      return;
    }
    if (rate === 0) {
      showToast(t('workEntry.noRateWarning'), 'error');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: saveError } = await supabase.from('staff_work_entries').insert({
        shop_id: shop.id,
        staff_id: staffId,
        work_date: toDateString(workDate),
        work_type: workType,
        quantity: Math.floor(parsedQty),
        rate_applied: rate,
      });
      if (saveError) throw saveError;

      showToast(t('workEntry.saveSuccess'), 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('workEntry.saveError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title={t('workEntry.title')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 bg-white dark:bg-gray-950"
          contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          keyboardShouldPersistTaps="handled"
        >
          <DatePickerField
            label={t('workEntry.dateLabel')}
            value={workDate}
            onChange={setWorkDate}
            placeholder={t('workEntry.datePlaceholder')}
          />
          <Dropdown<WorkType>
            label={t('workEntry.typeLabel')}
            value={workType}
            onChange={setWorkType}
            options={WORK_TYPES}
            placeholder={t('workEntry.typePlaceholder')}
          />
          <InputField
            label={t('workEntry.quantityLabel')}
            value={quantity}
            onChangeText={setQuantity}
            placeholder={t('workEntry.quantityPlaceholder')}
            keyboardType="numeric"
            error={error}
          />

          <View className="mb-4 gap-2 rounded-md bg-gray-50 p-3 dark:bg-gray-800">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('workEntry.rateApplied')}</Text>
              <Text className="text-base font-bold text-[#101828] dark:text-gray-50">{formatCurrency(rate)}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('workEntry.totalPay')}</Text>
              <Text className="text-base font-bold text-[#101828] dark:text-gray-50">{formatCurrency(rate * previewQty)}</Text>
            </View>
            {rate === 0 ? (
              <Text className="font-sans text-xs text-amber-600 dark:text-amber-400">{t('workEntry.noRateWarning')}</Text>
            ) : null}
          </View>

          <Button title={t('workEntry.save')} onPress={handleSave} loading={loading} disabled={rate === 0} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
