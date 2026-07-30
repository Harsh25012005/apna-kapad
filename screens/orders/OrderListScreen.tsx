import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, Card, Dropdown, EmptyState, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { OrdersScreenProps } from '../../navigation/types';
import type { OrderListItem, OrderStatus } from '../../types';

type StatusFilter = OrderStatus | 'all';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All Orders', value: 'all' },
  { label: 'Order Taken', value: 'order_taken' },
  { label: 'Cutting', value: 'cutting' },
  { label: 'Stitching', value: 'stitching' },
  { label: 'Ready', value: 'ready' },
  { label: 'Delivered', value: 'delivered' },
];

export default function OrderListScreen({ navigation }: OrdersScreenProps<'OrderList'>) {
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(name, phone)')
        .order('delivery_date', { ascending: true });
      if (error) throw error;
      setOrders(data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load orders', 'error');
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered =
    statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  if (loading) return <LoadingSpinner fullScreen text="Loading orders..." />;

  return (
    <View className="flex-1 bg-gray-50 px-4" style={{ paddingTop: insets.top + 20 }}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">Orders</Text>
        <Pressable
          onPress={() => {
            haptics.tap();
            navigation.navigate('OrderForm', {});
          }}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary-600"
        >
          <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      <Dropdown
        value={statusFilter}
        onChange={setStatusFilter}
        options={STATUS_FILTERS}
        placeholder="Filter by status"
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          filtered.length === 0 ? { flexGrow: 1 } : { paddingBottom: 24, gap: 10 }
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563EB" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="tshirt"
            title={statusFilter === 'all' ? 'No orders yet' : 'No orders with this status'}
            description={
              statusFilter === 'all'
                ? 'Create a new order to start tracking it'
                : 'Try a different status filter'
            }
            actionLabel={statusFilter === 'all' ? 'New Order' : undefined}
            onAction={statusFilter === 'all' ? () => navigation.navigate('OrderForm', {}) : undefined}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}>
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900">#{item.order_number}</Text>
              <Badge type="order_status" value={item.status} />
            </View>
            <Text className="mt-1 text-sm text-gray-600">{item.customers?.name}</Text>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-xs text-gray-400">{item.cloth_type ?? 'No cloth type'}</Text>
              <Text className="text-xs text-gray-400">
                Delivery {formatDate(item.delivery_date)}
              </Text>
            </View>
            {item.priority === 'urgent' ? (
              <View className="mt-2 self-start rounded-full bg-red-50 px-2 py-0.5">
                <Text className="text-xs font-semibold text-danger">Urgent</Text>
              </View>
            ) : null}
          </Card>
        )}
      />
    </View>
  );
}
