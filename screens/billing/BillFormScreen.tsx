import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Dropdown, Header, InputField, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { useShop } from '../../context/AuthContext';
import type { AppScreenProps } from '../../navigation/types';

type Option = { label: string; value: string };

function toAmount(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default function BillFormScreen({ navigation, route }: AppScreenProps<'BillForm'>) {
  const orderId = route.params?.orderId;
  const presetCustomerId = route.params?.customerId;
  const shop = useShop();
  const showToast = useToast();

  const [customers, setCustomers] = useState<Option[]>([]);
  const [customerId, setCustomerId] = useState<string>(presetCustomerId ?? '');
  const [fabricCost, setFabricCost] = useState('');
  const [stitchingCharge, setStitchingCharge] = useState('');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('customers').select('id, name').order('name');
      setCustomers((data ?? []).map((c) => ({ label: c.name, value: c.id })));
    })();
  }, []);

  const total = useMemo(
    () =>
      Math.max(toAmount(fabricCost) + toAmount(stitchingCharge) + toAmount(tax) - toAmount(discount), 0),
    [fabricCost, stitchingCharge, discount, tax]
  );

  const handleSave = async () => {
    if (!customerId) {
      setError('Customer is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: insertError } = await supabase.from('bills').insert({
        shop_id: shop.id,
        order_id: orderId ?? null,
        customer_id: customerId,
        fabric_cost: toAmount(fabricCost),
        stitching_charge: toAmount(stitchingCharge),
        discount: toAmount(discount),
        tax: toAmount(tax),
      });
      if (insertError) throw insertError;
      showToast('Bill created', 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create bill', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="New Bill" onBack={() => navigation.goBack()} />
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20 }}>
        <Dropdown
          label="Customer"
          value={customerId}
          onChange={setCustomerId}
          options={customers}
          placeholder="Select customer"
          error={error}
        />

        <InputField
          label="Fabric Cost"
          value={fabricCost}
          onChangeText={setFabricCost}
          keyboardType="numeric"
          leftIcon="rupee-sign"
        />
        <InputField
          label="Stitching Charge"
          value={stitchingCharge}
          onChangeText={setStitchingCharge}
          keyboardType="numeric"
          leftIcon="rupee-sign"
        />
        <InputField
          label="Discount"
          value={discount}
          onChangeText={setDiscount}
          keyboardType="numeric"
          leftIcon="rupee-sign"
        />
        <InputField
          label="Tax"
          value={tax}
          onChangeText={setTax}
          keyboardType="numeric"
          leftIcon="rupee-sign"
        />

        <View className="mb-6 flex-row items-center justify-between rounded-lg bg-primary-50 p-4">
          <Text className="text-sm font-medium text-primary-700">Total Amount</Text>
          <Text className="text-xl font-bold text-primary-700">{formatCurrency(total)}</Text>
        </View>

        <Button title="Create Bill" onPress={handleSave} loading={loading} />
      </ScrollView>
    </>
  );
}
