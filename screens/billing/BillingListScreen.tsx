import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, Card, EmptyState, FilterNotice, Header, LoadingSpinner, SearchBar, useToast } from '../../components/ui';
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
  const { t: tCommon } = useTranslation('common');
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

  /**
   * One row per client, not per bill. A regular customer racks up many bills
   * and the flat list made the same name repeat over and over, burying who
   * actually owes money. Each row shows that client's most recent bill plus
   * their combined outstanding total; tapping opens their full bill history.
   */
  const clientRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const byCustomer = new Map<
      string,
      { customerId: string; name: string; latest: BillWithRelations; billCount: number; outstanding: number }
    >();

    for (const bill of bills) {
      if (statusFilter && bill.payment_status !== statusFilter) continue;
      const key = bill.customer_id;
      if (!key) continue;
      const pending = Math.max(Number(bill.total_amount ?? 0) - Number((bill as { paid?: number }).paid ?? 0), 0);
      const existing = byCustomer.get(key);
      if (!existing) {
        byCustomer.set(key, {
          customerId: key,
          name: bill.customers?.name ?? '',
          latest: bill,
          billCount: 1,
          outstanding: pending,
        });
      } else {
        existing.billCount += 1;
        existing.outstanding += pending;
        if (bill.created_at > existing.latest.created_at) existing.latest = bill;
      }
    }

    return [...byCustomer.values()]
      .filter((row) => !query || row.name.toLowerCase().includes(query))
      .sort((a, b) => b.outstanding - a.outstanding || (a.latest.created_at < b.latest.created_at ? 1 : -1));
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
                  <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">{t('list.reset')}</Text>
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
                <Text className={`text-base font-semibold ${!statusFilter ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
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
                    <Text className={`text-base font-semibold capitalize ${active ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
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

      <View className="px-5 pt-2">
        <FilterNotice
          visible={hasActiveFilters}
          label={tCommon('filters.applied', { what: statusFilter ? t('list.filters.'+statusFilter) : '' })}
          onClear={() => setStatusFilter(null)}
        />
      </View>

      <FlatList
        data={clientRows}
        keyExtractor={(item) => item.customerId}
        className="px-5"
        contentContainerStyle={
          clientRows.length === 0 ? { flexGrow: 1, paddingTop: 12 } : { paddingTop: 12, paddingBottom: 224, gap: 12 }
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
          // Tapping a client opens their Bills tab — the full history lives
          // there, so the list itself stays one row per person.
          <Card
            onPress={() =>
              (navigation as unknown as { navigate: (t: string, p?: object) => void }).navigate('CustomersTab', {
                screen: 'CustomerDetail',
                params: { customerId: item.customerId, initialTab: 'bills' },
              })
            }
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">{item.name}</Text>
              <Badge type="payment_status" value={item.latest.payment_status} />
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="font-sans text-base text-gray-500 dark:text-gray-400">
                {t('list.lastBill', { date: formatDate(item.latest.created_at) })}
                {item.billCount > 1 ? ` · ${t('list.billCount', { count: item.billCount })}` : ''}
              </Text>
              <Text
                className={`text-base font-bold ${item.outstanding > 0 ? 'text-danger' : 'text-gray-900 dark:text-gray-50'}`}
              >
                {item.outstanding > 0
                  ? t('list.outstanding', { amount: formatCurrency(item.outstanding) })
                  : formatCurrency(item.latest.total_amount)}
              </Text>
            </View>
          </Card>
        )}
      />

    </View>
  );
}
