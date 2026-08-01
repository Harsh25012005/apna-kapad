import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { ordersRepo, billsRepo, paymentsRepo, customersRepo, staffRepo } from '../../lib/data/repository';
import { sendPushNotification } from '../../lib/notify';
import { formatCurrency, formatDate } from '../../lib/format';
import { sendWhatsAppMessage } from '../../lib/whatsapp';
import { haptics } from '../../lib/haptics';
import { useShop } from '../../context/AuthContext';
import type { AppScreenProps } from '../../navigation/types';
import type { Customer, Order, Staff } from '../../types';

type OrderDetail = Order & {
  customers: Pick<Customer, 'name' | 'phone'> | null;
  staff: Pick<Staff, 'name'> | null;
};

export default function OrderDetailScreen({ navigation, route }: AppScreenProps<'OrderDetail'>) {
  const { orderId } = route.params;
  const shop = useShop();
  const showToast = useToast();
  const { t } = useTranslation('orders');

  /** Labels garment piece counts by type when the linked measurement says so. */
  function clothPieceLabel(garmentType: string | null | undefined): string {
    const normalized = (garmentType ?? '').trim().toLowerCase();
    if (normalized === 'pant') return t('detail.pantPieces');
    if (normalized === 'shirt') return t('detail.shirtPieces');
    return t('detail.clothPieces');
  }

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  /**
   * Live total/paid for the linked bill. orders.total_amount/paid_amount are
   * only a snapshot taken at order creation — once a payment is recorded on
   * the bill afterwards, those columns go stale, so whenever a bill exists we
   * source the payment figures from it instead.
   */
  const [billAmounts, setBillAmounts] = useState<{ total: number; paid: number } | null>(null);
  const [garmentType, setGarmentType] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Reads from the local-first mirror (same one order create/update/delete
      // write through) rather than Supabase directly — querying Supabase here
      // raced the background sync for freshly-created orders and made the
      // detail page look like it "wouldn't open" right after creating one.
      const order = await ordersRepo.get(orderId);
      if (!order) {
        // Order no longer exists (e.g. deleted elsewhere) — leave, but say
        // why instead of silently bouncing back with no explanation.
        showToast(t('detail.loadOrderFailed'), 'error');
        navigation.goBack();
        return;
      }

      const [customer, staffMember, orderItems] = await Promise.all([
        customersRepo.get(order.customer_id),
        order.assigned_staff_id ? staffRepo.get(order.assigned_staff_id) : Promise.resolve(null),
        ordersRepo.itemsForOrder(orderId),
      ]);
      setOrder({
        ...order,
        customers: customer ? { name: customer.name, phone: customer.phone } : null,
        staff: staffMember ? { name: staffMember.name } : null,
      });
      setGarmentType(orderItems[0]?.garment_type ?? null);

      const [shopBills, shopPayments] = await Promise.all([
        billsRepo.list(shop.id),
        paymentsRepo.listForShop(shop.id),
      ]);
      const bill = shopBills.find((b) => b.order_id === orderId) ?? null;
      setBillAmounts(
        bill
          ? {
              total: Number(bill.total_amount ?? 0),
              paid: shopPayments
                .filter((p) => p.bill_id === bill.id)
                .reduce((s, p) => s + Number(p.amount_paid ?? 0), 0),
            }
          : null
      );
    } catch {
      showToast(t('detail.loadOrderFailed'), 'error');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [orderId, navigation, shop.id, showToast, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const markComplete = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      await ordersRepo.update(orderId, shop.id, { status: 'delivered' });

      // Records this order against the assigned staff member so their "N
      // orders done" count (StaffListScreen) reflects real completions —
      // staff_orders otherwise has nothing that ever writes to it.
      if (order.assigned_staff_id) {
        try {
          const { data: existing } = await supabase
            .from('staff_orders')
            .select('id')
            .eq('order_id', orderId)
            .eq('staff_id', order.assigned_staff_id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('staff_orders')
              .update({ completed_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase.from('staff_orders').insert({
              shop_id: shop.id,
              order_id: orderId,
              staff_id: order.assigned_staff_id,
              completed_at: new Date().toISOString(),
            });
          }
        } catch {
          // Non-critical bookkeeping — the order status change itself
          // already succeeded and shouldn't be reported as a failure.
        }
      }

      void sendPushNotification({
        shopId: shop.id,
        type: 'order_ready',
        customerId: order.customer_id,
        title: t('detail.pushReadyTitle'),
        body: t('detail.pushReadyBody', { number: order.order_number, customerName: order.customers?.name ?? '' }),
      });

      setOrder({ ...order, status: 'delivered' });
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

  const handleDelete = () => {
    if (!order) return;
    Alert.alert(
      t('detail.deleteConfirmTitle'),
      t('detail.deleteConfirmMessage', { number: order.order_number }),
      [
        { text: t('detail.cancel'), style: 'cancel' },
        {
          text: t('detail.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await ordersRepo.remove(orderId, shop.id);
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

  if (loading || !order) return <LoadingSpinner fullScreen text={t('detail.loadingOrder')} />;

  const isDelivered = order.status === 'delivered';

  const photos = order.design_photo_urls?.length
    ? order.design_photo_urls
    : order.design_photo_url
      ? [order.design_photo_url]
      : [];

  const totalAmount = billAmounts ? billAmounts.total : Number(order.total_amount ?? 0);
  const paidAmount = billAmounts ? billAmounts.paid : Number(order.paid_amount ?? 0);
  const balanceDue = Math.max(totalAmount - paidAmount, 0);
  const hasBilling = order.total_amount != null;
  const customerName = order.customers?.name ?? '';
  const hasPhone = !!order.customers?.phone;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Header
        title={t('detail.orderNumber', { number: order.order_number })}
        onBack={() => navigation.goBack()}
        right={
          <View className="flex-row items-center">
            <Pressable
              onPress={() => navigation.navigate('OrderForm', { orderId })}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
            >
              <FontAwesome5 name="pen" size={15} color="#1D4ED8" />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
            >
              <FontAwesome5 name="trash-alt" size={15} color="#DC2626" />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160, gap: 14 }}>
        {/* Header card: order number, status, priority */}
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-xl font-bold text-[#101828] dark:text-gray-50">#{order.order_number}</Text>
              <Text className="font-sans mt-1 text-sm text-gray-500 dark:text-gray-400">{order.customers?.name}</Text>
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
            <Text className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-gray-500 dark:text-gray-400">
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
          <Text className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-gray-500 dark:text-gray-400">
            {t('detail.orderDetails')}
          </Text>
          <View className="gap-2.5">
            {order.cloth_count != null ? (
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
                  {clothPieceLabel(garmentType)}
                </Text>
                <Text className="font-sans text-sm font-semibold text-[#101828] dark:text-gray-50">{order.cloth_count}</Text>
              </View>
            ) : null}
            {order.bill_book_number ? (
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{t('detail.billBookNumber')}</Text>
                <Text className="font-sans text-sm font-semibold text-[#101828] dark:text-gray-50">
                  {order.bill_book_number}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{t('detail.orderDate')}</Text>
              <Text className="font-sans text-sm font-semibold text-[#101828] dark:text-gray-50">
                {formatDate(order.order_date)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{t('detail.deliveryDate')}</Text>
              <Text className="font-sans text-sm font-semibold text-[#101828] dark:text-gray-50">
                {formatDate(order.delivery_date)}
              </Text>
            </View>
            {order.staff?.name ? (
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{t('detail.assignedStaff')}</Text>
                <Text className="font-sans text-sm font-semibold text-[#101828] dark:text-gray-50">{order.staff.name}</Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* Payment / amount section */}
        {hasBilling ? (
          <Card>
            <Text className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-gray-500 dark:text-gray-400">
              {t('detail.payment')}
            </Text>
            <View className="gap-2.5">
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{t('detail.totalAmount')}</Text>
                <Text className="font-sans text-sm font-semibold text-[#101828] dark:text-gray-50">
                  {formatCurrency(totalAmount)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{t('detail.paidAmount')}</Text>
                <Text className="font-sans text-sm font-semibold text-[#101828] dark:text-gray-50">
                  {formatCurrency(paidAmount)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between border-t border-gray-100 pt-2.5">
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{t('detail.balanceDue')}</Text>
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
                  <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{t('detail.paymentMode')}</Text>
                  <Text className="font-sans text-sm font-semibold text-[#101828] dark:text-gray-50">
                    {order.payment_mode}
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* Customer messaging actions */}
        <Card>
          <Text className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-gray-500 dark:text-gray-400">
            {t('detail.whatsapp.sectionTitle')}
          </Text>
          {!hasPhone ? (
            <Text className="font-sans mb-3 text-xs text-gray-500 dark:text-gray-400">
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
          </View>
        </Card>

        {/* Status action */}
        <Card>
          {!isDelivered ? (
            <Pressable
              onPress={markComplete}
              disabled={updating}
              className={`items-center rounded-md bg-primary-600 py-3 active:bg-primary-700 ${
                updating ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-sm font-semibold text-white">{t('detail.markComplete')}</Text>
            </Pressable>
          ) : (
            <View className="items-center rounded-md bg-gray-100 py-3 dark:bg-gray-800">
              <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t('detail.orderDelivered')}</Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
