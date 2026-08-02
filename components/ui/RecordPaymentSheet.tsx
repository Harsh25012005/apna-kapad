import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { InputField } from './InputField';
import { BottomSheet } from './Modal';
import { useToast } from './Toast';
import { paymentsRepo } from '../../lib/data/repository';
import { formatCurrency } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { useShop } from '../../context/AuthContext';

const PAYMENT_MODES = ['Cash', 'UPI'] as const;

export type PayableBill = {
  id: string;
  customerId: string;
  customerName: string;
  pending: number;
};

export type RecordPaymentSheetProps = {
  bill: PayableBill | null;
  onClose: () => void;
  /** Fired after a payment is saved, so the caller can refresh its data. */
  onSaved: () => void;
};

/**
 * Shared "take money" sheet. Lives in one place so payment can be collected
 * from wherever the shop owner happens to be — the dashboard, a bill, a
 * customer — instead of only from deep inside the Billing section.
 *
 * The amount pre-fills to the full outstanding balance because most payments
 * settle a bill completely, so the common case needs no typing at all.
 */
export function RecordPaymentSheet({ bill, onClose, onSaved }: RecordPaymentSheetProps) {
  const { t } = useTranslation('billing');
  const shop = useShop();
  const showToast = useToast();

  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<string>('Cash');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bill) setAmount(String(bill.pending));
  }, [bill]);

  const submit = async (value: number) => {
    if (!bill) return;
    setSaving(true);
    try {
      await paymentsRepo.create({
        shop_id: shop.id,
        bill_id: bill.id,
        customer_id: bill.customerId,
        amount_paid: value,
        payment_mode: mode,
      });
      setAmount('');
      haptics.success();
      showToast(t('detail.successPayment'), 'success');
      onSaved();
      onClose();
    } catch (err) {
      haptics.error();
      showToast(err instanceof Error ? err.message : t('detail.errorPayment'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!bill) return;
    const value = Number(amount.trim());
    if (!Number.isFinite(value) || value <= 0) {
      showToast(t('detail.errorInvalidAmount'), 'error');
      return;
    }
    if (value > bill.pending) {
      showToast(t('detail.errorExceedsPending', { amount: formatCurrency(bill.pending) }), 'error');
      return;
    }

    if (mode === 'UPI') {
      Alert.alert(t('detail.upiConfirmTitle'), t('detail.upiConfirmMessage'), [
        { text: t('detail.upiConfirmNo'), style: 'cancel' },
        { text: t('detail.upiConfirmYes'), onPress: () => void submit(value) },
      ]);
      return;
    }
    void submit(value);
  };

  return (
    <BottomSheet
      visible={!!bill}
      onClose={onClose}
      title={bill ? t('collect.title', { name: bill.customerName }) : undefined}
    >
      <View className="mb-4 flex-row items-center justify-between rounded-md bg-gray-50 px-4 py-3 dark:bg-gray-800">
        <Text className="text-base text-gray-600 dark:text-gray-300">{t('detail.balanceDue')}</Text>
        <Text className="text-xl font-bold text-danger">{formatCurrency(bill?.pending ?? 0)}</Text>
      </View>

      <InputField
        label={t('detail.amount')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder={t('detail.pendingPlaceholder', { amount: formatCurrency(bill?.pending ?? 0) })}
      />

      <View className="mb-4 flex-row gap-3">
        {PAYMENT_MODES.map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            className={`min-h-[52px] flex-1 items-center justify-center rounded-md border-2 px-4 ${
              mode === m
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-950'
                : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
            }`}
          >
            <Text
              className={
                mode === m
                  ? 'text-base font-semibold text-primary-700 dark:text-primary-300'
                  : 'text-base font-medium text-gray-600 dark:text-gray-300'
              }
            >
              {t(`detail.paymentModes.${m}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button title={t('detail.savePayment')} size="lg" onPress={handleSave} loading={saving} />
    </BottomSheet>
  );
}
