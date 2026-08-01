import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingSpinner, useToast } from '../../components/ui';
import { ordersRepo, customersRepo, billsRepo, paymentsRepo } from '../../lib/data/repository';
import { formatCurrency } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { hasSeenProductTour, markProductTourSeen } from '../../lib/productTour';
import { useShop } from '../../context/AuthContext';
import { useProductTour } from '../../context/ProductTourContext';
import { useTheme } from '../../context/ThemeContext';
import type { DashboardScreenProps } from '../../navigation/types';
import type { OrderListItem } from '../../types';

type ClientItem = {
  id: string;
  name: string;
  phone: string | null;
};

type Stats = {
  todaysOrders: OrderListItem[];
  recentOrders: OrderListItem[];
  dueSoonOrders: OrderListItem[];
  topClients: ClientItem[];
  pendingCount: number;
  todaysCollections: number;
  /** Set only when todaysCollections falls back to the most recent day with
   *  any payments, so the card can show a "as of <date>" label instead of
   *  silently displaying a stale number as if it were today's. */
  collectionsDate: string | null;
  monthlySales: number;
  totalPendingBalance: number;
  unpaidBillsCount: number;
};

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
];

/** Local-time day boundaries as ISO strings, plus the plain YYYY-MM-DD date. */
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

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
  const { t } = useTranslation('dashboard');
  const { scheme } = useTheme();
  const amberIconColor = scheme === 'dark' ? '#FCD34D' : '#B45309';
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tour = useProductTour();

  // First visit to the home page after signing up: show the tour once,
  // then never again on this device for this shop.
  useEffect(() => {
    let cancelled = false;
    void hasSeenProductTour(shop.id).then((seen) => {
      if (!seen && !cancelled) {
        void markProductTourSeen(shop.id);
        tour.start();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id]);

  const load = useCallback(async () => {
    try {
      const { start, end, localDate } = todayRange();
      const weekAhead = new Date();
      weekAhead.setDate(weekAhead.getDate() + 7);
      const weekAheadDate = weekAhead.toISOString().slice(0, 10);
      const monthStartIso = monthStart();

      // Everything reads from the local-first mirror (same one every
      // create/order/payment flow writes through) rather than Supabase
      // directly, so the dashboard reflects the real current data instead of
      // racing the background sync.
      const [allOrders, customers, allBills, allPayments] = await Promise.all([
        ordersRepo.listWithCustomer(shop.id),
        customersRepo.list(shop.id),
        billsRepo.list(shop.id),
        paymentsRepo.listForShop(shop.id),
      ]);
      const customerById = new Map(customers.map((c) => [c.id, c]));

      const todaysOrders = allOrders.filter((o) => o.order_date === localDate);
      const recentOrders = [...allOrders]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 6);
      const dueSoonOrders = allOrders
        .filter(
          (o) =>
            o.delivery_date != null &&
            o.delivery_date <= weekAheadDate &&
            o.status !== 'delivered'
        )
        .sort((a, b) => (a.delivery_date! < b.delivery_date! ? -1 : 1))
        .slice(0, 6);
      const pendingCount = allOrders.filter((o) => o.status !== 'delivered').length;

      // "Top clients" = best customers, ranked by how many orders they've
      // placed (ties broken by total value billed to them). Customers with no
      // orders at all are excluded — the row is meant to surface regulars.
      const customerScores = new Map<string, { orders: number; value: number }>();
      for (const o of allOrders) {
        if (!o.customer_id) continue;
        const prev = customerScores.get(o.customer_id) ?? { orders: 0, value: 0 };
        customerScores.set(o.customer_id, {
          orders: prev.orders + 1,
          value: prev.value + Number(o.total_amount ?? 0),
        });
      }
      const topClients: ClientItem[] = [...customerScores.entries()]
        .sort((a, b) => b[1].orders - a[1].orders || b[1].value - a[1].value)
        .slice(0, 8)
        .map(([id]) => customerById.get(id))
        .filter((c): c is (typeof customers)[number] => !!c)
        .map((c) => ({ id: c.id, name: c.name, phone: c.phone }));

      const paymentsByBill = new Map<string, number>();
      for (const p of allPayments) {
        paymentsByBill.set(p.bill_id, (paymentsByBill.get(p.bill_id) ?? 0) + Number(p.amount_paid));
      }
      const totalPendingBalance = allBills.reduce((sum, bill) => {
        const paid = paymentsByBill.get(bill.id) ?? 0;
        return sum + Math.max(Number(bill.total_amount ?? 0) - paid, 0);
      }, 0);
      const unpaidBillsCount = allBills.filter((b) => b.payment_status !== 'paid').length;
      const monthlySales = allBills
        .filter((b) => b.created_at >= monthStartIso)
        .reduce((s, b) => s + Number(b.total_amount ?? 0), 0);

      let todaysCollections = allPayments
        .filter((p) => p.payment_date >= start && p.payment_date <= end)
        .reduce((s, p) => s + Number(p.amount_paid), 0);
      let collectionsDate: string | null = null;

      // No payments today — fall back to the most recent day that had any,
      // rather than showing a flat ₹0 on the main hero card every morning.
      if (todaysCollections === 0 && allPayments.length > 0) {
        const lastPayment = [...allPayments].sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1))[0];
        const lastDate = lastPayment.payment_date.slice(0, 10);
        todaysCollections = allPayments
          .filter((p) => p.payment_date.slice(0, 10) === lastDate)
          .reduce((s, p) => s + Number(p.amount_paid), 0);
        collectionsDate = lastDate;
      }

      setStats({
        todaysOrders,
        recentOrders,
        dueSoonOrders,
        topClients,
        pendingCount,
        todaysCollections,
        collectionsDate,
        monthlySales,
        totalPendingBalance,
        unpaidBillsCount,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('errorLoad'), 'error');
    }
  }, [showToast, t, shop.id]);

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

  if (loading || !stats) return <LoadingSpinner fullScreen text={t('loading')} />;

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-gray-950"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 160 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />
      }
    >
      {/* Topbar Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Text className="text-[18px] font-semibold text-[#101828] dark:text-gray-50">
          {t('greeting', { name: shop.shop_name || t('defaultUser') })}
        </Text>
        <View className="flex-row items-center">
          <Pressable
            onPress={() => navigation.navigate('Calendar')}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
          >
            <Ionicons name="calendar-outline" size={22} color={scheme === 'dark' ? '#F3F4F6' : '#101828'} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
          >
            <Ionicons name="notifications-outline" size={22} color={scheme === 'dark' ? '#F3F4F6' : '#101828'} />
          </Pressable>
        </View>
      </View>

      {/* Balance Hero Card */}
      <View className="mx-5 mb-4 rounded-lg bg-[#101828] p-4 shadow-md dark:border dark:border-gray-700">
        <View className="flex-row items-start justify-between">
          <View className="gap-1">
            <Text className="font-sans text-[14px] font-medium text-[#98A2B3]">
              {stats.collectionsDate
                ? t('collectionsAsOf', {
                    date: new Date(stats.collectionsDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    }),
                  })
                : t('todaysCollections')}
            </Text>
            <Text className="text-[36px] font-medium text-white tracking-tight">
              {formatCurrency(stats.todaysCollections)}
            </Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-lg bg-[#1D4ED8]/20">
            <FontAwesome5 name="rupee-sign" size={20} color="#1D4ED8" />
          </View>
        </View>

        {/* Action Buttons */}
        <View className="mt-4 flex-row gap-3">
          <Pressable
            onPress={() => {
              haptics.tap();
              navigation.navigate('OrderForm', {});
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md bg-[#1D4ED8] py-3 active:bg-blue-700"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text className="font-sans text-[16px] font-medium text-white">{t('order')}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.tap();
              navigation.navigate('CustomersTab' as any, { screen: 'CustomerForm' });
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md bg-[#1D2939] py-3 active:bg-gray-800 border border-white/15"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text className="font-sans text-[16px] font-medium text-white">{t('client')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Pending Payments */}
      {stats.unpaidBillsCount > 0 ? (
        <Pressable
          onPress={() => navigation.navigate('SettingsTab' as any, { screen: 'Billing' })}
          className="mx-5 mb-4 flex-row items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-4 active:bg-amber-100 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:active:bg-amber-900"
        >
          <View className="flex-1 flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <FontAwesome5 name="exclamation-circle" size={16} color={amberIconColor} />
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-semibold text-[#101828] dark:text-gray-50">{t('pendingPayments.title')}</Text>
              <Text className="font-sans text-[12px] font-medium text-[#B45309] dark:text-amber-300">
                {t('pendingPayments.subtitle', { count: stats.unpaidBillsCount })}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-[16px] font-semibold text-[#B45309] dark:text-amber-300">
              {formatCurrency(stats.totalPendingBalance)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={amberIconColor} />
          </View>
        </Pressable>
      ) : null}

      {/* Quick Send & Transactions Sheet Container */}
      <View className="flex-1 bg-white dark:bg-gray-950">

        {/* Top Clients — ranked by order count */}
        <View className="mb-6 px-5">
          <Text className="mb-3 text-[14px] font-semibold text-[#101828] dark:text-gray-50">{t('topClients')}</Text>
          {stats.topClients.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="user-friends"
              title={t('emptyTopClients.title')}
              description={t('emptyTopClients.description')}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 14 }}
            >
              {stats.topClients.map((client, idx) => {
                const initial = client.name ? client.name.charAt(0).toUpperCase() : 'C';
                const colorStyle = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <Pressable
                    key={client.id}
                    onPress={() =>
                      navigation.navigate('CustomersTab' as any, {
                        screen: 'CustomerDetail',
                        params: { customerId: client.id },
                      })
                    }
                    className="w-[54px] items-center gap-1"
                  >
                    <View className={`h-[54px] w-[54px] items-center justify-center rounded-full ${colorStyle.bg}`}>
                      <Text className={`text-[18px] font-semibold ${colorStyle.text}`}>{initial}</Text>
                    </View>
                    <Text className="font-sans text-[12px] font-medium text-[#101828] dark:text-gray-50 text-center" numberOfLines={1}>
                      {client.name.split(' ')[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Orders Due Soon — capped at 3 here, the rest live in the Orders tab */}
        <View className="mb-6 px-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[14px] font-semibold text-[#101828] dark:text-gray-50">{t('dueSoon.title')}</Text>
            {stats.dueSoonOrders.length > 0 ? (
              <Pressable onPress={() => navigation.navigate('OrdersTab' as any)}>
                <Text className="text-[12px] font-medium text-[#1D4ED8] underline">{t('viewAll')}</Text>
              </Pressable>
            ) : null}
          </View>
          {stats.dueSoonOrders.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="calendar-check"
              title={t('dueSoon.emptyTitle')}
              description={t('dueSoon.emptyDescription')}
            />
          ) : (
            <View className="gap-2.5">
              {stats.dueSoonOrders.slice(0, 3).map((o) => {
                const dateStr = o.delivery_date
                  ? new Date(o.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '';
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                    className="flex-row items-center justify-between rounded-md border border-gray-200 bg-[#F9FAFB] px-4 py-3.5 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <View className="flex-1">
                      <Text className="text-[14px] font-semibold text-[#101828] dark:text-gray-50" numberOfLines={1}>
                        #{o.order_number} · {o.customers?.name || t('customer')}
                      </Text>
                      <Text className="font-sans text-[12px] font-medium text-[#667085] dark:text-gray-400">
                        {o.cloth_type || t('garmentOrder')}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[12px] font-semibold text-[#1D4ED8]">{dateStr}</Text>
                      <Text className="font-sans text-[11px] font-medium text-[#667085] dark:text-gray-400">
                        {o.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Transaction History / Recent Activity */}
        <View className="px-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[14px] font-semibold text-[#101828] dark:text-gray-50">{t('transactionHistory')}</Text>
            {stats.recentOrders.length > 0 ? (
              <Pressable onPress={() => navigation.navigate('Transactions')}>
                <Text className="text-[12px] font-medium text-[#1D4ED8] underline">{t('viewAll')}</Text>
              </Pressable>
            ) : null}
          </View>

          {stats.recentOrders.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="calendar-day"
              title={t('emptyTransactionsTitle')}
              description={t('emptyTransactionsDescription')}
            />
          ) : (
            <View className="gap-3">
              {stats.recentOrders.map((o) => {
                const isDelivered = o.status === 'delivered';
                const dateStr = o.order_date
                  ? new Date(o.order_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  : 'Recent';

                return (
                  <Pressable
                    key={o.id}
                    onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                    className="flex-row items-center justify-between rounded-xl py-2"
                  >
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className="h-[48px] w-[48px] items-center justify-center rounded-full bg-[#F4F6F9] dark:bg-gray-800">
                        <FontAwesome5 name="shopping-bag" size={18} color="#1D4ED8" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[15px] font-semibold text-[#101828] dark:text-gray-50" numberOfLines={1}>
                          #{o.order_number} · {o.customers?.name || t('customer')}
                        </Text>
                        <Text className="font-sans text-[12px] font-medium text-[#667085] dark:text-gray-400">
                          {dateStr}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text className="text-[14px] font-semibold text-[#101828] dark:text-gray-50">
                        {o.cloth_type || t('garmentOrder')}
                      </Text>
                      <Text
                        className={`text-[12px] font-medium ${isDelivered ? 'text-[#12B76A]' : 'text-amber-600'
                          }`}
                      >
                        {o.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
