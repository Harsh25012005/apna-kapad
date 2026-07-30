import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, Card, EmptyState, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { useShop } from '../../context/AuthContext';
import type { DashboardScreenProps } from '../../navigation/types';
import type { OrderListItem } from '../../types';

type Stats = {
  todaysOrders: OrderListItem[];
  pendingCount: number;
  todaysCollections: number;
  monthlySales: number;
};

/** Local-time day boundaries as ISO strings, plus the plain YYYY-MM-DD date. */
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // order_date is a DATE column, so compare it against a local calendar date
  // rather than a UTC-shifted slice of the ISO timestamp.
  const localDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
    start.getDate()
  ).padStart(2, '0')}`;

  return { start: start.toISOString(), end: end.toISOString(), localDate };
}

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default function DashboardScreen({ navigation }: DashboardScreenProps<'Dashboard'>) {
  const shop = useShop();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { start, end, localDate } = todayRange();

      const [ordersRes, pendingRes, paymentsRes, billsRes] = await Promise.all([
        supabase.from('orders').select('*, customers(name, phone)').eq('order_date', localDate),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'delivered'),
        supabase
          .from('payments')
          .select('amount_paid')
          .gte('payment_date', start)
          .lte('payment_date', end),
        supabase.from('bills').select('total_amount').gte('created_at', monthStart()),
      ]);

      setStats({
        todaysOrders: ordersRes.data ?? [],
        pendingCount: pendingRes.count ?? 0,
        todaysCollections: (paymentsRes.data ?? []).reduce(
          (s, p) => s + Number(p.amount_paid),
          0
        ),
        monthlySales: (billsRes.data ?? []).reduce((s, b) => s + Number(b.total_amount ?? 0), 0),
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load dashboard', 'error');
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

  if (loading || !stats) return <LoadingSpinner fullScreen text="Loading dashboard..." />;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 20, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563EB" />
      }
    >
      <View>
        <Text className="text-2xl font-bold text-gray-900">{shop.shop_name}</Text>
        <Text className="text-sm text-gray-500">Here&apos;s how your shop is doing today</Text>
      </View>

      <View className="flex-row gap-3">
        <StatCard
          icon="clipboard-list"
          label="Pending Orders"
          value={String(stats.pendingCount)}
          color="#D97706"
        />
        <StatCard
          icon="rupee-sign"
          label="Today's Collections"
          value={formatCurrency(stats.todaysCollections)}
          color="#16A34A"
        />
      </View>

      <Card>
        <Text className="text-sm text-gray-500">This Month&apos;s Sales</Text>
        <Text className="mt-1 text-2xl font-bold text-primary-700">
          {formatCurrency(stats.monthlySales)}
        </Text>
      </Card>

      <View>
        <Text className="mb-2 text-base font-semibold text-gray-900">Today&apos;s Orders</Text>
        {stats.todaysOrders.length === 0 ? (
          <EmptyState
            variant="compact"
            icon="calendar-day"
            title="No orders taken today"
            description="New orders placed today will show up here"
          />
        ) : (
          <View className="gap-2">
            {stats.todaysOrders.map((o) => (
              <Card key={o.id} onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-gray-900">
                    #{o.order_number} · {o.customers?.name}
                  </Text>
                  <Badge type="order_status" value={o.status} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="flex-1">
      <View
        className="mb-2 h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}1A` }}
      >
        <FontAwesome5 name={icon} size={14} color={color} />
      </View>
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text className="mt-0.5 text-lg font-bold text-gray-900">{value}</Text>
    </Card>
  );
}
