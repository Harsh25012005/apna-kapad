import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DatePickerField,
  Dropdown,
  Header,
  ImagePickerField,
  InputField,
  LoadingSpinner,
  RadioGroup,
  useToast,
} from '../../components/ui';
import { uploadImage } from '../../lib/storage';
import { useShop } from '../../context/AuthContext';
import { customersRepo, ordersRepo, billsRepo, paymentsRepo } from '../../lib/data/repository';
import { suggestDeliveryDate } from '../../lib/orderScheduling';
import type { AppScreenProps } from '../../navigation/types';
import type { OrderPriority } from '../../types';

type Option = { label: string; value: string };

const PAYMENT_MODES = ['Cash', 'UPI'] as const;
const GARMENT_TYPES = ['shirt', 'pant', 'both'] as const;
type GarmentType = (typeof GARMENT_TYPES)[number];

/** Resizes a photo-URI array to `count` slots, keeping already-picked images in place. */
function resizePhotoSlots(prev: (string | null)[], count: number): (string | null)[] {
  const next = prev.slice(0, count);
  while (next.length < count) next.push(null);
  return next;
}

/**
 * Derives the next order number from the highest existing one for this shop.
 * Using the max rather than a row count keeps numbers unique even after
 * orders are deleted (order_number is UNIQUE per shop).
 */
async function nextOrderNumber(shopId: string): Promise<string> {
  const orders = await ordersRepo.list(shopId);

  // created_at can tie for seeded/bulk-inserted rows, so the highest order
  // number must be found numerically across all rows rather than by taking
  // the "most recent" one.
  const highest = orders.reduce((max, row) => {
    const n = Number(row.order_number?.match(/(\d+)$/)?.[1] ?? 0);
    return n > max ? n : max;
  }, 0);
  return `ORD-${highest + 1}`;
}

export default function OrderFormScreen({ navigation, route }: AppScreenProps<'OrderForm'>) {
  const presetCustomerId = route.params?.customerId;
  const orderId = route.params?.orderId;
  const isEditing = !!orderId;
  const shop = useShop();
  const showToast = useToast();
  const { t } = useTranslation('orders');

  const PAYMENT_MODE_LABELS: Record<(typeof PAYMENT_MODES)[number], string> = {
    Cash: t('form.paymentModeCash'),
    UPI: t('form.paymentModeUpi'),
  };

  const { width: windowWidth } = useWindowDimensions();
  /** Sizes each photo slot so exactly 3 fit in the visible width of a horizontally scrolling row. */
  const photoSlotSize = (windowWidth - 40 - 24) / 3;

  const [customers, setCustomers] = useState<Option[]>([]);

  const [customerId, setCustomerId] = useState<string>(presetCustomerId ?? '');
  const [garmentType, setGarmentType] = useState<GarmentType | ''>('');
  const [clothCount, setClothCount] = useState('');
  const [notes, setNotes] = useState('');
  const [shirtPhotoUris, setShirtPhotoUris] = useState<(string | null)[]>([null]);
  const [pantPhotoUris, setPantPhotoUris] = useState<(string | null)[]>([null]);
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [deliveryDateTouched, setDeliveryDateTouched] = useState(false);
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [billBookNumber, setBillBookNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(isEditing);

  const clothCountNum = Math.max(0, Math.floor(Number(clothCount) || 0));
  const totalAmountNum = Math.max(0, Number(totalAmount) || 0);

  const GARMENT_TYPE_LABELS: Record<GarmentType, string> = {
    shirt: t('form.garmentTypes.shirt'),
    pant: t('form.garmentTypes.pant'),
    both: t('form.garmentTypes.both'),
  };

  // Auto-suggests a delivery date from garment count. Only runs for new
  // orders and stops once the user has manually picked a date, so it never
  // fights their choice.
  useEffect(() => {
    if (isEditing || deliveryDateTouched || clothCountNum === 0) return;
    void suggestDeliveryDate(shop.id, clothCountNum, null).then(setDeliveryDate);
  }, [isEditing, deliveryDateTouched, clothCountNum, shop.id]);

  // Keeps the number of photo slots in sync with the entered cloth count,
  // preserving already-picked images when the count grows or shrinks.
  useEffect(() => {
    const slots = Math.max(1, clothCountNum);
    setShirtPhotoUris((prev) => resizePhotoSlots(prev, slots));
    setPantPhotoUris((prev) => resizePhotoSlots(prev, slots));
  }, [clothCountNum]);

  useFocusEffect(
    useCallback(() => {
      if (!orderId) return;
      let active = true;
      setLoadingOrder(true);
      void (async () => {
        try {
          const [data, orderItems] = await Promise.all([ordersRepo.get(orderId), ordersRepo.itemsForOrder(orderId)]);
          if (!active) return;
          if (!data) {
            // Order no longer exists (e.g. deleted elsewhere) — just leave,
            // no need to surface a technical error for something the user can't act on.
            navigation.goBack();
            return;
          }

          const firstItem = orderItems[0];
          const urls = data.design_photo_urls ?? [];
          const half = Math.ceil(urls.length / 2);
          const rawGarmentType = (firstItem?.garment_type ?? '').toLowerCase();
          const loadedGarmentType: GarmentType | '' = GARMENT_TYPES.includes(rawGarmentType as GarmentType)
            ? (rawGarmentType as GarmentType)
            : '';
          const loadedClothCount = firstItem ? firstItem.cloth_count : data.cloth_count ?? 1;
          const slots = Math.max(1, loadedClothCount);
          setCustomerId(data.customer_id ?? '');
          setGarmentType(loadedGarmentType);
          setClothCount(String(loadedClothCount));
          setNotes(firstItem?.notes ?? '');
          setShirtPhotoUris(
            loadedGarmentType === 'pant' ? Array(slots).fill(null) : resizePhotoSlots(urls.slice(0, half), slots)
          );
          setPantPhotoUris(
            loadedGarmentType === 'shirt' ? Array(slots).fill(null) : resizePhotoSlots(urls.slice(half), slots)
          );
          setDeliveryDate(data.delivery_date ? new Date(data.delivery_date) : null);
          setDeliveryDateTouched(true);
          setPriority((data.priority as OrderPriority) ?? 'normal');
          setBillBookNumber(data.bill_book_number ?? '');
          setTotalAmount(data.total_amount ? String(data.total_amount) : '');
        } catch {
          navigation.goBack();
        } finally {
          if (active) setLoadingOrder(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [orderId, navigation])
  );

  useEffect(() => {
    void (async () => {
      const customerRows = await customersRepo.list(shop.id);
      setCustomers(customerRows.map((c) => ({ label: c.name, value: c.id })));
    })();
  }, [shop.id]);

  /** Uploads any freshly-picked local photo URIs, leaving already-remote ones (edit mode) untouched. */
  const resolveDesignPhotoUrls = async (fileNamePrefix: string): Promise<string[]> => {
    const combined = [
      ...(garmentType !== 'pant' ? shirtPhotoUris : []),
      ...(garmentType !== 'shirt' ? pantPhotoUris : []),
    ];
    const urls: string[] = [];
    for (let i = 0; i < combined.length; i++) {
      const uri = combined[i];
      if (!uri) continue;
      if (/^https?:\/\//.test(uri)) {
        urls.push(uri);
        continue;
      }
      try {
        const url = await uploadImage({
          bucket: 'design-photos',
          shopId: shop.id,
          localUri: uri,
          fileName: `${fileNamePrefix}-${i + 1}`,
        });
        urls.push(url);
      } catch {
        showToast(t('form.photoUploadFailed'), 'info');
      }
    }
    return urls;
  };

  const buildItem = () => [
    {
      garment_type: garmentType ? GARMENT_TYPE_LABELS[garmentType] : t('form.defaultGarmentType'),
      cloth_count: clothCountNum || 1,
      unit_price: totalAmountNum,
      notes: notes.trim() || null,
    },
  ];

  const handleUpdate = async () => {
    if (!customerId || !orderId) {
      setError(t('form.customerRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const designPhotoUrls = await resolveDesignPhotoUrls(orderId);
      await ordersRepo.update(orderId, shop.id, {
        customer_id: customerId,
        cloth_count: clothCountNum || null,
        design_photo_urls: designPhotoUrls,
        delivery_date: deliveryDate ? deliveryDate.toISOString().slice(0, 10) : null,
        priority,
        bill_book_number: billBookNumber.trim() || null,
      });
      await ordersRepo.replaceItems(orderId, shop.id, buildItem());

      showToast(t('form.orderUpdated'), 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('form.orderUpdateFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (isEditing) return handleUpdate();
    if (!customerId) {
      setError(t('form.customerRequired'));
      return;
    }
    setError('');

    if (paymentMode === 'UPI') {
      Alert.alert(t('form.upiConfirmTitle'), t('form.upiConfirmMessage'), [
        { text: t('form.upiConfirmNo'), style: 'cancel' },
        { text: t('form.upiConfirmYes'), onPress: () => void submitOrder() },
      ]);
      return;
    }

    await submitOrder();
  };

  const submitOrder = async () => {
    setLoading(true);
    try {
      const totalAmountValue = totalAmountNum > 0 ? totalAmountNum : null;
      const paidAmountNum = paidAmount.trim() ? Number(paidAmount) : 0;

      const orderNumber = await nextOrderNumber(shop.id);
      const designPhotoUrls = await resolveDesignPhotoUrls(orderNumber);

      const createdOrder = await ordersRepo.create(
        shop.id,
        {
          order_number: orderNumber,
          customer_id: customerId,
          cloth_count: clothCountNum || null,
          design_photo_urls: designPhotoUrls,
          delivery_date: deliveryDate ? deliveryDate.toISOString().slice(0, 10) : null,
          priority,
          bill_book_number: billBookNumber.trim() || null,
          total_amount: totalAmountValue,
          paid_amount: paidAmountNum,
          payment_mode: paymentMode || null,
        },
        buildItem()
      );

      // The order itself is already saved at this point — a failure here
      // (e.g. RLS hiccup) shouldn't be reported as an order-creation failure.
      if (totalAmountNum) {
        try {
          const paymentStatus =
            paidAmountNum <= 0 ? 'unpaid' : paidAmountNum >= totalAmountNum ? 'paid' : 'partial';

          const bill = await billsRepo.create({
            shop_id: shop.id,
            order_id: createdOrder.id,
            customer_id: customerId,
            fabric_cost: 0,
            stitching_charge: totalAmountNum,
            tax: 0,
            discount: 0,
            payment_status: paymentStatus,
          });

          if (paidAmountNum > 0) {
            await paymentsRepo.create({
              shop_id: shop.id,
              bill_id: bill.id,
              customer_id: customerId,
              amount_paid: paidAmountNum,
              payment_mode: paymentMode || null,
            });
          }
        } catch {
          showToast(t('form.billCreateFailed'), 'info');
        }
      }

      showToast(t('form.orderCreated'), 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('form.orderCreateFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingOrder) return <LoadingSpinner fullScreen text={t('form.loading')} />;

  return (
    <>
      <Header title={isEditing ? t('form.editTitle') : t('form.title')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 bg-white dark:bg-gray-950"
          contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
        >
          <Dropdown
            label={t('form.customer')}
            value={customerId}
            onChange={setCustomerId}
            options={customers}
            placeholder={t('form.selectCustomer')}
            error={error}
            required
            searchable
            searchPlaceholder={t('form.searchClientPlaceholder')}
            onAddNew={() => navigation.navigate('CustomersTab' as any, { screen: 'CustomerForm' })}
            addNewLabel={t('form.addClient')}
          />

          <Dropdown
            label={t('form.garmentType')}
            value={garmentType}
            onChange={(v) => setGarmentType(v as GarmentType)}
            options={GARMENT_TYPES.map((g) => ({ label: GARMENT_TYPE_LABELS[g], value: g }))}
            placeholder={t('form.garmentTypePlaceholder')}
            required
          />

          <InputField
            label={t('form.clothCount')}
            value={clothCount}
            onChangeText={setClothCount}
            placeholder={t('form.clothCountPlaceholder')}
            keyboardType="numeric"
          />

          <InputField
            label={t('form.itemNotes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('form.itemNotesPlaceholder')}
          />

          {garmentType === 'shirt' || garmentType === 'both' ? (
            <View className="mb-4 w-full">
              <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('form.shirtPhotosCount', { count: shirtPhotoUris.length })}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-3">
                  {shirtPhotoUris.map((uri, index) => (
                    <ImagePickerField
                      key={index}
                      label={t('form.piece', { number: index + 1 })}
                      uri={uri}
                      onChange={(newUri) =>
                        setShirtPhotoUris((prev) => {
                          const next = [...prev];
                          next[index] = newUri;
                          return next;
                        })
                      }
                      aspect={[3, 4]}
                      source="camera"
                      size={photoSlotSize}
                      onPermissionDenied={() => showToast(t('form.cameraPermissionDenied'), 'error')}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {garmentType === 'pant' || garmentType === 'both' ? (
            <View className="mb-4 w-full">
              <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('form.pantPhotosCount', { count: pantPhotoUris.length })}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-3">
                  {pantPhotoUris.map((uri, index) => (
                    <ImagePickerField
                      key={index}
                      label={t('form.piece', { number: index + 1 })}
                      uri={uri}
                      onChange={(newUri) =>
                        setPantPhotoUris((prev) => {
                          const next = [...prev];
                          next[index] = newUri;
                          return next;
                        })
                      }
                      aspect={[3, 4]}
                      source="camera"
                      size={photoSlotSize}
                      onPermissionDenied={() => showToast(t('form.cameraPermissionDenied'), 'error')}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          <DatePickerField
            label={t('form.deliveryDate')}
            value={deliveryDate}
            onChange={(d) => {
              setDeliveryDate(d);
              setDeliveryDateTouched(true);
            }}
            minimumDate={new Date()}
          />
          {!isEditing && !deliveryDateTouched && clothCountNum > 0 ? (
            <Text className="font-sans -mt-3 mb-4 text-xs text-gray-400 dark:text-gray-500">{t('form.deliverySuggested')}</Text>
          ) : null}

          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.priority')}</Text>
            <RadioGroup<OrderPriority>
              value={priority}
              onChange={setPriority}
              direction="row"
              options={[
                { label: t('form.priorityNormal'), value: 'normal' },
                { label: t('form.priorityUrgent'), value: 'urgent' },
              ]}
            />
          </View>

          <InputField
            label={t('form.billBookNumber')}
            value={billBookNumber}
            onChangeText={setBillBookNumber}
            placeholder={t('form.billBookPlaceholder')}
          />

          {isEditing ? (
            <Text className="font-sans mb-4 text-xs text-gray-500 dark:text-gray-400">{t('form.billingNotice')}</Text>
          ) : (
            <>
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.paymentMode')}</Text>
                <RadioGroup<string>
                  value={paymentMode}
                  onChange={setPaymentMode}
                  direction="row"
                  options={PAYMENT_MODES.map((m) => ({ label: PAYMENT_MODE_LABELS[m], value: m }))}
                />
              </View>

              <InputField
                label={t('form.totalAmount')}
                value={totalAmount}
                onChangeText={setTotalAmount}
                placeholder={t('form.totalAmountPlaceholder')}
                keyboardType="numeric"
              />

              <InputField
                label={t('form.paidAmount')}
                value={paidAmount}
                onChangeText={setPaidAmount}
                placeholder={t('form.paidAmountPlaceholder')}
                keyboardType="numeric"
              />
            </>
          )}

          <Button
            title={isEditing ? t('form.updateOrder') : t('form.createOrder')}
            onPress={handleSave}
            loading={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
