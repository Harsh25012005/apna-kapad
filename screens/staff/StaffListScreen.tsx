import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Avatar, Card, EmptyState, Header, LoadingSpinner, SearchBar, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { SettingsScreenProps } from '../../navigation/types';
import type { StaffWithOrders, WageType } from '../../types';

export default function StaffListScreen({ navigation }: SettingsScreenProps<'Staff'>) {
  const { t } = useTranslation('staff');
  const showToast = useToast();
  const WAGE_LABELS: Record<WageType, string> = {
    daily: t('wageUnit.daily'),
    monthly: t('wageUnit.monthly'),
    per_piece: t('wageUnit.per_piece'),
  };
  const [staff, setStaff] = useState<StaffWithOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [wageTypeFilter, setWageTypeFilter] = useState<WageType | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*, staff_orders(id, completed_at)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStaff(data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('list.loadError'), 'error');
    }
  }, [showToast, t]);

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

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    staff.forEach((item) => {
      if (item.role) roles.add(item.role);
    });
    return Array.from(roles).sort();
  }, [staff]);

  const wageTypeOptions: WageType[] = ['daily', 'monthly', 'per_piece'];

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((item) => {
      if (roleFilter && item.role !== roleFilter) return false;
      if (wageTypeFilter && item.wage_type !== wageTypeFilter) return false;
      if (!query) return true;
      return [item.name, item.role, item.phone].some((field) =>
        field?.toLowerCase().includes(query)
      );
    });
  }, [staff, search, roleFilter, wageTypeFilter]);

  const hasActiveFilters = Boolean(roleFilter || wageTypeFilter);

  if (loading) return <LoadingSpinner fullScreen text={t('list.loading')} />;

  return (
    <View className="flex-1 bg-white">
      <Header
        title={t('list.title')}
        onBack={() => navigation.goBack()}
        searchProps={{
          value: search,
          onChangeText: setSearch,
          placeholder: t('list.searchPlaceholder'),
          onFilterPress: () => setShowFilterModal(true),
          hasActiveFilter: hasActiveFilters,
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
              <Text className="text-base font-semibold text-gray-900">Filter Staff</Text>
              {hasActiveFilters ? (
                <Pressable
                  onPress={() => {
                    setRoleFilter(null);
                    setWageTypeFilter(null);
                  }}
                >
                  <Text className="text-xs font-semibold text-primary-600">Reset</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Wage Type Section */}
            <View>
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Wage Type
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {wageTypeOptions.map((wt) => {
                  const active = wageTypeFilter === wt;
                  return (
                    <Pressable
                      key={wt}
                      onPress={() => setWageTypeFilter(active ? null : wt)}
                      className={`rounded-full border px-3.5 py-2 ${
                        active ? 'border-primary-600 bg-primary-600' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>
                        {WAGE_LABELS[wt]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Role Section */}
            {roleOptions.length > 0 ? (
              <View>
                <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Role
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {roleOptions.map((role) => {
                    const active = roleFilter === role;
                    return (
                      <Pressable
                        key={role}
                        onPress={() => setRoleFilter(active ? null : role)}
                        className={`rounded-full border px-3.5 py-2 ${
                          active ? 'border-primary-600 bg-primary-600' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>
                          {role}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={() => setShowFilterModal(false)}
              className="items-center rounded-md bg-primary-600 py-3 active:bg-primary-700"
            >
              <Text className="text-sm font-semibold text-white">Apply Filters</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <FlatList
        data={filteredStaff}
        keyExtractor={(item) => item.id}
        className="px-5"
        contentContainerStyle={filteredStaff.length === 0 ? { flexGrow: 1, paddingTop: 12 } : { paddingTop: 12, paddingBottom: 160, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="user-friends"
            title={hasActiveFilters ? t('list.emptySearchTitle') : t('list.emptyTitle')}
            description={
              hasActiveFilters
                ? t('list.emptySearchDescription')
                : t('list.emptyDescription')
            }
            actionLabel={hasActiveFilters ? undefined : t('list.addStaff')}
            onAction={hasActiveFilters ? undefined : () => navigation.navigate('StaffForm', {})}
          />
        }
        renderItem={({ item }) => {
          const completedOrders = item.staff_orders.filter((s) => s.completed_at).length;
          return (
            <Card onPress={() => navigation.navigate('StaffDetail', { staffId: item.id })}>
              <View className="flex-row items-center">
                <Avatar name={item.name} size="md" />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                  <Text className="font-sans text-sm text-gray-500">{item.role ?? t('list.defaultRole')}</Text>
                </View>
                <View className="ml-2 items-end">
                  <Text className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.wage_amount)}
                    <Text className="font-sans text-xs text-gray-500">{WAGE_LABELS[item.wage_type]}</Text>
                  </Text>
                  <Text className="font-sans text-xs text-gray-400">{t('list.ordersDone', { count: completedOrders })}</Text>
                </View>
              </View>
            </Card>
          );
        }}
      />

    </View>
  );
}
