import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Avatar, Badge, Card, EmptyState, Header, LoadingSpinner, SearchBar, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { customersRepo, ordersRepo, billsRepo } from '../../lib/data/repository';
import { formatCurrency, formatDate } from '../../lib/format';
import { sendWhatsAppMessage, buildPaymentDueMessage } from '../../lib/whatsapp';
import { useShop } from '../../context/AuthContext';
import type { CustomersScreenProps } from '../../navigation/types';
import type { Bill, Customer, Measurement, Order } from '../../types';

const TABS = ['info', 'orders', 'bills'] as const;
type TabKey = (typeof TABS)[number];

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
  const [bills, setBills] = useState<(Bill & { paid: number })[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  // Billing list deep-links straight into the Bills tab for a client.
  const [tab, setTab] = useState<TabKey>(route.params?.initialTab ?? 'info');
  const [search, setSearch] = useState('');



  const q = search.trim().toLowerCase();
  const filteredOrders = q
    ? orders.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.cloth_type ?? '').toLowerCase().includes(q)
      )
    : orders;
  const filteredBills = q
    ? bills.filter(
        (b) =>
          String(b.total_amount ?? '').includes(q) ||
          (b.payment_status ?? '').toLowerCase().includes(q) ||
          formatDate(b.created_at).toLowerCase().includes(q)
      )
    : bills;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Core record + orders + balance all come from the local-first mirror,
      // so they load reliably offline and don't race the background sync.
      const [customerData, allOrders, balanceByCustomer, allBills] = await Promise.all([
        customersRepo.get(customerId),
        ordersRepo.list(shop.id),
        billsRepo.pendingBalanceByCustomer(shop.id),
        billsRepo.listWithPayments(shop.id),
      ]);

      if (!customerData) {
        // Client no longer exists (e.g. deleted elsewhere) — leave, but say
        // why instead of silently bouncing back with no explanation.
        showToast(t('detail.loadError'), 'error');
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
      setBills(
        allBills
          .filter((b) => b.customer_id === customerId)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      );

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
      showToast(t('detail.loadError'), 'error');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [customerId, navigation, shop.id, showToast, t]);

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
      {/* Client card sits above the tabs — who this person is stays visible
          no matter which tab is open, rather than being tab-one content. */}
      <View className="bg-gray-50 px-4 pt-6 dark:bg-gray-950">
        <Card>
          <View className="flex-row items-center">
            <Avatar name={customer.name} size="lg" />
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">{customer.name}</Text>
              <Text className="font-sans text-base text-gray-500 dark:text-gray-400">{customer.phone ?? t('detail.noPhone')}</Text>
              {customer.address ? (
                <Text className="font-sans text-base text-gray-500 dark:text-gray-400">{customer.address}</Text>
              ) : null}
              {customer.book_number ? (
                <Text className="font-sans text-base text-gray-500 dark:text-gray-400">
                  {t('detail.bookNumberPrefix')} {customer.book_number}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>
      </View>

      {/* Three tabs instead of one long scroll: a client page mixes three
          unrelated jobs (who they are, what they've ordered, what they owe)
          and stacking them meant scrolling past measurements to reach money. */}
      <View className="mt-4 flex-row border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        {TABS.map((tabKey) => {
          const active = tab === tabKey;
          return (
            <Pressable
              key={tabKey}
              onPress={() => setTab(tabKey)}
              className={`min-h-[52px] flex-1 items-center justify-center border-b-2 ${
                active ? 'border-primary-600' : 'border-transparent'
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {t(`detail.tabs.${tabKey}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab !== 'info' ? (
        <View className="bg-white px-4 pt-3 dark:bg-gray-950">
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={t(tab === 'orders' ? 'detail.searchOrders' : 'detail.searchBills')}
          />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 224 }}>
        {tab === 'info' ? (
        <>

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
              <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">{t('detail.addShort')}</Text>
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
                    {/* Values as a labelled grid rather than one run-on
                        "Chest 38 · Waist 32 · ..." line — a tailor reads
                        one number at a time, and blank fields are simply
                        omitted instead of printing an em-dash. */}
                    <View className="flex-row items-center justify-between">
                      <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">{m.garment_type}</Text>
                      <Pressable
                        onPress={() => handleDeleteMeasurement(m.id, m.garment_type)}
                        hitSlop={10}
                        className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
                      >
                        <FontAwesome5 name="trash-alt" size={14} color="#DC2626" />
                      </Pressable>
                    </View>

                    <View className="mt-3 flex-row flex-wrap gap-y-3">
                      {[
                        { label: t('detail.measurementFields.chest'), value: m.chest },
                        { label: t('detail.measurementFields.waist'), value: m.waist },
                        { label: t('detail.measurementFields.shoulder'), value: m.shoulder },
                        { label: t('detail.measurementFields.length'), value: m.length },
                        { label: t('detail.measurementFields.sleeve'), value: m.sleeve },
                        ...customFields.map((f) => ({ label: f.label, value: f.value })),
                      ]
                        .filter((f) => f.value !== null && f.value !== undefined && f.value !== '')
                        .map((f, i) => (
                          <View key={`${f.label}-${i}`} className="w-1/3 pr-2">
                            <Text className="font-sans text-base text-gray-500 dark:text-gray-400">{f.label}</Text>
                            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">{f.value}</Text>
                          </View>
                        ))}
                    </View>

                    {m.notes ? (
                      <Text className="font-sans mt-3 border-t border-gray-100 pt-2 text-base text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        {m.notes}
                      </Text>
                    ) : null}
                    <Text className="font-sans mt-2 text-base text-gray-400 dark:text-gray-500">
                      {t('detail.updated', { date: formatDate(m.updated_at) })}
                    </Text>
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
        </>
        ) : null}

        {tab === 'orders' ? (
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
              <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">{t('detail.newOrderShort')}</Text>
            </Pressable>
          </View>
          {filteredOrders.length > 0 ? (
            <View className="gap-2">
              {filteredOrders.map((o) => (
                <Card
                  key={o.id}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">#{o.order_number}</Text>
                    {o.delivery_date ? (
                      <Badge
                        label={t('detail.deliveryBadge', { date: formatDate(o.delivery_date) })}
                        bg="#F3F4F6"
                        color="#374151"
                      />
                    ) : null}
                  </View>
                  <Text className="font-sans mt-1 text-base text-gray-500 dark:text-gray-400">
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
        ) : null}

        {tab === 'bills' ? (
          <View>
            <View className="mb-3 flex-row items-center justify-between rounded-lg bg-gray-100 px-4 py-3 dark:bg-gray-800">
              <Text className="text-base text-gray-600 dark:text-gray-300">{t('detail.outstandingBalance')}</Text>
              <Text className={`text-xl font-bold ${balance > 0 ? 'text-danger' : 'text-success'}`}>
                {formatCurrency(balance)}
              </Text>
            </View>

            {filteredBills.length > 0 ? (
              <View className="gap-2">
                {filteredBills.map((b) => {
                  const pending = Math.max(Number(b.total_amount ?? 0) - Number(b.paid ?? 0), 0);
                  return (
                    <Card key={b.id} onPress={() => navigation.navigate('BillDetail', { billId: b.id })}>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
                          {formatCurrency(b.total_amount)}
                        </Text>
                        <Badge type="payment_status" value={b.payment_status} />
                      </View>
                      <View className="mt-1 flex-row items-center justify-between">
                        <Text className="font-sans text-base text-gray-500 dark:text-gray-400">
                          {formatDate(b.created_at)}
                        </Text>
                        {pending > 0 ? (
                          <Text className="text-base font-semibold text-danger">
                            {t('detail.pendingAmount', { amount: formatCurrency(pending) })}
                          </Text>
                        ) : null}
                      </View>
                    </Card>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                variant="compact"
                icon="file-invoice-dollar"
                title={t('detail.noBillsTitle')}
                description={t('detail.noBillsDescription')}
              />
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
