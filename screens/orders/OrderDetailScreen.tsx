import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/format';
import { sendWhatsAppMessage } from '../../lib/whatsapp';
import { haptics } from '../../lib/haptics';
import { useShop } from '../../context/AuthContext';
import type { AppScreenProps } from '../../navigation/types';
import type { Customer, Measurement, Order, OrderStatus, Staff } from '../../types';

const STATUS_STEPS: OrderStatus[] = [
  'order_taken',
  'cutting',
  'stitching',
  'ready',
  'delivered',
];

/** Order joined with its full linked measurement, not just the garment type. */
type OrderDetail = Order & {
  customers: Pick<Customer, 'name' | 'phone'> | null;
  staff: Pick<Staff, 'name'> | null;
  measurements: Measurement | null;
};

type CustomField = { label: string; value: string };

function parseCustomFields(json: unknown): CustomField[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((f): f is { label: unknown; value: unknown } => !!f && typeof f === 'object')
    .map((f) => ({ label: String((f as any).label ?? ''), value: String((f as any).value ?? '') }))
    .filter((f) => f.label || f.value);
}

export default function OrderDetailScreen({ navigation, route }: AppScreenProps<'OrderDetail'>) {
  const { orderId } = route.params;
  const shop = useShop();
  const showToast = useToast();
  const { t } = useTranslation('orders');

  const STATUS_LABELS: Record<OrderStatus, string> = {
    order_taken: t('detail.statusOrderTaken'),
    cutting: t('detail.statusCutting'),
    stitching: t('detail.statusStitching'),
    ready: t('detail.statusReady'),
    delivered: t('detail.statusDelivered'),
  };

  /** Labels garment piece counts by type when the linked measurement says so. */
  function clothPieceLabel(garmentType: string | null | undefined): string {
    const normalized = (garmentType ?? '').trim().toLowerCase();
    if (normalized === 'pant') return t('detail.pantPieces');
    if (normalized === 'shirt') return t('detail.shirtPieces');
    return t('detail.clothPieces');
  }

  const MEASUREMENT_FIELD_LABELS: { key: keyof Measurement; label: string }[] = [
    { key: 'chest', label: t('detail.measurementFields.chest') },
    { key: 'waist', label: t('detail.measurementFields.waist') },
    { key: 'shoulder', label: t('detail.measurementFields.shoulder') },
    { key: 'length', label: t('detail.measurementFields.length') },
    { key: 'sleeve', label: t('detail.measurementFields.sleeve') },
  ];

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  /** id of the bill already raised for this order, or null if none exists yet. */
  const [existingBillId, setExistingBillId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(name, phone), staff(name), measurements(*)')
        .eq('id', orderId)
        .single();
      if (error) throw error;
      setOrder(data as unknown as OrderDetail);

      const { data: bill } = await supabase
        .from('bills')
        .select('id')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setExistingBillId(bill?.id ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('detail.loadOrderFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const advanceStatus = async (nextStatus: OrderStatus) => {
    if (!order) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId);
      if (error) throw error;
      setOrder({ ...order, status: nextStatus });
      haptics.success();
    } catch (err) {
      haptics.error();
      showToast(err instanceof Error ? err.message : t('detail.updateStatusFailed'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  /** Opens WhatsApp with a prefilled message; both action buttons funnel here. */
  const sendMessage = async (body: string) => {
    if (!order?.customers?.phone) {
      showToast(t('detail.whatsapp.noPhone'), 'error');
      return;
    }
    try {
      await sendWhatsAppMessage(order.customers.phone, body);
    } catch (err) {
      haptics.error();
      showToast(err instanceof Error ? err.message : t('detail.whatsapp.sendFailed'), 'error');
    }
  };

  if (loading || !order) return <LoadingSpinner fullScreen text={t('detail.loadingOrder')} />;

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const nextStep = STATUS_STEPS[currentStepIndex + 1];

  const photos = order.design_photo_urls?.length
    ? order.design_photo_urls
    : order.design_photo_url
      ? [order.design_photo_url]
      : [];

  const totalAmount = Number(order.total_amount ?? 0);
  const paidAmount = Number(order.paid_amount ?? 0);
  const balanceDue = Math.max(totalAmount - paidAmount, 0);
  const hasBilling = order.total_amount != null;
  const measurement = order.measurements;
  const measurementCustomFields = measurement ? parseCustomFields(measurement.custom_fields) : [];
  const customerName = order.customers?.name ?? '';
  const hasPhone = !!order.customers?.phone;

  /**
   * If a bill was already raised for this order, jump to it in the Billing
   * stack (nested under the Settings tab); otherwise start a new bill.
   */
  const goToBill = () => {
    haptics.tap();
    if (existingBillId) {
      navigation.navigate('SettingsTab' as any, {
        screen: 'Billing',
        params: { screen: 'BillDetail', params: { billId: existingBillId } },
      });
    } else {
      navigation.navigate('BillForm', { orderId: order.id, customerId: order.customer_id });
    }
  };

  const billButtonLabel = existingBillId
    ? balanceDue > 0
      ? t('detail.addPaymentViewBill')
      : t('detail.viewBill')
    : t('detail.createBillForOrder');

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title={t('detail.orderNumber', { number: order.order_number })}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160, gap: 14 }}>
        {/* Header card: order number, status, priority */}
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-xl font-bold text-[#101828]">#{order.order_number}</Text>
              <Text className="font-sans mt-1 text-sm text-gray-500">{order.customers?.name}</Text>
            </View>
            <Badge type="order_status" value={order.status} />
          </View>
          {order.priority === 'urgent' ? (
            <View className="mt-3 flex-row items-center gap-2">
              <View className="flex-row items-center gap-1.5 self-start rounded-full bg-red-50 px-2.5 py-1">
                <FontAwesome5 name="bolt" size={10} color="#EF4444" solid />
                <Text className="text-xs font-semibold text-danger">{t('detail.urgent')}</Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Photos gallery */}
        {photos.length > 0 ? (
          <Card>
            <Text className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-gray-500">
              {t('detail.designPhotos')} {photos.length > 1 ? `(${photos.length})` : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3">
                {photos.map((url, index) => (
                  <Image
                    key={`${url}-${index}`}
                    source={{ uri: url }}
                    className="h-48 w-40 rounded-md"
                    resizeMode="cover"
                  />
                ))}
              </View>
            </ScrollView>
          </Card>
        ) : null}

        {/* Details section */}
        <Card>
          <Text className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-gray-500">
            {t('detail.orderDetails')}
          </Text>
          <View className="gap-2.5">
            {order.cloth_count != null ? (
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500">
                  {clothPieceLabel(measurement?.garment_type)}
                </Text>
                <Text className="font-sans text-sm font-semibold text-[#101828]">{order.cloth_count}</Text>
              </View>
            ) : null}
            {order.bill_book_number ? (
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500">{t('detail.billBookNumber')}</Text>
                <Text className="font-sans text-sm font-semibold text-[#101828]">
                  {order.bill_book_number}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-sm text-gray-500">{t('detail.orderDate')}</Text>
              <Text className="font-sans text-sm font-semibold text-[#101828]">
                {formatDate(order.order_date)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-sm text-gray-500">{t('detail.deliveryDate')}</Text>
              <Text className="font-sans text-sm font-semibold text-[#101828]">
                {formatDate(order.delivery_date)}
              </Text>
            </View>
            {order.staff?.name ? (
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500">{t('detail.assignedStaff')}</Text>
                <Text className="font-sans text-sm font-semibold text-[#101828]">{order.staff.name}</Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* Payment / amount section */}
        {hasBilling ? (
          <Card>
            <Text className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-gray-500">
              {t('detail.payment')}
            </Text>
            <View className="gap-2.5">
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500">{t('detail.totalAmount')}</Text>
                <Text className="font-sans text-sm font-semibold text-[#101828]">
                  {formatCurrency(totalAmount)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500">{t('detail.paidAmount')}</Text>
                <Text className="font-sans text-sm font-semibold text-[#101828]">
                  {formatCurrency(paidAmount)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between border-t border-gray-100 pt-2.5">
                <Text className="font-sans text-sm text-gray-500">{t('detail.balanceDue')}</Text>
                <Text
                  className={`font-sans text-base font-bold ${
                    balanceDue > 0 ? 'text-danger' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(balanceDue)}
                </Text>
              </View>
              {order.payment_mode ? (
                <View className="flex-row items-center justify-between">
                  <Text className="font-sans text-sm text-gray-500">{t('detail.paymentMode')}</Text>
                  <Text className="font-sans text-sm font-semibold text-[#101828]">
                    {order.payment_mode}
                  </Text>
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={goToBill}
              className="mt-4 items-center rounded-md border border-primary-600 py-3 active:bg-primary-50"
            >
              <Text className="text-sm font-semibold text-primary-600">{billButtonLabel}</Text>
            </Pressable>
          </Card>
        ) : (
          <Pressable
            onPress={goToBill}
            className="items-center rounded-md border border-primary-600 bg-white py-3 active:bg-primary-50"
          >
            <Text className="text-sm font-semibold text-primary-600">{billButtonLabel}</Text>
          </Pressable>
        )}

        {/* Customer messaging actions */}
        <Card>
          <Text className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-gray-500">
            {t('detail.whatsapp.sectionTitle')}
          </Text>
          {!hasPhone ? (
            <Text className="font-sans mb-3 text-xs text-gray-500">
              {t('detail.whatsapp.noPhone')}
            </Text>
          ) : null}
          <View className="gap-2.5">
            <Pressable
              disabled={!hasPhone}
              onPress={() =>
                sendMessage(
                  t('detail.whatsapp.completionBody', {
                    customerName,
                    orderNumber: order.order_number,
                    shopName: shop.shop_name,
                  })
                )
              }
              className={`flex-row items-center justify-center gap-2 rounded-md bg-[#25D366] py-3 active:opacity-80 ${
                hasPhone ? '' : 'opacity-40'
              }`}
            >
              <FontAwesome5 name="whatsapp" size={16} color="#FFFFFF" />
              <Text className="text-sm font-semibold text-white">
                {t('detail.whatsapp.sendCompletion')}
              </Text>
            </Pressable>

            <Pressable
              disabled={!hasPhone}
              onPress={() =>
                sendMessage(
                  balanceDue > 0
                    ? t('detail.whatsapp.reminderPaymentBody', {
                        customerName,
                        orderNumber: order.order_number,
                        shopName: shop.shop_name,
                        amount: formatCurrency(balanceDue),
                      })
                    : t('detail.whatsapp.reminderPickupBody', {
                        customerName,
                        orderNumber: order.order_number,
                        shopName: shop.shop_name,
                      })
                )
              }
              className={`flex-row items-center justify-center gap-2 rounded-md border border-primary-600 py-3 active:bg-primary-50 ${
                hasPhone ? '' : 'opacity-40'
              }`}
            >
              <FontAwesome5 name="bell" size={14} color="#1D4ED8" />
              <Text className="text-sm font-semibold text-primary-600">
                {t('detail.whatsapp.sendReminder')}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Status pipeline */}
        <Card>
          <Text className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-gray-500">
            {t('detail.statusPipeline')}
          </Text>
          <View className="gap-3">
            {STATUS_STEPS.map((step, index) => {
              const isDone = index <= currentStepIndex;
              return (
                <View key={step} className="flex-row items-center">
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full ${
                      isDone ? 'bg-primary-600' : 'bg-gray-100'
                    }`}
                  >
                    {isDone ? <FontAwesome5 name="check" size={10} color="#FFFFFF" /> : null}
                  </View>
                  <Text
                    className={`ml-3 text-sm ${
                      isDone ? 'font-semibold text-[#101828]' : 'text-gray-400'
                    }`}
                  >
                    {STATUS_LABELS[step]}
                  </Text>
                </View>
              );
            })}
          </View>

          {nextStep ? (
            <Pressable
              onPress={() => advanceStatus(nextStep)}
              disabled={updating}
              className={`mt-4 items-center rounded-md bg-primary-600 py-3 active:bg-primary-700 ${
                updating ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-sm font-semibold text-white">
                {t('detail.markAs', { status: STATUS_LABELS[nextStep] })}
              </Text>
            </Pressable>
          ) : (
            <View className="mt-4 items-center rounded-md bg-gray-100 py-3">
              <Text className="text-sm font-semibold text-gray-500">{t('detail.orderDelivered')}</Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
