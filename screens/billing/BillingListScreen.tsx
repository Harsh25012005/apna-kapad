import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, Card, EmptyState, Header, LoadingSpinner, SearchBar, useToast } from '../../components/ui';
import { billsRepo } from '../../lib/data/repository';
import { useShop } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../lib/format';
import { useTranslation } from 'react-i18next';
import type { BillingScreenProps } from '../../navigation/types';
import type { BillWithRelations } from '../../types';
import type { PaymentStatus } from '../../types';

const PAYMENT_FILTERS: PaymentStatus[] = ['paid', 'partial', 'unpaid'];

export default function BillingListScreen({ navigation }: BillingScreenProps<'BillingList'>) {
  const showToast = useToast();
  const shop = useShop();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('billing');
  const [bills, setBills] = useState<BillWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setBills((await billsRepo.listWithRelations(shop.id)) as unknown as BillWithRelations[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('list.errorLoad'), 'error');
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

  const filteredBills = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bills.filter((bill) => {
      if (statusFilter && bill.payment_status !== statusFilter) return false;
      if (!query) return true;
      const name = bill.customers?.name?.toLowerCase() ?? '';
      return name.includes(query) || bill.id.toLowerCase().includes(query);
    });
  }, [bills, search, statusFilter]);

  const hasActiveFilters = Boolean(statusFilter);

  if (loading) return <LoadingSpinner fullScreen text={t('list.loading')} />;

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <Header title={t('list.title')} onBack={() => navigation.goBack()} />

      <View className="px-5 pt-3">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('list.searchPlaceholder')}
          onFilterPress={() => setShowFilterModal(true)}
          hasActiveFilter={hasActiveFilters}
        />
      </View>

      {/* Filter Modal */}
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
                <Pressable onPress={() => setStatusFilter(null)}>
                  <Text className="text-xs font-semibold text-primary-600 dark:text-primary-400">{t('list.reset')}</Text>
                </Pressable>
              ) : null}
            </View>

            <View className="gap-2">
              <Pressable
                onPress={() => {
                  setStatusFilter(null);
                  setShowFilterModal(false);
                }}
                className={`flex-row items-center justify-between rounded-lg border p-3.5 ${
                  !statusFilter ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                <Text className={`text-sm font-semibold ${!statusFilter ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
                  {t('list.allBills')}
                </Text>
                {!statusFilter ? <FontAwesome5 name="check" size={14} color="#1D4ED8" /> : null}
              </Pressable>

              {PAYMENT_FILTERS.map((status) => {
                const active = statusFilter === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => {
                      setStatusFilter(active ? null : status);
                      setShowFilterModal(false);
                    }}
                    className={`flex-row items-center justify-between rounded-lg border p-3.5 ${
                      active ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                    }`}
                  >
                    <Text className={`text-sm font-semibold capitalize ${active ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {t(`list.filters.${status}`)}
                    </Text>
                    {active ? <FontAwesome5 name="check" size={14} color="#1D4ED8" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <FlatList
        data={filteredBills}
        keyExtractor={(item) => item.id}
        className="px-5"
        contentContainerStyle={
          filteredBills.length === 0 ? { flexGrow: 1, paddingTop: 12 } : { paddingTop: 12, paddingBottom: 180, gap: 12 }
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />
        }
        ListEmptyComponent={
          search.trim() || statusFilter ? (
            <EmptyState
              icon="search"
              title={t('list.emptySearchTitle')}
              description={t('list.emptySearchDescription')}
            />
          ) : (
            <EmptyState
              icon="file-invoice"
              title={t('list.emptyTitle')}
              description={t('list.emptyDescription')}
              actionLabel={t('list.newBill')}
              onAction={() => navigation.navigate('BillForm', {})}
            />
          )
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('BillDetail', { billId: item.id })}>
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
                {item.customers?.name}
              </Text>
              <Badge type="payment_status" value={item.payment_status} />
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{formatDate(item.created_at)}</Text>
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                {formatCurrency(item.total_amount)}
              </Text>
            </View>
          </Card>
        )}
      />

    </View>
  );
}
