import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Avatar, Card, EmptyState, InputField, LoadingSpinner, useToast } from '../../components/ui';
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
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setCustomers(await fetchCustomersWithBalance());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load customers', 'error');
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
      c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search)
  );

  if (loading) return <LoadingSpinner fullScreen text="Loading customers..." />;

  return (
    <View className="flex-1 bg-gray-50 px-4" style={{ paddingTop: insets.top + 20 }}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">Customers</Text>
        <Pressable
          onPress={() => {
            haptics.tap();
            navigation.navigate('CustomerForm');
          }}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary-600"
        >
          <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      <InputField
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or phone"
        leftIcon="search"
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
            icon="users"
            title={search ? 'No matching customers' : 'No customers yet'}
            description={
              search
                ? 'Try a different name or phone number'
                : 'Add your first customer to get started'
            }
            actionLabel={search ? undefined : 'Add Customer'}
            onAction={search ? undefined : () => navigation.navigate('CustomerForm')}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}>
            <View className="flex-row items-center">
              <Avatar name={item.name} size="md" />
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                <Text className="font-sans text-sm text-gray-500">{item.phone ?? 'No phone'}</Text>
              </View>
              {item.balance > 0 ? (
                <Text className="text-sm font-semibold text-danger">
                  {formatCurrency(item.balance)}
                </Text>
              ) : (
                <Text className="font-sans text-sm text-success">Settled</Text>
              )}
            </View>
          </Card>
        )}
      />
    </View>
  );
}
