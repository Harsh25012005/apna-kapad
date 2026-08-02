import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, LoadingSpinner, useToast } from '../../components/ui';
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

type RecentPaymentItem = {
  id: string;
  customerName: string;
  amount: number;
  mode: string;
  date: string;
};

type Stats = {
  todaysOrders: OrderListItem[];
  recentOrders: OrderListItem[];
  topClients: ClientItem[];
  recentPayments: RecentPaymentItem[];
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
      const { localDate } = todayRange();

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
      const billById = new Map(allBills.map((b) => [b.id, b]));

      const todaysOrders = allOrders.filter((o) => o.order_date === localDate);
      const recentOrders = [...allOrders]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 6);

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

      // Latest payments received, regardless of which bill/order they're
      // tied to — a fast "money coming in" pulse distinct from Transaction
      // History below (which is orders, not payments).
      const recentPayments: RecentPaymentItem[] = [...allPayments]
        .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1))
        .slice(0, 5)
        .map((p) => {
          const bill = billById.get(p.bill_id);
          const customer = bill?.customer_id ? customerById.get(bill.customer_id) : null;
          return {
            id: p.id,
            customerName: customer?.name ?? t('customer'),
            amount: Number(p.amount_paid ?? 0),
            mode: p.payment_mode ?? '',
            date: p.payment_date,
          };
        });

      setStats({
        todaysOrders,
        recentOrders,
        topClients,
        recentPayments,
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
    <>
    <ScrollView
      className="flex-1 bg-white dark:bg-gray-950"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 224 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />
      }
    >
      {/* Topbar Header — every icon carries a visible text label, not just a
          glyph, since a lone bell/calendar icon isn't self-explanatory. */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Text className="text-[18px] font-semibold text-[#101828] dark:text-gray-50">
          {t('greeting', { name: shop.shop_name || t('defaultUser') })}
        </Text>
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => navigation.navigate('Calendar')}
            className="min-h-[48px] flex-row items-center gap-1.5 rounded-full px-2.5 active:bg-gray-100 dark:active:bg-gray-800"
          >
            <Ionicons name="calendar-outline" size={20} color={scheme === 'dark' ? '#F3F4F6' : '#101828'} />
            <Text className="font-sans text-base font-medium text-[#101828] dark:text-gray-50">{t('calendarNavLabel')}</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            className="min-h-[48px] flex-row items-center gap-1.5 rounded-full px-2.5 active:bg-gray-100 dark:active:bg-gray-800"
          >
            <Ionicons name="notifications-outline" size={20} color={scheme === 'dark' ? '#F3F4F6' : '#101828'} />
            <Text className="font-sans text-base font-medium text-[#101828] dark:text-gray-50">{t('alerts')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Tappable search field — opens the dedicated Search screen rather
          than filtering in place, so it works the same way from anywhere
          in the app the pattern gets reused. */}
      <View className="mb-4 px-5">
        <Pressable
          onPress={() => navigation.navigate('Search')}
          className="h-[48px] flex-row items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <Ionicons name="search-outline" size={18} color={scheme === 'dark' ? '#9CA3AF' : '#6B7280'} />
          <Text className="font-sans text-base text-gray-400 dark:text-gray-500">{t('searchPlaceholder')}</Text>
        </Pressable>
      </View>

      {/* The "3 questions, no scrolling" zone: what's due today, who owes me,
          what needs attention — answered as two big glanceable tiles plus an
          alert strip, each tappable straight into the filtered list. */}
      <View className="mb-4 flex-row gap-3 px-5">
        <Pressable
          onPress={() => navigation.navigate('OrdersTab' as any)}
          className="flex-1 rounded-lg border border-gray-200 bg-white p-4 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:active:bg-gray-800"
        >
          <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
            <FontAwesome5 name="box-open" size={16} color="#1D4ED8" />
          </View>
          <Text className="font-sans text-base font-medium text-gray-500 dark:text-gray-400">{t('dueToday.title')}</Text>
          <Text className="mt-0.5 text-[22px] font-bold text-[#101828] dark:text-gray-50">
            {t('dueToday.count', { count: stats.todaysOrders.length })}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('SettingsTab' as any, { screen: 'Billing' })}
          className="flex-1 rounded-lg border border-gray-200 bg-white p-4 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:active:bg-gray-800"
        >
          <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950">
            <FontAwesome5 name="rupee-sign" size={16} color={amberIconColor} />
          </View>
          <Text className="font-sans text-base font-medium text-gray-500 dark:text-gray-400">{t('owedToday.title')}</Text>
          <Text className="mt-0.5 text-[22px] font-bold text-[#101828] dark:text-gray-50">
            {formatCurrency(stats.totalPendingBalance)}
          </Text>
        </Pressable>
      </View>


      {/* One primary action, unambiguous but no longer the oversized 56px
          hero button — medium size reads as "the main action" without
          dominating the whole screen. Adding a client/bill/staff member
          still lives one tap away in the Quick-Add FAB. */}
      <View className="mb-6 px-5">
        <Button
          title={t('newOrder')}
          icon={<Ionicons name="add" size={20} color="#FFFFFF" />}
          size="md"
          onPress={() => {
            haptics.tap();
            navigation.navigate('OrderForm', {});
          }}
        />
      </View>

      {/* Quick Send & Transactions Sheet Container */}
      <View className="flex-1 bg-white dark:bg-gray-950">

        {/* Top Clients — ranked by order count */}
        <View className="mb-6 px-5">
          <Text className="mb-3 text-base font-semibold text-[#101828] dark:text-gray-50">{t('topClients')}</Text>
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
                    <Text className="font-sans text-base font-medium text-[#101828] dark:text-gray-50 text-center" numberOfLines={1}>
                      {client.name.split(' ')[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Recent Payments — a fast "money coming in" pulse, distinct from
            Transaction History below (which lists orders, not payments). */}
        <View className="mb-6 px-5">
          <Text className="mb-3 text-base font-semibold text-[#101828] dark:text-gray-50">
            {t('recentPayments.title')}
          </Text>
          {stats.recentPayments.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="rupee-sign"
              title={t('recentPayments.emptyTitle')}
              description={t('recentPayments.emptyDescription')}
            />
          ) : (
            <View className="gap-2.5">
              {stats.recentPayments.map((payment) => (
                <View
                  key={payment.id}
                  className="flex-row items-center justify-between rounded-md border border-gray-200 bg-[#F9FAFB] px-4 py-3.5 dark:border-gray-700 dark:bg-gray-800"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-semibold text-[#101828] dark:text-gray-50" numberOfLines={1}>
                      {payment.customerName}
                    </Text>
                    <Text className="font-sans text-base text-gray-500 dark:text-gray-400">
                      {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {payment.mode ? ` · ${payment.mode}` : ''}
                    </Text>
                  </View>
                  <Text className="text-base font-bold text-green-600">{formatCurrency(payment.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Transaction History / Recent Activity */}
        <View className="px-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-[#101828] dark:text-gray-50">{t('transactionHistory')}</Text>
            {stats.recentOrders.length > 0 ? (
              <Pressable onPress={() => navigation.navigate('Transactions')}>
                <Text className="text-base font-medium text-[#1D4ED8] underline">{t('viewAll')}</Text>
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
                        <Text className="text-base font-semibold text-[#101828] dark:text-gray-50" numberOfLines={1}>
                          #{o.order_number} · {o.customers?.name || t('customer')}
                        </Text>
                        <Text className="font-sans text-base font-medium text-[#667085] dark:text-gray-400">
                          {dateStr}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text className="text-base font-semibold text-[#101828] dark:text-gray-50">
                        {o.cloth_type || t('garmentOrder')}
                      </Text>
                      <Text
                        className={`text-base font-medium ${isDelivered ? 'text-[#12B76A]' : 'text-amber-600'
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

    </>
  );
}
