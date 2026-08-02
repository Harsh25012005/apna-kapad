import { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Card,
  EmptyState,
  Header,
  LoadingSpinner,
  useToast,
} from '../../components/ui';
import { ordersRepo } from '../../lib/data/repository';
import { useShop } from '../../context/AuthContext';
import { formatDate } from '../../lib/format';
import type { OrdersScreenProps } from '../../navigation/types';
import type { OrderListItem, OrderPriority, OrderStatus } from '../../types';

type StatusFilter = OrderStatus | 'all';
type PriorityFilter = OrderPriority | 'all';

export default function OrderListScreen({ navigation }: OrdersScreenProps<'OrderList'>) {
  const showToast = useToast();
  const shop = useShop();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('orders');

  const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
    { label: t('list.filterAll'), value: 'all' },
    { label: t('list.filterOrderTaken'), value: 'order_taken' },
    { label: t('list.filterCutting'), value: 'cutting' },
    { label: t('list.filterStitching'), value: 'stitching' },
    { label: t('list.filterReady'), value: 'ready' },
    { label: t('list.filterDelivered'), value: 'delivered' },
  ];

  const PRIORITY_FILTERS: { label: string; value: PriorityFilter }[] = [
    { label: t('list.filterAllPriority'), value: 'all' },
    { label: t('list.priorityNormal'), value: 'normal' },
    { label: t('list.priorityUrgent'), value: 'urgent' },
  ];

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrders(await ordersRepo.listWithCustomer(shop.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('list.loadOrdersFailed'), 'error');
    }
  }, [showToast, shop.id]);

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

  const bySearch = orders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.customers?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const byStatus =
    statusFilter === 'all' ? bySearch : bySearch.filter((o) => o.status === statusFilter);
  const filtered =
    priorityFilter === 'all' ? byStatus : byStatus.filter((o) => o.priority === priorityFilter);

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all';

  if (loading) return <LoadingSpinner fullScreen text={t('list.loadingOrders')} />;

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <Header
        showBack={false}
        title={t('list.title')}
        searchProps={{
          value: search,
          onChangeText: setSearch,
          placeholder: t('list.searchPlaceholder'),
          onFilterPress: () => setShowFilterModal(true),
          hasActiveFilter: hasActiveFilters,
        }}
      />

      {/* Filter Dropdown Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setShowFilterModal(false)}
        >
          <Pressable
            className="rounded-t-2xl bg-white p-5 gap-4 dark:bg-gray-900"
            style={{ paddingBottom: insets.bottom + 20 }}
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">{t('list.filterModalTitle')}</Text>
              {hasActiveFilters ? (
                <Pressable
                  onPress={() => {
                    setStatusFilter('all');
                    setPriorityFilter('all');
                  }}
                >
                  <Text className="text-xs font-semibold text-primary-600 dark:text-primary-400">{t('list.reset')}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Status Section */}
            <View>
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('list.statusSection')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {STATUS_FILTERS.map((item) => {
                  const active = statusFilter === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setStatusFilter(item.value)}
                      className={`rounded-full border px-3.5 py-2 ${
                        active
                          ? 'border-primary-600 bg-primary-600'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          active ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Priority Section */}
            <View>
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('list.prioritySection')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {PRIORITY_FILTERS.map((item) => {
                  const active = priorityFilter === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setPriorityFilter(item.value)}
                      className={`rounded-full border px-3.5 py-2 ${
                        active
                          ? 'border-primary-600 bg-primary-600'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          active ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={() => setShowFilterModal(false)}
              className="mt-2 items-center rounded-md bg-primary-600 py-3 active:bg-primary-700"
            >
              <Text className="text-sm font-semibold text-white">{t('list.applyFilters')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        className="px-5"
        contentContainerStyle={
          filtered.length === 0
            ? { flexGrow: 1, paddingTop: 12 }
            : { paddingTop: 12, paddingBottom: 180, gap: 10 }
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="tshirt"
            title={hasActiveFilters ? t('list.noOrdersWithStatus') : t('list.noOrdersYet')}
            description={hasActiveFilters ? t('list.tryDifferentFilter') : t('list.createOrderHint')}
            actionLabel={!hasActiveFilters ? t('list.newOrder') : undefined}
            onAction={!hasActiveFilters ? () => navigation.navigate('OrderForm', {}) : undefined}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}>
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">#{item.order_number}</Text>
              <Badge type="order_status" value={item.status} />
            </View>
            <Text className="font-sans mt-1 text-sm text-gray-600 dark:text-gray-300">{item.customers?.name}</Text>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="font-sans text-xs text-gray-400 dark:text-gray-500">
                {item.cloth_count != null
                  ? t('list.pieces', { count: item.cloth_count })
                  : t('list.noClothCount')}
              </Text>
              <Text className="font-sans text-xs text-gray-400 dark:text-gray-500">
                {t('list.delivery', { date: formatDate(item.delivery_date) })}
              </Text>
            </View>
            {item.priority === 'urgent' ? (
              <View className="mt-2 self-start rounded-full bg-red-50 px-2 py-0.5 dark:bg-red-950">
                <Text className="text-xs font-semibold text-danger">{t('list.urgent')}</Text>
              </View>
            ) : null}
          </Card>
        )}
      />
    </View>
  );
}
