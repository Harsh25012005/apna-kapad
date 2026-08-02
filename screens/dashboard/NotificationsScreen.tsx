import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { DashboardScreenProps } from '../../navigation/types';
import type { Enums } from '../../lib/database.types';

type NotificationRow = {
  id: string;
  sent_at: string | null;
  status: Enums<'notification_status'>;
  type: Enums<'notification_type'>;
  customers: { name: string } | null;
};

const TYPE_META: Record<
  Enums<'notification_type'>,
  { icon: React.ComponentProps<typeof FontAwesome5>['name']; bg: string; color: string }
> = {
  order_ready: { icon: 'check-circle', bg: 'bg-emerald-50 dark:bg-emerald-950', color: '#047857' },
  payment_due: { icon: 'rupee-sign', bg: 'bg-amber-50 dark:bg-amber-950', color: '#B45309' },
};

function relativeTime(dateString: string | null, t: TFunction<'dashboard'>): string {
  if (!dateString) return '';
  const then = new Date(dateString).getTime();
  const diffMs = Date.now() - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return t('notifications.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('notifications.minutesAgo', { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t('notifications.hoursAgo', { count: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return t('notifications.daysAgo', { count: diffDay });
  return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function NotificationsScreen({ navigation }: DashboardScreenProps<'Notifications'>) {
  const showToast = useToast();
  const { t } = useTranslation('dashboard');
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notifications_log')
        .select('id, sent_at, status, type, customers(name)')
        .order('sent_at', { ascending: false })
        .order('id', { ascending: false });
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('notifications.errorLoad'), 'error');
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

  if (loading) return <LoadingSpinner fullScreen text={t('notifications.loading')} />;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Header title={t('notifications.title')} onBack={() => navigation.goBack()} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          items.length === 0 ? { flexGrow: 1 } : { padding: 16, gap: 10 }
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="bell"
            title={t('notifications.emptyTitle')}
            description={t('notifications.emptyDescription')}
          />
        }
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type];
          return (
            <View className="flex-row items-center rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.bg}`}>
                <FontAwesome5 name={meta.icon} size={16} color={meta.color} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
                  {t(`notifications.types.${item.type}`)} · {item.customers?.name ?? t('notifications.customer')}
                </Text>
                <Text className="font-sans mt-0.5 text-base text-gray-500 dark:text-gray-400">
                  {relativeTime(item.sent_at, t)}
                  {item.status !== 'sent' ? ` · ${item.status}` : ''}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
