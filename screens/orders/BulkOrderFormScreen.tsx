import { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Header, InputField, SearchBar, useToast } from '../../components/ui';
import { customersRepo, ordersRepo } from '../../lib/data/repository';
import { useShop } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/format';
import type { OrdersScreenProps } from '../../navigation/types';
import type { Customer } from '../../types';

/**
 * Creates one order per selected customer, all sharing the same garment
 * template — for school/corporate uniform batches where every customer gets
 * the identical item(s) rather than a custom order each.
 */
export default function BulkOrderFormScreen({ navigation }: OrdersScreenProps<'BulkOrderForm'>) {
  const shop = useShop();
  const showToast = useToast();
  const { t } = useTranslation('orders');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [garmentType, setGarmentType] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void customersRepo.list(shop.id).then(setCustomers);
  }, [shop.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const priceNum = Math.max(0, Number(unitPrice) || 0);
  const totalPerOrder = priceNum;
  const grandTotal = totalPerOrder * selectedIds.size;

  const handleCreate = async () => {
    if (selectedIds.size === 0) {
      setError(t('bulk.customersRequired'));
      return;
    }
    if (!garmentType.trim()) {
      setError(t('bulk.garmentTypeRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await ordersRepo.createMany(
        shop.id,
        Array.from(selectedIds),
        { status: 'order_taken', priority: 'normal', paid_amount: 0, total_amount: priceNum || null },
        [{ garment_type: garmentType.trim(), cloth_count: 1, unit_price: priceNum }]
      );
      showToast(t('bulk.success', { count: selectedIds.size }), 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('bulk.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <Header title={t('bulk.title')} onBack={() => navigation.goBack()} />
      <View className="px-5 pt-4">
        <InputField
          label={t('form.garmentType')}
          value={garmentType}
          onChangeText={setGarmentType}
          placeholder={t('form.garmentTypePlaceholder')}
          error={error}
        />
        <InputField
          label={t('form.unitPrice')}
          value={unitPrice}
          onChangeText={setUnitPrice}
          keyboardType="numeric"
        />
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('bulk.selectCustomers', { count: selectedIds.size })}
        </Text>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('list.searchPlaceholder')} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        className="px-5"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 200, gap: 4 }}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between border-b border-gray-100 py-3 dark:border-gray-800">
            <Checkbox
              checked={selectedIds.has(item.id)}
              onChange={() => toggle(item.id)}
              label={`${item.name}${item.phone ? ` · ${item.phone}` : ''}`}
            />
          </View>
        )}
      />
      <View className="border-t border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
        {grandTotal > 0 ? (
          <Text className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            {t('bulk.grandTotal', { total: formatCurrency(grandTotal) })}
          </Text>
        ) : null}
        <Button title={t('bulk.createOrders', { count: selectedIds.size })} onPress={handleCreate} loading={loading} />
      </View>
    </View>
  );
}
