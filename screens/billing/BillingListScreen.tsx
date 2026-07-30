import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { BillingScreenProps } from '../../navigation/types';
import type { BillWithRelations } from '../../types';

export default function BillingListScreen({ navigation }: BillingScreenProps<'BillingList'>) {
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const [bills, setBills] = useState<BillWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*, customers(name, phone), payments(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBills(data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load bills', 'error');
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

  const totalPending = bills.reduce((sum, bill) => {
    const paid = bill.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
    return sum + Math.max(Number(bill.total_amount ?? 0) - paid, 0);
  }, 0);

  if (loading) return <LoadingSpinner fullScreen text="Loading bills..." />;

  return (
    <View className="flex-1 bg-white px-5" style={{ paddingTop: insets.top + 8 }}>
      <View className="mb-3 flex-row items-center justify-between py-2">
        <Text className="text-[18px] font-semibold text-[#101828]">Billing</Text>
      </View>

      <Card className="mb-3">
        <Text className="font-sans text-sm text-gray-500">Total Pending Across All Customers</Text>
        <Text className="mt-1 text-2xl font-bold text-danger">{formatCurrency(totalPending)}</Text>
      </Card>

      <FlatList
        data={bills}
        keyExtractor={(item) => item.id}
        contentContainerStyle={bills.length === 0 ? { flexGrow: 1 } : { paddingBottom: 130, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="file-invoice"
            title="No bills yet"
            description="Create your first bill to start tracking payments"
            actionLabel="New Bill"
            onAction={() => navigation.navigate('BillForm', {})}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('BillDetail', { billId: item.id })}>
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900">
                {item.customers?.name}
              </Text>
              <Badge type="payment_status" value={item.payment_status} />
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="font-sans text-sm text-gray-500">{formatDate(item.created_at)}</Text>
              <Text className="text-sm font-semibold text-gray-900">
                {formatCurrency(item.total_amount)}
              </Text>
            </View>
          </Card>
        )}
      />

    </View>
  );
}
