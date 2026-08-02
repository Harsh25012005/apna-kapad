import { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Card,
  EmptyState,
  FilterNotice,
  Header,
  LoadingSpinner,
  useToast,
} from '../../components/ui';
import { ordersRepo } from '../../lib/data/repository';
import { useShop } from '../../context/AuthContext';
import { formatDate } from '../../lib/format';
import type { OrdersScreenProps } from '../../navigation/types';
import type { OrderListItem, OrderPriority } from '../../types';

type PriorityFilter = OrderPriority | 'all';

export default function OrderListScreen({ navigation }: OrdersScreenProps<'OrderList'>) {
  const showToast = useToast();
  const shop = useShop();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('orders');
  const { t: tCommon } = useTranslation('common');

  const PRIORITY_FILTERS: { label: string; value: PriorityFilter }[] = [
    { label: t('list.filterAllPriority'), value: 'all' },
    { label: t('list.priorityNormal'), value: 'normal' },
    { label: t('list.priorityUrgent'), value: 'urgent' },
  ];

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  // Delivered orders are hidden by default so the list answers "what's still
  // pending?" at a glance. Without a status badge there'd otherwise be no way
  // to tell a finished order from an active one.
  const [showDelivered, setShowDelivered] = useState(false);
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
  const byPriority =
    priorityFilter === 'all' ? bySearch : bySearch.filter((o) => o.priority === priorityFilter);
  const filtered = showDelivered ? byPriority : byPriority.filter((o) => o.status !== 'delivered');

  const deliveredCount = bySearch.filter((o) => o.status === 'delivered').length;
  const hasActiveFilters = priorityFilter !== 'all' || showDelivered;
  /** Nothing pending, but completed orders exist and are just hidden. */
  const allCaughtUp = filtered.length === 0 && !showDelivered && deliveredCount > 0;
  /** The priority filter (or search) is what's hiding everything. */
  const hasEmptyDueToFilter = filtered.length === 0 && !allCaughtUp && (priorityFilter !== 'all' || search.length > 0);

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
                    setPriorityFilter('all');
                    setShowDelivered(false);
                  }}
                >
                  <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">{t('list.reset')}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Completed orders — hidden by default, since the list's main
                job is showing what still needs work. */}
            <Pressable
              onPress={() => setShowDelivered((v) => !v)}
              className="min-h-[52px] flex-row items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <Text className="text-base font-medium text-gray-800 dark:text-gray-200">
                {t('list.showDelivered', { count: deliveredCount })}
              </Text>
              <View
                className={`h-6 w-6 items-center justify-center rounded-md border-2 ${
                  showDelivered ? 'border-primary-600 bg-primary-600' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {showDelivered ? <FontAwesome5 name="check" size={12} color="#FFFFFF" /> : null}
              </View>
            </Pressable>

            {/* Priority Section */}
            <View>
              <Text className="mb-2 text-base font-semibold text-gray-600 dark:text-gray-400">
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
                        className={`text-base font-semibold ${
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
              <Text className="text-base font-semibold text-white">{t('list.applyFilters')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* A filtered list is otherwise indistinguishable from an empty one. */}
      <View className="px-5 pt-2">
        <FilterNotice
          visible={hasActiveFilters}
          label={tCommon('filters.applied', {
            what: [
              priorityFilter !== 'all' ? PRIORITY_FILTERS.find((f) => f.value === priorityFilter)?.label : null,
              showDelivered ? t('list.showDelivered', { count: deliveredCount }) : null,
            ]
              .filter(Boolean)
              .join(', '),
          })}
          onClear={() => {
            setPriorityFilter('all');
            setShowDelivered(false);
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        className="px-5"
        contentContainerStyle={
          filtered.length === 0
            ? { flexGrow: 1, paddingTop: 12 }
            : { paddingTop: 12, paddingBottom: 224, gap: 10 }
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />
        }
        ListEmptyComponent={
          // Three distinct empty cases: a filter is hiding everything, every
          // order is simply completed (nothing pending — a *good* state, not
          // an error), or there genuinely are no orders yet.
          hasEmptyDueToFilter ? (
            <EmptyState icon="tshirt" title={t('list.noOrdersWithStatus')} description={t('list.tryDifferentFilter')} />
          ) : allCaughtUp ? (
            <EmptyState
              icon="check-circle"
              title={t('list.allCaughtUpTitle')}
              description={t('list.allCaughtUpDescription', { count: deliveredCount })}
              actionLabel={t('list.newOrder')}
              onAction={() => navigation.navigate('OrderForm', {})}
            />
          ) : (
            <EmptyState
              icon="tshirt"
              title={t('list.noOrdersYet')}
              description={t('list.createOrderHint')}
              actionLabel={t('list.newOrder')}
              onAction={() => navigation.navigate('OrderForm', {})}
            />
          )
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}>
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                {t('list.tokenBadge', { number: item.order_number })}
              </Text>
              {item.delivery_date ? (
                <Badge
                  label={t('list.deliveryBadge', { date: formatDate(item.delivery_date) })}
                  bg="#F3F4F6"
                  color="#374151"
                />
              ) : null}
            </View>
            <Text className="font-sans mt-1 text-base text-gray-600 dark:text-gray-300">{item.customers?.name}</Text>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="font-sans text-base text-gray-400 dark:text-gray-500">
                {item.cloth_count != null
                  ? t('list.pieces', { count: item.cloth_count })
                  : t('list.noClothCount')}
              </Text>
            </View>
            {item.priority === 'urgent' ? (
              <View className="mt-2 self-start rounded-full bg-red-50 px-2 py-0.5 dark:bg-red-950">
                <Text className="text-base font-semibold text-danger">{t('list.urgent')}</Text>
              </View>
            ) : null}
          </Card>
        )}
      />
    </View>
  );
}
