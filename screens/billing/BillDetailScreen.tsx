import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Header,
  InputField,
  LoadingSpinner,
  useToast,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { sendWhatsAppMessage, buildBillMessage } from '../../lib/whatsapp';
import { haptics } from '../../lib/haptics';
import { useShop } from '../../context/AuthContext';
import type { BillingScreenProps } from '../../navigation/types';
import type { BillWithRelations } from '../../types';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'] as const;

export default function BillDetailScreen({ navigation, route }: BillingScreenProps<'BillDetail'>) {
  const { billId } = route.params;
  const shop = useShop();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const { t } = useTranslation('billing');

  const [bill, setBill] = useState<BillWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<string>('Cash');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*, customers(name, phone), payments(*)')
        .eq('id', billId)
        .single();
      if (error) throw error;
      setBill(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('detail.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [billId, showToast]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const paidTotal = (bill?.payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0);
  const pending = bill ? Math.max(Number(bill.total_amount ?? 0) - paidTotal, 0) : 0;

  const handleAddPayment = async () => {
    if (!bill) return;
    const value = Number(amount.trim());
    if (!Number.isFinite(value) || value <= 0) {
      showToast(t('detail.errorInvalidAmount'), 'error');
      return;
    }
    if (value > pending) {
      showToast(t('detail.errorExceedsPending', { amount: formatCurrency(pending) }), 'error');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('payments').insert({
        shop_id: shop.id,
        bill_id: bill.id,
        customer_id: bill.customer_id,
        amount_paid: value,
        payment_mode: mode,
      });
      if (error) throw error;
      setAmount('');
      setSheetOpen(false);
      await load();
      haptics.success();
      showToast(t('detail.successPayment'), 'success');
    } catch (err) {
      haptics.error();
      showToast(err instanceof Error ? err.message : t('detail.errorPayment'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!bill?.customers) return;
    try {
      await sendWhatsAppMessage(
        bill.customers.phone,
        buildBillMessage({
          shopName: shop.shop_name,
          customerName: bill.customers.name,
          total: Number(bill.total_amount ?? 0),
          paid: paidTotal,
          pending,
        })
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('detail.errorWhatsapp'), 'error');
    }
  };

  if (loading || !bill) return <LoadingSpinner fullScreen text={t('detail.loading')} />;

  return (
    <View className="flex-1 bg-gray-50">
      <Header title={t('detail.billTitle', { name: bill.customers?.name })} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 160, gap: 16 }}>
        {/* Hero card: total / paid / balance due */}
        <View className="rounded-xl bg-[#101828] p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-sans text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
              {t('detail.totalAmount')}
            </Text>
            <Badge type="payment_status" value={bill.payment_status} />
          </View>
          <Text className="text-[34px] font-medium text-white tracking-tight">
            {formatCurrency(bill.total_amount)}
          </Text>

          <View className="mt-5 flex-row gap-3">
            <View className="flex-1 rounded-lg bg-white/10 p-3">
              <Text className="font-sans text-xs text-[#98A2B3]">{t('detail.paid')}</Text>
              <Text className="mt-0.5 text-base font-semibold text-white">
                {formatCurrency(paidTotal)}
              </Text>
            </View>
            <View className="flex-1 rounded-lg bg-white/10 p-3">
              <Text className="font-sans text-xs text-[#98A2B3]">{t('detail.balanceDue')}</Text>
              <Text
                className={`mt-0.5 text-base font-semibold ${
                  pending > 0 ? 'text-[#F87171]' : 'text-[#4ADE80]'
                }`}
              >
                {formatCurrency(pending)}
              </Text>
            </View>
          </View>

          {bill.customers?.phone ? (
            <Pressable
              onPress={handleShare}
              className="mt-4 flex-row items-center justify-center rounded-lg bg-white/10 py-2.5 active:bg-white/20"
            >
              <FontAwesome5 name="whatsapp" size={16} color="#4ADE80" />
              <Text className="ml-2 text-sm font-semibold text-white">{t('detail.shareWhatsapp')}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Customer info */}
        <Card>
          <Text className="mb-2 text-sm font-semibold text-gray-900">{t('detail.customer')}</Text>
          <View className="gap-1.5">
            <Row label={t('detail.name')} value={bill.customers?.name ?? '—'} />
            {bill.customers?.phone ? <Row label={t('detail.phone')} value={bill.customers.phone} /> : null}
          </View>
        </Card>

        {/* Related order */}
        {bill.order_id ? (
          <View className="flex-row items-center rounded-md border border-gray-200 bg-white p-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-50">
              <FontAwesome5 name="shopping-bag" size={14} color="#2563EB" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-gray-900">{t('detail.linkedOrder')}</Text>
              <Text className="font-sans text-xs text-gray-400">{t('detail.linkedOrderDesc')}</Text>
            </View>
          </View>
        ) : null}

        {/* Charge breakdown */}
        <Card>
          <Text className="mb-2 text-sm font-semibold text-gray-900">{t('detail.breakdown')}</Text>
          <View className="gap-1.5">
            <Row label={t('detail.fabricCost')} value={formatCurrency(bill.fabric_cost)} />
            <Row label={t('detail.stitchingCharge')} value={formatCurrency(bill.stitching_charge)} />
            <Row label={t('detail.tax')} value={formatCurrency(bill.tax)} />
            <Row label={t('detail.discount')} value={`- ${formatCurrency(bill.discount)}`} />
            <View className="my-2 h-px bg-gray-100" />
            <Row label={t('detail.totalAmount')} value={formatCurrency(bill.total_amount)} bold />
          </View>
        </Card>

        <View>
          <Text className="mb-2 text-base font-semibold text-gray-900">{t('detail.paymentHistory')}</Text>
          {bill.payments.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="receipt"
              title={t('detail.noPayments')}
              description={pending > 0 ? t('detail.recordPaymentHint') : undefined}
            />
          ) : (
            <View className="gap-2">
              {bill.payments.map((p) => (
                <Card key={p.id}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-gray-900">
                      {formatCurrency(p.amount_paid)}
                    </Text>
                    <Text className="font-sans text-xs text-gray-500">{p.payment_mode}</Text>
                  </View>
                  <Text className="font-sans mt-1 text-xs text-gray-400">
                    {formatDateTime(p.payment_date)}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </View>

        {pending > 0 ? <Button title={t('detail.recordPayment')} onPress={() => setSheetOpen(true)} /> : null}
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={t('detail.recordPayment')}>
        <InputField
          label={t('detail.amount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder={t('detail.pendingPlaceholder', { amount: formatCurrency(pending) })}
        />
        <View className="mb-4 flex-row flex-wrap gap-2">
          {PAYMENT_MODES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              className={`rounded-full border px-3 py-1.5 ${
                mode === m ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
              }`}
            >
              <Text
                className={
                  mode === m ? 'text-sm font-medium text-primary-700' : 'text-sm text-gray-600'
                }
              >
                {t(`detail.paymentModes.${m}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button title={t('detail.savePayment')} onPress={handleAddPayment} loading={saving} />
      </BottomSheet>
    </View>
  );
}

function Row({
  label,
  value,
  bold = false,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-sans text-sm text-gray-500">{label}</Text>
      <Text
        className={bold ? 'text-base font-bold text-gray-900' : 'text-sm text-gray-700'}
        style={color ? { color } : undefined}
      >
        {value}
      </Text>
    </View>
  );
}
