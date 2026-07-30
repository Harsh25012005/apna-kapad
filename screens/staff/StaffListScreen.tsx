import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Avatar, Card, EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { SettingsScreenProps } from '../../navigation/types';
import type { StaffWithOrders, WageType } from '../../types';

const WAGE_LABELS: Record<WageType, string> = {
  daily: '/day',
  monthly: '/month',
  per_piece: '/piece',
};

export default function StaffListScreen({ navigation }: SettingsScreenProps<'Staff'>) {
  const showToast = useToast();
  const [staff, setStaff] = useState<StaffWithOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*, staff_orders(id, completed_at)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStaff(data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load staff', 'error');
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

  if (loading) return <LoadingSpinner fullScreen text="Loading staff..." />;

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="Staff"
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={() => {
              haptics.tap();
              navigation.navigate('StaffForm', {});
            }}
            hitSlop={8}
          >
            <FontAwesome5 name="plus" size={18} color="#2563EB" />
          </Pressable>
        }
      />

      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        contentContainerStyle={staff.length === 0 ? { flexGrow: 1 } : { padding: 16, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563EB" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="user-friends"
            title="No staff added yet"
            description="Add tailors and helpers to assign orders and track wages"
            actionLabel="Add Staff"
            onAction={() => navigation.navigate('StaffForm', {})}
          />
        }
        renderItem={({ item }) => {
          const completedOrders = item.staff_orders.filter((s) => s.completed_at).length;
          return (
            <Card onPress={() => navigation.navigate('StaffForm', { staffId: item.id })}>
              <View className="flex-row items-center">
                <Avatar name={item.name} size="md" />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                  <Text className="font-sans text-sm text-gray-500">{item.role ?? 'Staff'}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.wage_amount)}
                    <Text className="font-sans text-xs text-gray-500">{WAGE_LABELS[item.wage_type]}</Text>
                  </Text>
                  <Text className="font-sans text-xs text-gray-400">{completedOrders} orders done</Text>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
