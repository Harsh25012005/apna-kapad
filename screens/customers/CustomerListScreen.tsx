import { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Avatar, Card, EmptyState, Header, LoadingSpinner, SearchBar, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { CustomersScreenProps } from '../../navigation/types';
import type { CustomerWithBalance } from '../../types';

async function fetchCustomersWithBalance(): Promise<CustomerWithBalance[]> {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, phone')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: bills, error: billsError } = await supabase
    .from('bills')
    .select('customer_id, total_amount, payments(amount_paid)');
  if (billsError) throw billsError;

  const balanceByCustomer: Record<string, number> = {};
  for (const bill of bills ?? []) {
    const paid = bill.payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
    const pending = Math.max(Number(bill.total_amount ?? 0) - paid, 0);
    balanceByCustomer[bill.customer_id] = (balanceByCustomer[bill.customer_id] ?? 0) + pending;
  }

  return (customers ?? []).map((c) => ({ ...c, balance: balanceByCustomer[c.id] ?? 0 }));
}

export default function CustomerListScreen({ navigation }: CustomersScreenProps<'CustomerList'>) {
  const { t } = useTranslation('customers');
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [search, setSearch] = useState('');
  const [balanceOnly, setBalanceOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setCustomers(await fetchCustomersWithBalance());
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('list.loadError'), 'error');
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

  const filtered = customers.filter(
    (c) =>
      (c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search)) &&
      (!balanceOnly || c.balance > 0)
  );

  if (loading) return <LoadingSpinner fullScreen text={t('list.loading')} />;

  return (
    <View className="flex-1 bg-white">
      <Header
        showBack={false}
        title={t('list.title')}
        searchProps={{
          value: search,
          onChangeText: setSearch,
          placeholder: t('list.searchPlaceholder'),
          onFilterPress: () => setShowFilterModal(true),
          hasActiveFilter: balanceOnly,
        }}
      />

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
          <Pressable className="rounded-t-2xl bg-white p-5 gap-4" onPress={() => {}}>
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <Text className="text-base font-semibold text-gray-900">Filter Customers</Text>
              {balanceOnly ? (
                <Pressable onPress={() => setBalanceOnly(false)}>
                  <Text className="text-xs font-semibold text-primary-600">Reset</Text>
                </Pressable>
              ) : null}
            </View>

            <View className="gap-2">
              <Pressable
                onPress={() => {
                  setBalanceOnly(false);
                  setShowFilterModal(false);
                }}
                className={`flex-row items-center justify-between rounded-lg border p-3.5 ${
                  !balanceOnly ? 'border-primary-600 bg-primary-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text className={`text-sm font-semibold ${!balanceOnly ? 'text-primary-700' : 'text-gray-700'}`}>
                  All Customers
                </Text>
                {!balanceOnly ? <FontAwesome5 name="check" size={14} color="#1D4ED8" /> : null}
              </Pressable>

              <Pressable
                onPress={() => {
                  setBalanceOnly(true);
                  setShowFilterModal(false);
                }}
                className={`flex-row items-center justify-between rounded-lg border p-3.5 ${
                  balanceOnly ? 'border-primary-600 bg-primary-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text className={`text-sm font-semibold ${balanceOnly ? 'text-primary-700' : 'text-gray-700'}`}>
                  {t('list.hasBalanceFilter')}
                </Text>
                {balanceOnly ? <FontAwesome5 name="check" size={14} color="#1D4ED8" /> : null}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        className="px-5"
        contentContainerStyle={
          filtered.length === 0 ? { flexGrow: 1, paddingTop: 12 } : { paddingTop: 12, paddingBottom: 160, gap: 10 }
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="users"
            title={search ? t('list.emptySearchTitle') : t('list.emptyTitle')}
            description={
              search
                ? t('list.emptySearchDescription')
                : t('list.emptyDescription')
            }
            actionLabel={search ? undefined : t('list.addCustomer')}
            onAction={search ? undefined : () => navigation.navigate('CustomerForm')}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}>
            <View className="flex-row items-center">
              <Avatar name={item.name} size="md" />
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                <Text className="font-sans text-sm text-gray-500">{item.phone ?? t('list.noPhone')}</Text>
              </View>
              {item.balance > 0 ? (
                <Text className="ml-2 text-sm font-semibold text-danger">
                  {formatCurrency(item.balance)}
                </Text>
              ) : (
                <Text className="ml-2 font-sans text-sm text-success">{t('list.settled')}</Text>
              )}
            </View>
          </Card>
        )}
      />
    </View>
  );
}
