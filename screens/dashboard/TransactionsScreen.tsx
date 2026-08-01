import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Card, EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { customersRepo, paymentsRepo } from '../../lib/data/repository';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { useShop } from '../../context/AuthContext';
import type { DashboardScreenProps } from '../../navigation/types';
import type { Tables } from '../../lib/database.types';

type Transaction = Tables<'payments'> & { customerName: string };

export default function TransactionsScreen({ navigation }: DashboardScreenProps<'Transactions'>) {
  const { t } = useTranslation('dashboard');
  const shop = useShop();
  const showToast = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [payments, customers] = await Promise.all([
        paymentsRepo.listForShop(shop.id),
        customersRepo.list(shop.id),
      ]);
      const nameById = new Map(customers.map((c) => [c.id, c.name]));
      setTransactions(
        payments.map((p) => ({
          ...p,
          customerName: nameById.get(p.customer_id) ?? t('transactions.unknownCustomer'),
        }))
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('transactions.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [shop.id, showToast, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = transactions.filter((tx) =>
    tx.customerName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner fullScreen text={t('transactions.loading')} />;

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <Header
        title={t('transactions.title')}
        onBack={() => navigation.goBack()}
        searchProps={{
          value: search,
          onChangeText: setSearch,
          placeholder: t('transactions.searchPlaceholder'),
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        className="px-5"
        contentContainerStyle={
          filtered.length === 0 ? { flexGrow: 1, paddingTop: 12 } : { paddingTop: 12, paddingBottom: 160, gap: 10 }
        }
        ListEmptyComponent={
          <EmptyState
            icon="exchange-alt"
            title={t('transactions.emptyTitle')}
            description={t('transactions.emptyDescription')}
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950">
                <FontAwesome5 name="rupee-sign" size={16} color="#1D4ED8" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">{item.customerName}</Text>
                <Text className="font-sans mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(item.payment_date)}
                  {item.payment_mode ? ` · ${item.payment_mode}` : ''}
                </Text>
              </View>
              <Text className="text-base font-bold text-success">{formatCurrency(item.amount_paid)}</Text>
            </View>
          </Card>
        )}
      />
    </View>
  );
}
