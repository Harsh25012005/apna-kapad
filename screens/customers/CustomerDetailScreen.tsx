import { useCallback, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Avatar, Badge, Card, EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/format';
import { sendWhatsAppMessage, buildPaymentDueMessage } from '../../lib/whatsapp';
import { useShop } from '../../context/AuthContext';
import type { CustomersScreenProps } from '../../navigation/types';
import type { Customer, Measurement, Order } from '../../types';

export default function CustomerDetailScreen({
  navigation,
  route,
}: CustomersScreenProps<'CustomerDetail'>) {
  const { customerId } = route.params;
  const shop = useShop();
  const showToast = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [customerRes, measurementRes, orderRes, billRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', customerId).single(),
        supabase
          .from('measurements')
          .select('*')
          .eq('customer_id', customerId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('orders')
          .select('*')
          .eq('customer_id', customerId)
          .order('order_date', { ascending: false }),
        supabase
          .from('bills')
          .select('total_amount, payments(amount_paid)')
          .eq('customer_id', customerId),
      ]);

      if (customerRes.error) throw customerRes.error;

      setCustomer(customerRes.data);
      setMeasurements(measurementRes.data ?? []);
      setOrders(orderRes.data ?? []);

      const totalBalance = (billRes.data ?? []).reduce((sum, bill) => {
        const paid = bill.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
        return sum + Math.max(Number(bill.total_amount ?? 0) - paid, 0);
      }, 0);
      setBalance(totalBalance);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load customer', 'error');
    } finally {
      setLoading(false);
    }
  }, [customerId, showToast]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleRemind = async () => {
    if (!customer) return;
    try {
      await sendWhatsAppMessage(
        customer.phone,
        buildPaymentDueMessage({
          shopName: shop.shop_name,
          customerName: customer.name,
          pending: balance,
        })
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open WhatsApp', 'error');
    }
  };

  if (loading || !customer) return <LoadingSpinner fullScreen text="Loading customer..." />;

  return (
    <View className="flex-1 bg-gray-50">
      <Header title={customer.name} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <View className="flex-row items-center">
            <Avatar name={customer.name} size="lg" />
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold text-gray-900">{customer.name}</Text>
              <Text className="text-sm text-gray-500">{customer.phone ?? 'No phone'}</Text>
              {customer.address ? (
                <Text className="text-sm text-gray-500">{customer.address}</Text>
              ) : null}
            </View>
          </View>

          <View className="mt-4 flex-row items-center justify-between rounded-lg bg-gray-50 p-3">
            <Text className="text-sm text-gray-600">Outstanding Balance</Text>
            <Text className={`text-base font-bold ${balance > 0 ? 'text-danger' : 'text-success'}`}>
              {formatCurrency(balance)}
            </Text>
          </View>

          {balance > 0 && customer.phone ? (
            <Pressable
              onPress={handleRemind}
              className="mt-3 flex-row items-center justify-center rounded-lg bg-green-50 py-2.5"
            >
              <FontAwesome5 name="whatsapp" size={16} color="#16A34A" />
              <Text className="ml-2 text-sm font-semibold text-green-700">
                Send Payment Reminder
              </Text>
            </Pressable>
          ) : null}
        </Card>

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">Measurements</Text>
            <Pressable onPress={() => navigation.navigate('MeasurementForm', { customerId })}>
              <Text className="text-sm font-medium text-primary-600">+ Add</Text>
            </Pressable>
          </View>
          {measurements.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="ruler-combined"
              title="No measurements yet"
              description="Save a measurement set to speed up future orders"
              actionLabel="Add Measurement"
              onAction={() => navigation.navigate('MeasurementForm', { customerId })}
            />
          ) : (
            <View className="gap-2">
              {measurements.map((m) => (
                <Card key={m.id}>
                  <Text className="mb-1 text-sm font-semibold text-gray-900">{m.garment_type}</Text>
                  <Text className="text-xs text-gray-500">
                    Chest {m.chest ?? '—'} · Waist {m.waist ?? '—'} · Shoulder {m.shoulder ?? '—'} ·
                    Length {m.length ?? '—'} · Sleeve {m.sleeve ?? '—'}
                  </Text>
                  {m.notes ? <Text className="mt-1 text-xs text-gray-400">{m.notes}</Text> : null}
                </Card>
              ))}
            </View>
          )}
        </View>

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">Order History</Text>
            <Pressable onPress={() => navigation.navigate('OrderForm', { customerId })}>
              <Text className="text-sm font-medium text-primary-600">+ New Order</Text>
            </Pressable>
          </View>
          {orders.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="tshirt"
              title="No orders yet"
              description="Create this customer's first order to start tracking it"
              actionLabel="New Order"
              onAction={() => navigation.navigate('OrderForm', { customerId })}
            />
          ) : (
            <View className="gap-2">
              {orders.map((o) => (
                <Card
                  key={o.id}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-gray-900">#{o.order_number}</Text>
                    <Badge type="order_status" value={o.status} />
                  </View>
                  <Text className="mt-1 text-xs text-gray-500">
                    {o.cloth_type ?? 'No cloth type'} · Ordered {formatDate(o.order_date)}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
