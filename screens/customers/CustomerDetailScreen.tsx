import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Avatar, Badge, Card, EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { customersRepo, ordersRepo, billsRepo } from '../../lib/data/repository';
import { formatCurrency, formatDate } from '../../lib/format';
import { sendWhatsAppMessage, buildPaymentDueMessage } from '../../lib/whatsapp';
import { useShop } from '../../context/AuthContext';
import type { CustomersScreenProps } from '../../navigation/types';
import type { Customer, Measurement, Order } from '../../types';

export default function CustomerDetailScreen({
  navigation,
  route,
}: CustomersScreenProps<'CustomerDetail'>) {
  const { t } = useTranslation('customers');
  const { customerId } = route.params;
  const shop = useShop();
  const showToast = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Core record + orders + balance all come from the local-first mirror,
      // so they load reliably offline and don't race the background sync.
      const [customerData, allOrders, balanceByCustomer] = await Promise.all([
        customersRepo.get(customerId),
        ordersRepo.list(shop.id),
        billsRepo.pendingBalanceByCustomer(shop.id),
      ]);

      if (!customerData) {
        // Client no longer exists (e.g. deleted elsewhere) — just leave, no
        // need to surface a technical error for something the user can't act on.
        navigation.goBack();
        return;
      }

      setCustomer(customerData);
      setOrders(
        allOrders
          .filter((o) => o.customer_id === customerId)
          .sort((a, b) => (a.order_date < b.order_date ? 1 : -1))
      );
      setBalance(balanceByCustomer[customerId] ?? 0);

      // Measurements aren't mirrored locally, so a transient network blip
      // here shouldn't take down the rest of an otherwise-loaded page.
      try {
        const { data } = await supabase
          .from('measurements')
          .select('*')
          .eq('customer_id', customerId)
          .order('updated_at', { ascending: false });
        setMeasurements(data ?? []);
      } catch {
        setMeasurements([]);
      }
    } catch {
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [customerId, navigation, shop.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleDeleteCustomer = () => {
    if (!customer) return;
    Alert.alert(
      t('detail.deleteConfirmTitle'),
      t('detail.deleteConfirmMessage', { name: customer.name }),
      [
        { text: t('detail.cancel'), style: 'cancel' },
        {
          text: t('detail.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await customersRepo.remove(customerId, shop.id);
              showToast(t('detail.deleteSuccess'), 'success');
              navigation.goBack();
            } catch (err) {
              showToast(err instanceof Error ? err.message : t('detail.deleteFailed'), 'error');
            }
          },
        },
      ]
    );
  };

  const handleDeleteMeasurement = (measurementId: string, garmentType: string) => {
    Alert.alert(
      t('detail.deleteMeasurementConfirmTitle'),
      t('detail.deleteMeasurementConfirmMessage', { garmentType }),
      [
        { text: t('detail.cancel'), style: 'cancel' },
        {
          text: t('detail.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('measurements').delete().eq('id', measurementId);
              if (error) throw error;
              showToast(t('detail.deleteMeasurementSuccess'), 'success');
              void load();
            } catch {
              showToast(t('detail.deleteMeasurementFailed'), 'error');
            }
          },
        },
      ]
    );
  };

  const handleRemind = async () => {
    if (!customer) return;
    try {
      await sendWhatsAppMessage(
        customer.phone,
        buildPaymentDueMessage({
          shopName: shop.shop_name,
          customerName: customer.name,
          pending: balance,
        })
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('detail.whatsappError'), 'error');
    }
  };

  if (loading || !customer) return <LoadingSpinner fullScreen text={t('detail.loading')} />;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Header
        title={customer.name}
        onBack={() => navigation.goBack()}
        right={
          <View className="flex-row items-center">
            <Pressable
              onPress={() => navigation.navigate('CustomerForm', { customerId })}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
            >
              <FontAwesome5 name="pen" size={15} color="#1D4ED8" />
            </Pressable>
            <Pressable
              onPress={handleDeleteCustomer}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
            >
              <FontAwesome5 name="trash-alt" size={15} color="#DC2626" />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 160 }}>
        <Card>
          <View className="flex-row items-center">
            <Avatar name={customer.name} size="lg" />
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">{customer.name}</Text>
              <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{customer.phone ?? t('detail.noPhone')}</Text>
              {customer.address ? (
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{customer.address}</Text>
              ) : null}
              {customer.book_number ? (
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
                  {t('detail.bookNumberPrefix')} {customer.book_number}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="mt-4 flex-row items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800">
            <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('detail.outstandingBalance')}</Text>
            <Text className={`text-base font-bold ${balance > 0 ? 'text-danger' : 'text-success'}`}>
              {formatCurrency(balance)}
            </Text>
          </View>

          {balance > 0 && customer.phone ? (
            <Pressable
              onPress={handleRemind}
              className="mt-3 flex-row items-center justify-center rounded-lg bg-green-50 py-2.5 dark:bg-green-950"
            >
              <FontAwesome5 name="whatsapp" size={16} color="#16A34A" />
              <Text className="ml-2 text-sm font-semibold text-green-700 dark:text-green-400">
                {t('detail.sendPaymentReminder')}
              </Text>
            </Pressable>
          ) : null}
        </Card>

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <FontAwesome5 name="ruler-combined" size={13} color="#6B7280" />
              <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-gray-50">{t('detail.measurements')}</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('MeasurementForm', { customerId })}
              className="rounded-md bg-primary-50 px-3 py-1.5 dark:bg-primary-950"
            >
              <Text className="text-sm font-semibold text-primary-600 dark:text-primary-400">{t('detail.addShort')}</Text>
            </Pressable>
          </View>
          {measurements.length > 0 ? (
            <View className="gap-2">
              {measurements.map((m) => {
                const customFields = Array.isArray(m.custom_fields)
                  ? (m.custom_fields as unknown as { label: string; value: string }[])
                  : [];
                return (
                  <Card
                    key={m.id}
                    onPress={() =>
                      navigation.navigate('MeasurementForm', { customerId, measurementId: m.id })
                    }
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">{m.garment_type}</Text>
                      <View className="flex-row items-center gap-2">
                        <Text className="font-sans text-xs text-gray-400 dark:text-gray-500">
                          {t('detail.updated', { date: formatDate(m.updated_at) })}
                        </Text>
                        <Pressable
                          onPress={() => handleDeleteMeasurement(m.id, m.garment_type)}
                          hitSlop={8}
                          className="h-6 w-6 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
                        >
                          <FontAwesome5 name="trash-alt" size={12} color="#DC2626" />
                        </Pressable>
                        <FontAwesome5 name="chevron-right" size={11} color="#9CA3AF" />
                      </View>
                    </View>
                    <Text className="font-sans mt-1.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      {t('detail.measurementSummary', {
                        chest: m.chest ?? '—',
                        waist: m.waist ?? '—',
                        shoulder: m.shoulder ?? '—',
                        length: m.length ?? '—',
                        sleeve: m.sleeve ?? '—',
                      })}
                    </Text>
                    {customFields.length > 0 ? (
                      <View className="mt-2 flex-row flex-wrap gap-1.5">
                        {customFields.map((f, i) => (
                          <View key={i} className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-800">
                            <Text className="font-sans text-[11px] text-gray-600 dark:text-gray-300">
                              {f.label}: <Text className="font-semibold text-gray-800 dark:text-gray-100">{f.value}</Text>
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {m.notes ? <Text className="font-sans mt-1 text-xs text-gray-400 dark:text-gray-500">{m.notes}</Text> : null}
                  </Card>
                );
              })}
            </View>
          ) : (
            <EmptyState
              variant="compact"
              icon="ruler-combined"
              title={t('detail.noMeasurementsTitle')}
              description={t('detail.noMeasurementsDescription')}
            />
          )}
        </View>

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <FontAwesome5 name="tshirt" size={13} color="#6B7280" />
              <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-gray-50">{t('detail.orderHistory')}</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('OrderForm', { customerId })}
              className="rounded-md bg-primary-50 px-3 py-1.5 dark:bg-primary-950"
            >
              <Text className="text-sm font-semibold text-primary-600 dark:text-primary-400">{t('detail.newOrderShort')}</Text>
            </Pressable>
          </View>
          {orders.length > 0 ? (
            <View className="gap-2">
              {orders.map((o) => (
                <Card
                  key={o.id}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">#{o.order_number}</Text>
                    <Badge type="order_status" value={o.status} />
                  </View>
                  <Text className="font-sans mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {o.cloth_type ?? t('detail.noClothType')} · {t('detail.ordered', { date: formatDate(o.order_date) })}
                  </Text>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState
              variant="compact"
              icon="tshirt"
              title={t('detail.noOrdersTitle')}
              description={t('detail.noOrdersDescription')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
