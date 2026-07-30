import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, Card, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import { sendWhatsAppMessage, buildOrderReadyMessage } from '../../lib/whatsapp';
import { haptics } from '../../lib/haptics';
import { useShop } from '../../context/AuthContext';
import type { AppScreenProps } from '../../navigation/types';
import type { OrderStatus, OrderWithRelations } from '../../types';

const STATUS_STEPS: OrderStatus[] = [
  'order_taken',
  'cutting',
  'stitching',
  'ready',
  'delivered',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  order_taken: 'Order Taken',
  cutting: 'Cutting',
  stitching: 'Stitching',
  ready: 'Ready',
  delivered: 'Delivered',
};

export default function OrderDetailScreen({ navigation, route }: AppScreenProps<'OrderDetail'>) {
  const { orderId } = route.params;
  const shop = useShop();
  const showToast = useToast();

  const [order, setOrder] = useState<OrderWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(name, phone), staff(name), measurements(garment_type)')
        .eq('id', orderId)
        .single();
      if (error) throw error;
      setOrder(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load order', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const advanceStatus = async (nextStatus: OrderStatus) => {
    if (!order) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId);
      if (error) throw error;
      setOrder({ ...order, status: nextStatus });
      haptics.success();

      if (nextStatus === 'ready' && order.customers?.phone) {
        try {
          await sendWhatsAppMessage(
            order.customers.phone,
            buildOrderReadyMessage({
              shopName: shop.shop_name,
              customerName: order.customers.name,
              orderNumber: order.order_number,
            })
          );
        } catch {
          // WhatsApp is a convenience here — the status change already saved.
        }
      }
    } catch (err) {
      haptics.error();
      showToast(err instanceof Error ? err.message : 'Could not update status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !order) return <LoadingSpinner fullScreen text="Loading order..." />;

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const nextStep = STATUS_STEPS[currentStepIndex + 1];

  return (
    <View className="flex-1 bg-gray-50">
      <Header title={`Order #${order.order_number}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">{order.customers?.name}</Text>
            <Badge type="order_status" value={order.status} />
          </View>
          <Text className="mt-1 text-sm text-gray-500">{order.cloth_type ?? 'No cloth type'}</Text>
          {order.measurements?.garment_type ? (
            <Text className="mt-1 text-sm text-gray-500">
              Measurement: {order.measurements.garment_type}
            </Text>
          ) : null}
          <Text className="mt-1 text-sm text-gray-500">
            Ordered {formatDate(order.order_date)} · Delivery {formatDate(order.delivery_date)}
          </Text>
          {order.staff?.name ? (
            <Text className="mt-1 text-sm text-gray-500">Assigned to {order.staff.name}</Text>
          ) : null}
          {order.priority === 'urgent' ? (
            <View className="mt-2 self-start rounded-full bg-red-50 px-2 py-0.5">
              <Text className="text-xs font-semibold text-danger">Urgent</Text>
            </View>
          ) : null}
        </Card>

        {order.design_photo_url ? (
          <Card>
            <Text className="mb-2 text-sm font-semibold text-gray-900">Design Photo</Text>
            <Image
              source={{ uri: order.design_photo_url }}
              className="h-48 w-full rounded-lg"
              resizeMode="cover"
            />
          </Card>
        ) : null}

        <Card>
          <Text className="mb-3 text-sm font-semibold text-gray-900">Status Pipeline</Text>
          <View className="gap-3">
            {STATUS_STEPS.map((step, index) => {
              const isDone = index <= currentStepIndex;
              return (
                <View key={step} className="flex-row items-center">
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full ${
                      isDone ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  >
                    {isDone ? <FontAwesome5 name="check" size={10} color="#FFFFFF" /> : null}
                  </View>
                  <Text
                    className={`ml-3 text-sm ${
                      isDone ? 'font-semibold text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {STATUS_LABELS[step]}
                  </Text>
                </View>
              );
            })}
          </View>

          {nextStep ? (
            <Pressable
              onPress={() => advanceStatus(nextStep)}
              disabled={updating}
              className={`mt-4 items-center rounded-lg bg-primary-600 py-3 ${
                updating ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-sm font-semibold text-white">
                Mark as {STATUS_LABELS[nextStep]}
              </Text>
            </Pressable>
          ) : (
            <View className="mt-4 items-center rounded-lg bg-gray-100 py-3">
              <Text className="text-sm font-semibold text-gray-500">Order Delivered</Text>
            </View>
          )}
        </Card>

        <Pressable
          onPress={() =>
            navigation.navigate('BillForm', {
              orderId: order.id,
              customerId: order.customer_id,
            })
          }
          className="items-center rounded-lg border border-primary-600 py-3"
        >
          <Text className="text-sm font-semibold text-primary-600">Create Bill for this Order</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
