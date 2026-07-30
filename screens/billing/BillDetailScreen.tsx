import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
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
  const showToast = useToast();

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
      showToast(err instanceof Error ? err.message : 'Could not load bill', 'error');
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
      showToast('Enter a valid amount', 'error');
      return;
    }
    if (value > pending) {
      showToast(`Amount cannot exceed the pending ${formatCurrency(pending)}`, 'error');
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
      showToast('Payment recorded', 'success');
    } catch (err) {
      haptics.error();
      showToast(err instanceof Error ? err.message : 'Could not record payment', 'error');
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
      showToast(err instanceof Error ? err.message : 'Could not open WhatsApp', 'error');
    }
  };

  if (loading || !bill) return <LoadingSpinner fullScreen text="Loading bill..." />;

  return (
    <View className="flex-1 bg-gray-50">
      <Header title={`Bill · ${bill.customers?.name}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">{bill.customers?.name}</Text>
            <Badge type="payment_status" value={bill.payment_status} />
          </View>

          <View className="gap-1.5">
            <Row label="Fabric Cost" value={formatCurrency(bill.fabric_cost)} />
            <Row label="Stitching Charge" value={formatCurrency(bill.stitching_charge)} />
            <Row label="Tax" value={formatCurrency(bill.tax)} />
            <Row label="Discount" value={`- ${formatCurrency(bill.discount)}`} />
            <View className="my-2 h-px bg-gray-100" />
            <Row label="Total Amount" value={formatCurrency(bill.total_amount)} bold />
            <Row label="Paid" value={formatCurrency(paidTotal)} />
            <Row
              label="Pending"
              value={formatCurrency(pending)}
              bold
              color={pending > 0 ? '#DC2626' : '#16A34A'}
            />
          </View>

          {bill.customers?.phone ? (
            <Pressable
              onPress={handleShare}
              className="mt-4 flex-row items-center justify-center rounded-lg bg-green-50 py-2.5"
            >
              <FontAwesome5 name="whatsapp" size={16} color="#16A34A" />
              <Text className="ml-2 text-sm font-semibold text-green-700">
                Share Bill via WhatsApp
              </Text>
            </Pressable>
          ) : null}
        </Card>

        <View>
          <Text className="mb-2 text-base font-semibold text-gray-900">Payment History</Text>
          {bill.payments.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="receipt"
              title="No payments recorded yet"
              description={pending > 0 ? 'Record a payment once the customer pays' : undefined}
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

        {pending > 0 ? <Button title="Record Payment" onPress={() => setSheetOpen(true)} /> : null}
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Record Payment">
        <InputField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          leftIcon="rupee-sign"
          placeholder={`Pending: ${formatCurrency(pending)}`}
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
                {m}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button title="Save Payment" onPress={handleAddPayment} loading={saving} />
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
