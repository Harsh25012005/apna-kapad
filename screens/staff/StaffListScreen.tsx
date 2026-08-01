import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, Card, EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { staffRepo } from '../../lib/data/repository';
import { useShop } from '../../context/AuthContext';
import type { SettingsScreenProps } from '../../navigation/types';
import type { Staff, WageType } from '../../types';

export default function StaffListScreen({ navigation }: SettingsScreenProps<'Staff'>) {
  const { t } = useTranslation('staff');
  const showToast = useToast();
  const shop = useShop();
  const WAGE_LABELS: Record<WageType, string> = {
    daily: t('wageUnit.daily'),
    monthly: t('wageUnit.monthly'),
    per_piece: t('wageUnit.per_piece'),
  };
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [wageTypeFilter, setWageTypeFilter] = useState<WageType | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setStaff(await staffRepo.list(shop.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('list.loadError'), 'error');
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

  const wageTypeOptions: WageType[] = ['daily', 'monthly', 'per_piece'];

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((item) => {
      if (wageTypeFilter && item.wage_type !== wageTypeFilter) return false;
      if (!query) return true;
      return [item.name, item.phone].some((field) => field?.toLowerCase().includes(query));
    });
  }, [staff, search, wageTypeFilter]);

  const hasActiveFilters = Boolean(wageTypeFilter);

  if (loading) return <LoadingSpinner fullScreen text={t('list.loading')} />;

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
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
          <Pressable className="rounded-t-2xl bg-white p-5 gap-4 dark:bg-gray-900" onPress={() => {}}>
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">{t('list.filterModalTitle')}</Text>
              {hasActiveFilters ? (
                <Pressable
                  onPress={() => {
                    setWageTypeFilter(null);
                  }}
                >
                  <Text className="text-xs font-semibold text-primary-600 dark:text-primary-400">{t('list.reset')}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Wage Type Section */}
            <View>
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('list.wageTypeSection')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {wageTypeOptions.map((wt) => {
                  const active = wageTypeFilter === wt;
                  return (
                    <Pressable
                      key={wt}
                      onPress={() => setWageTypeFilter(active ? null : wt)}
                      className={`rounded-full border px-3.5 py-2 ${
                        active ? 'border-primary-600 bg-primary-600' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                        {WAGE_LABELS[wt]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={() => setShowFilterModal(false)}
              className="items-center rounded-md bg-primary-600 py-3 active:bg-primary-700"
            >
              <Text className="text-sm font-semibold text-white">{t('list.applyFilters')}</Text>
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
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('StaffDetail', { staffId: item.id })}>
            <View className="flex-row items-center">
              <Avatar name={item.name} size="md" />
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">{item.name}</Text>
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{item.phone ?? t('list.noPhone')}</Text>
              </View>
              <Badge label={WAGE_LABELS[item.wage_type]} />
            </View>
          </Card>
        )}
      />

    </View>
  );
}
