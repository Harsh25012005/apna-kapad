import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
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
import { formatCurrency } from '../../lib/format';
import { useShop } from '../../context/AuthContext';
import { customersRepo, staffRepo, ordersRepo, billsRepo, paymentsRepo } from '../../lib/data/repository';
import { suggestDeliveryDate } from '../../lib/orderScheduling';
import type { AppScreenProps } from '../../navigation/types';
import type { OrderPriority } from '../../types';

type Option = { label: string; value: string };

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'] as const;

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
    Card: t('form.paymentModeCard'),
    'Bank Transfer': t('form.paymentModeBankTransfer'),
  };

  const [customers, setCustomers] = useState<Option[]>([]);
  const [staff, setStaff] = useState<Option[]>([]);

  const [customerId, setCustomerId] = useState<string>(presetCustomerId ?? '');
  const [garmentType, setGarmentType] = useState('');
  const [clothCount, setClothCount] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [designPhotoUris, setDesignPhotoUris] = useState<(string | null)[]>([]);
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [deliveryDateTouched, setDeliveryDateTouched] = useState(false);
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [assignedStaffId, setAssignedStaffId] = useState<string>('');
  const [billBookNumber, setBillBookNumber] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(isEditing);

  const clothCountNum = Math.max(0, Math.floor(Number(clothCount) || 0));
  const unitPriceNum = Math.max(0, Number(unitPrice) || 0);
  const itemsSubtotal = clothCountNum * unitPriceNum;

  const [dictating, setDictating] = useState(false);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) setNotes(transcript);
  });
  useSpeechRecognitionEvent('end', () => setDictating(false));
  useSpeechRecognitionEvent('error', () => {
    setDictating(false);
    showToast(t('form.dictationFailed'), 'error');
  });

  const startDictation = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      showToast(t('form.microphonePermissionDenied'), 'error');
      return;
    }
    setDictating(true);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false, continuous: false });
  };

  const stopDictation = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  // Auto-suggests a delivery date from garment count + the assigned staff
  // member's current backlog. Only runs for new orders and stops once the
  // user has manually picked a date, so it never fights their choice.
  useEffect(() => {
    if (isEditing || deliveryDateTouched || clothCountNum === 0) return;
    void suggestDeliveryDate(shop.id, clothCountNum, assignedStaffId || null).then(setDeliveryDate);
  }, [isEditing, deliveryDateTouched, clothCountNum, assignedStaffId, shop.id]);

  useFocusEffect(
    useCallback(() => {
      if (!orderId) return;
      let active = true;
      setLoadingOrder(true);
      void (async () => {
        try {
          const [data, orderItems] = await Promise.all([ordersRepo.get(orderId), ordersRepo.itemsForOrder(orderId)]);
          if (!data) throw new Error(t('form.loadError'));
          if (!active) return;

          const firstItem = orderItems[0];
          const urls = data.design_photo_urls ?? [];
          setCustomerId(data.customer_id ?? '');
          setGarmentType(firstItem?.garment_type ?? '');
          setClothCount(firstItem ? String(firstItem.cloth_count) : data.cloth_count ? String(data.cloth_count) : '');
          setUnitPrice(firstItem?.unit_price ? String(firstItem.unit_price) : '');
          setNotes(firstItem?.notes ?? '');
          setDesignPhotoUris(urls.length > 0 ? urls : []);
          setDeliveryDate(data.delivery_date ? new Date(data.delivery_date) : null);
          setDeliveryDateTouched(true);
          setPriority((data.priority as OrderPriority) ?? 'normal');
          setAssignedStaffId(data.assigned_staff_id ?? '');
          setBillBookNumber(data.bill_book_number ?? '');
        } catch (err) {
          showToast(err instanceof Error ? err.message : t('form.loadError'), 'error');
        } finally {
          if (active) setLoadingOrder(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [orderId, showToast, t])
  );

  useEffect(() => {
    void (async () => {
      const [customerRows, staffRows] = await Promise.all([
        customersRepo.list(shop.id),
        staffRepo.list(shop.id, { activeOnly: true }),
      ]);
      setCustomers(customerRows.map((c) => ({ label: c.name, value: c.id })));
      setStaff(staffRows.map((s) => ({ label: s.name, value: s.id })));
    })();
  }, [shop.id]);

  /** Uploads any freshly-picked local photo URIs, leaving already-remote ones (edit mode) untouched. */
  const resolveDesignPhotoUrls = async (fileNamePrefix: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < designPhotoUris.length; i++) {
      const uri = designPhotoUris[i];
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
      garment_type: garmentType.trim() || t('form.defaultGarmentType'),
      cloth_count: clothCountNum || 1,
      unit_price: unitPriceNum,
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
        assigned_staff_id: assignedStaffId || null,
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
    setLoading(true);
    try {
      const totalAmountNum = itemsSubtotal > 0 ? itemsSubtotal : null;
      const paidAmountNum = paidAmount.trim() ? Number(paidAmount) : 0;

      const orderNumber = await nextOrderNumber(shop.id);
      const designPhotoUrls: string[] = [];
      for (let i = 0; i < designPhotoUris.length; i++) {
        const localUri = designPhotoUris[i];
        if (!localUri) continue;
        try {
          const url = await uploadImage({
            bucket: 'design-photos',
            shopId: shop.id,
            localUri,
            fileName: `${orderNumber}-${i + 1}`,
          });
          designPhotoUrls.push(url);
        } catch {
          showToast(t('form.photoUploadFailed'), 'info');
        }
      }

      const createdOrder = await ordersRepo.create(
        shop.id,
        {
          order_number: orderNumber,
          customer_id: customerId,
          cloth_count: clothCountNum || null,
          design_photo_urls: designPhotoUrls,
          delivery_date: deliveryDate ? deliveryDate.toISOString().slice(0, 10) : null,
          priority,
          assigned_staff_id: assignedStaffId || null,
          bill_book_number: billBookNumber.trim() || null,
          total_amount: totalAmountNum,
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
      <ScrollView className="flex-1 bg-white dark:bg-gray-950" contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
        <Dropdown
          label={t('form.customer')}
          value={customerId}
          onChange={setCustomerId}
          options={customers}
          placeholder={t('form.selectCustomer')}
          error={error}
        />

        <InputField
          label={t('form.garmentType')}
          value={garmentType}
          onChangeText={setGarmentType}
          placeholder={t('form.garmentTypePlaceholder')}
        />

        <InputField
          label={t('form.clothCount')}
          value={clothCount}
          onChangeText={setClothCount}
          placeholder={t('form.clothCountPlaceholder')}
          keyboardType="numeric"
        />

        <InputField
          label={t('form.unitPrice')}
          value={unitPrice}
          onChangeText={setUnitPrice}
          keyboardType="numeric"
        />

        <View className="mb-4 flex-row items-end gap-2">
          <View className="flex-1">
            <InputField
              label={t('form.itemNotes')}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('form.itemNotesPlaceholder')}
            />
          </View>
          <Pressable
            onPress={() => (dictating ? stopDictation() : startDictation())}
            className={`mb-4 h-10 w-10 items-center justify-center rounded-full ${
              dictating ? 'bg-danger' : 'bg-primary-50 dark:bg-primary-950'
            }`}
          >
            <FontAwesome5 name="microphone" size={14} color={dictating ? '#FFFFFF' : '#1D4ED8'} />
          </Pressable>
        </View>

        {clothCountNum > 0 ? (
          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.designPhotos')}</Text>
            <View className="flex-row flex-wrap gap-3">
              {[...designPhotoUris, null].map((uri, index) => (
                <ImagePickerField
                  key={index}
                  label={t('form.piece', { number: index + 1 })}
                  uri={uri}
                  onChange={(newUri) =>
                    setDesignPhotoUris((prev) => {
                      const next = [...prev];
                      if (index < next.length) {
                        if (newUri) next[index] = newUri;
                        else next.splice(index, 1);
                      } else if (newUri) {
                        next.push(newUri);
                      }
                      return next;
                    })
                  }
                  aspect={[3, 4]}
                  source="camera"
                  onPermissionDenied={() => showToast(t('form.cameraPermissionDenied'), 'error')}
                />
              ))}
            </View>
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

        {staff.length > 0 ? (
          <Dropdown
            label={t('form.assignStaff')}
            value={assignedStaffId}
            onChange={setAssignedStaffId}
            options={staff}
            placeholder={t('form.selectTailor')}
          />
        ) : null}

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
            <View className="mb-4 flex-row items-center justify-between rounded-lg bg-primary-50 p-4 dark:bg-primary-950">
              <Text className="text-sm font-medium text-primary-700 dark:text-primary-300">{t('form.totalAmount')}</Text>
              <Text className="text-xl font-bold text-primary-700 dark:text-primary-300">{formatCurrency(itemsSubtotal)}</Text>
            </View>

            <InputField
              label={t('form.paidAmount')}
              value={paidAmount}
              onChangeText={setPaidAmount}
              placeholder={t('form.paidAmountPlaceholder')}
              keyboardType="numeric"
            />

            <View className="mb-4">
              <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.paymentMode')}</Text>
              <RadioGroup<string>
                value={paymentMode}
                onChange={setPaymentMode}
                direction="row"
                options={PAYMENT_MODES.map((m) => ({ label: PAYMENT_MODE_LABELS[m], value: m }))}
              />
            </View>
          </>
        )}

        <Button
          title={isEditing ? t('form.updateOrder') : t('form.createOrder')}
          onPress={handleSave}
          loading={loading}
        />
      </ScrollView>
    </>
  );
}
