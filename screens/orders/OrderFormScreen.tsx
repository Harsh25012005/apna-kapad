import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  Button,
  DatePickerField,
  Dropdown,
  EmptyState,
  Header,
  ImagePickerField,
  InputField,
  LoadingSpinner,
  QuickAddCustomerSheet,
  RadioGroup,
  useToast,
} from '../../components/ui';
import { uploadImage } from '../../lib/storage';
import { useShop } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { customersRepo, ordersRepo, billsRepo, paymentsRepo } from '../../lib/data/repository';
import { formatCurrency } from '../../lib/format';
import { suggestDeliveryDate } from '../../lib/orderScheduling';
import type { AppScreenProps } from '../../navigation/types';
import type { Measurement, OrderPriority } from '../../types';

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
  // Pre-filled for new orders so a routine order needs no typing: a tailor
  // takes mostly the same kind of work all day, and one piece is by far the
  // most common count. Both stay fully editable.
  const [garmentType, setGarmentType] = useState<GarmentType | ''>(isEditing ? '' : 'shirt');
  const [clothCount, setClothCount] = useState(isEditing ? '' : '1');
  const [shirtCount, setShirtCount] = useState('');
  const [pantCount, setPantCount] = useState('');
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

  // Creating an order is chunked into a 4-step wizard so a busy counter
  // doesn't have to scroll through everything (garment, photos, delivery,
  // payment) at once — editing an existing order stays the original single
  // scroll, since that's a more deliberate, lower-frequency action.
  // Only step 1 has required input; a "Save Order Now" shortcut appears
  // from there on so the remaining steps never have to be tapped through.
  const STEP_COUNT = 3;
  const [step, setStep] = useState(0);
  const [measurement, setMeasurement] = useState<Measurement[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  const shirtCountNum = Math.max(0, Math.floor(Number(shirtCount) || 0));
  const pantCountNum = Math.max(0, Math.floor(Number(pantCount) || 0));
  // Editing an existing order only ever has one combined count on record
  // (orders are saved as a single item), so the shirt/pant split only
  // applies to the new-order wizard, where it's entered directly.
  const clothCountNum =
    !isEditing && garmentType === 'both'
      ? shirtCountNum + pantCountNum
      : Math.max(0, Math.floor(Number(clothCount) || 0));
  const totalAmountNum = Math.max(0, Number(totalAmount) || 0);
  const selectedCustomerName = customers.find((c) => c.value === customerId)?.label ?? '';

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
  // preserving already-picked images when the count grows or shrinks. In the
  // new-order wizard with both garments selected, shirt and pant each get
  // their own slot count from their own quantity field.
  useEffect(() => {
    if (!isEditing && garmentType === 'both') {
      setShirtPhotoUris((prev) => resizePhotoSlots(prev, Math.max(1, shirtCountNum)));
      setPantPhotoUris((prev) => resizePhotoSlots(prev, Math.max(1, pantCountNum)));
      return;
    }
    const slots = Math.max(1, clothCountNum);
    setShirtPhotoUris((prev) => resizePhotoSlots(prev, slots));
    setPantPhotoUris((prev) => resizePhotoSlots(prev, slots));
  }, [clothCountNum, shirtCountNum, pantCountNum, garmentType, isEditing]);

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
            // Order no longer exists (e.g. deleted elsewhere) — leave, but
            // say why instead of silently bouncing back with no explanation.
            showToast(t('form.loadError'), 'error');
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
          showToast(t('form.loadError'), 'error');
          navigation.goBack();
        } finally {
          if (active) setLoadingOrder(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [orderId, navigation, showToast, t])
  );

  const loadCustomers = useCallback(async () => {
    const customerRows = await customersRepo.list(shop.id);
    setCustomers(customerRows.map((c) => ({ label: c.name, value: c.id })));
    setCustomersLoaded(true);
  }, [shop.id]);

  useFocusEffect(
    useCallback(() => {
      void loadCustomers();
    }, [loadCustomers])
  );

  // Fetches the selected client's saved measurement (not just whether one
  // exists), so step 2 can show the actual numbers inline instead of forcing
  // a separate trip through Customer Detail to check them.
  useEffect(() => {
    if (!customerId) {
      setMeasurement([]);
      return;
    }
    let active = true;
    void supabase
      .from('measurements')
      .select('*')
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (active) setMeasurement(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  /**
   * Measurements matching the chosen garment type. A "Shirt + Pant" order
   * needs both the shirt and the pant record shown, so this filters rather
   * than picking a single newest row — previously only one ever appeared.
   */
  const relevantMeasurements = measurement.filter((m) => {
    const g = (m.garment_type ?? '').toLowerCase().replace(/[\s+]/g, '');
    if (garmentType === 'shirt') return g.includes('shirt');
    if (garmentType === 'pant') return g.includes('pant');
    return true;
  });

  const goNext = () => {
    if (step === 0 && !customerId) {
      setError(t('form.customerRequired'));
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

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

      // Order creation silently also writes a Bill (and a Payment, if any was
      // collected) behind the scenes — say so plainly instead of a generic
      // "order created" toast, so the user isn't left guessing where a bill
      // came from later.
      if (totalAmountNum > 0 && paidAmountNum > 0 && paidAmountNum >= totalAmountNum) {
        showToast(
          t('form.orderCreatedFullyPaid', {
            number: orderNumber,
            customer: selectedCustomerName,
            total: formatCurrency(totalAmountNum),
          }),
          'success'
        );
      } else if (totalAmountNum > 0 && paidAmountNum > 0) {
        showToast(
          t('form.orderCreatedWithPayment', {
            number: orderNumber,
            customer: selectedCustomerName,
            paid: formatCurrency(paidAmountNum),
            total: formatCurrency(totalAmountNum),
            due: formatCurrency(totalAmountNum - paidAmountNum),
          }),
          'success'
        );
      } else {
        showToast(
          t('form.orderCreatedNoPayment', { number: orderNumber, customer: selectedCustomerName }),
          'success'
        );
      }
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('form.orderCreateFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingOrder) return <LoadingSpinner fullScreen text={t('form.loading')} />;

  // Editing keeps the original single-scroll layout — it's a deliberate,
  // lower-frequency action where the current fields are already fine.
  // Photo/payment sections still branch on isEditing exactly as before.
  if (isEditing) {
    return (
      <>
        <Header title={t('form.editTitle')} onBack={() => navigation.goBack()} />
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            className="flex-1 bg-white dark:bg-gray-950"
            contentContainerStyle={{ padding: 20, paddingBottom: 224 }}
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
              onAddNew={() => setQuickAddVisible(true)}
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
              keyboardType="number-pad"
            />

            <InputField
              label={t('form.itemNotes')}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('form.itemNotesPlaceholder')}
            />

            {garmentType === 'shirt' || garmentType === 'both' ? (
              <View className="mb-4 w-full">
                <Text className="mb-1.5 text-base font-medium text-gray-700 dark:text-gray-300">
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
                <Text className="mb-1.5 text-base font-medium text-gray-700 dark:text-gray-300">
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

            <View className="mb-4">
              <Text className="mb-1.5 text-base font-medium text-gray-700 dark:text-gray-300">{t('form.priority')}</Text>
              <RadioGroup<OrderPriority>
                variant="cards"
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

            <Text className="font-sans mb-4 text-base text-gray-500 dark:text-gray-400">{t('form.billingNotice')}</Text>

            <Button title={t('form.updateOrder')} size="lg" onPress={handleSave} loading={loading} />
          </ScrollView>
        </KeyboardAvoidingView>

        <QuickAddCustomerSheet
          visible={quickAddVisible}
          onClose={() => setQuickAddVisible(false)}
          onCreated={(customer) => {
            setQuickAddVisible(false);
            setCustomers((prev) => [...prev, { label: customer.name, value: customer.id }].sort((a, b) => a.label.localeCompare(b.label)));
            setCustomerId(customer.id);
          }}
        />
      </>
    );
  }

  // New order: 4-step wizard. Chunks "who/what, photos+measurements,
  // delivery, payment" into separate screens with a visible step count,
  // instead of one long scroll — steps 2-4 are all skippable.
  const STEP_TITLE_KEYS = ['whoWhat', 'photos', 'deliveryPayment'] as const;

  return (
    <>
      <Header title={t('form.title')} onBack={() => navigation.goBack()} />
      <View className="border-b border-gray-100 bg-white px-5 pb-3 dark:border-gray-800 dark:bg-gray-950">
        <Text className="mb-2 text-base font-semibold text-primary-600 dark:text-primary-400">
          {t('form.stepOf', { current: step + 1, total: STEP_COUNT })} · {t(`form.stepTitles.${STEP_TITLE_KEYS[step]}`)}
        </Text>
        <View className="flex-row gap-1.5">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <View
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 bg-white dark:bg-gray-950"
          contentContainerStyle={{ padding: 20, paddingBottom: 224 }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 ? (
            customersLoaded && customers.length === 0 ? (
              <EmptyState
                icon="user-plus"
                title={t('form.noClientsTitle')}
                description={t('form.noClientsDescription')}
                actionLabel={t('form.addClient')}
                onAction={() => setQuickAddVisible(true)}
              />
            ) : (
              <>
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
                  onAddNew={() => setQuickAddVisible(true)}
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

                {garmentType === 'both' ? (
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <InputField
                        label={t('form.shirtQuantity')}
                        value={shirtCount}
                        onChangeText={setShirtCount}
                        placeholder={t('form.clothCountPlaceholder')}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View className="flex-1">
                      <InputField
                        label={t('form.pantQuantity')}
                        value={pantCount}
                        onChangeText={setPantCount}
                        placeholder={t('form.clothCountPlaceholder')}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                ) : (
                  <InputField
                    label={t('form.clothCount')}
                    value={clothCount}
                    onChangeText={setClothCount}
                    placeholder={t('form.clothCountPlaceholder')}
                    keyboardType="number-pad"
                  />
                )}
              </>
            )
          ) : null}

          {step === 1 ? (
            <>
              {customerId ? (
                relevantMeasurements.length > 0 ? (
                  relevantMeasurements.map((measurement) => (
                  <View key={measurement.id} className="mb-5 overflow-hidden rounded-lg border border-primary-200 dark:border-primary-800">
                    <View className="flex-row items-center justify-between bg-primary-50 px-4 py-3 dark:bg-primary-950">
                      <View className="flex-row items-center">
                        <FontAwesome5 name="ruler-combined" size={13} color="#1D4ED8" />
                        <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-gray-50">
                          {t('form.measurementsOnFile')}
                        </Text>
                      </View>
                      <View className="rounded-full bg-primary-100 px-2.5 py-1 dark:bg-primary-900">
                        <Text className="font-sans text-base font-medium text-primary-700 dark:text-primary-300">
                          {measurement.garment_type}
                        </Text>
                      </View>
                    </View>
                    <View className="bg-white p-4 dark:bg-gray-900">
                      <View className="mb-4 flex-row flex-wrap gap-2">
                        {[
                          { label: t('detail.measurementFields.chest'), value: measurement.chest },
                          { label: t('detail.measurementFields.waist'), value: measurement.waist },
                          { label: t('detail.measurementFields.shoulder'), value: measurement.shoulder },
                          { label: t('detail.measurementFields.length'), value: measurement.length },
                          { label: t('detail.measurementFields.sleeve'), value: measurement.sleeve },
                        ]
                          .filter((f) => f.value != null)
                          .map((f) => (
                            <View
                              key={f.label}
                              className="min-w-[80px] flex-1 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800"
                            >
                              <Text className="font-sans text-base text-gray-500 dark:text-gray-400">{f.label}</Text>
                              <Text className="mt-0.5 text-base font-bold text-gray-900 dark:text-gray-50">
                                {f.value}"
                              </Text>
                            </View>
                          ))}
                      </View>
                      <Button
                        title={t('form.viewEditMeasurements')}
                        variant="secondary"
                        onPress={() =>
                          navigation.navigate('CustomersTab' as any, {
                            screen: 'MeasurementForm',
                            params: { customerId, measurementId: measurement.id },
                          })
                        }
                      />
                    </View>
                  </View>
                  ))
                ) : (
                  <View className="mb-5 flex-row items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                    <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                      <FontAwesome5 name="ruler-combined" size={13} color="#B45309" />
                    </View>
                    <View className="flex-1">
                      <Text className="mb-0.5 text-base font-semibold text-gray-900 dark:text-gray-50">
                        {t('form.noMeasurementsOnFile')}
                      </Text>
                      <Text className="font-sans mb-3 text-base text-gray-600 dark:text-gray-300">
                        {t('form.noMeasurementsHint')}
                      </Text>
                      <Button
                        title={t('form.addMeasurementsNow')}
                        variant="secondary"
                        fullWidth={false}
                        onPress={() =>
                          navigation.navigate('CustomersTab' as any, {
                            screen: 'MeasurementForm',
                            params: { customerId },
                          })
                        }
                      />
                    </View>
                  </View>
                )
              ) : null}

              <InputField
                label={t('form.itemNotes')}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('form.itemNotesPlaceholder')}
              />

              {/* Shirt and pant photo columns sit side by side when the
                  order has both, so neither is hidden below the fold. */}
              <View className={garmentType === 'both' ? 'flex-row gap-3' : ''}>
              {garmentType === 'shirt' || garmentType === 'both' ? (
                <View className={garmentType === 'both' ? 'mb-4 flex-1' : 'mb-4 w-full'}>
                  <Text className="mb-1.5 text-base font-medium text-gray-700 dark:text-gray-300">
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
                <View className={garmentType === 'both' ? 'mb-4 flex-1' : 'mb-4 w-full'}>
                  <Text className="mb-1.5 text-base font-medium text-gray-700 dark:text-gray-300">
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
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <DatePickerField
                label={t('form.deliveryDate')}
                value={deliveryDate}
                onChange={(d) => {
                  setDeliveryDate(d);
                  setDeliveryDateTouched(true);
                }}
                minimumDate={new Date()}
              />
              {!deliveryDateTouched && clothCountNum > 0 ? (
                <Text className="font-sans -mt-3 mb-4 text-base text-gray-400 dark:text-gray-500">
                  {t('form.deliverySuggested')}
                </Text>
              ) : null}

              <View className="mb-4">
                <Text className="mb-1.5 text-base font-medium text-gray-700 dark:text-gray-300">
                  {t('form.urgentQuestion')}
                </Text>
                <RadioGroup<OrderPriority>
                  variant="cards"
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

              {/* Payment merged into the delivery step — neither had enough
                  on it to justify its own screen, and both are optional. */}
              <View className="mb-4 mt-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                <Text className="mb-1.5 text-base font-medium text-gray-700 dark:text-gray-300">{t('form.paymentMode')}</Text>
                <RadioGroup<string>
                  variant="cards"
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
                keyboardType="number-pad"
              />

              <InputField
                label={t('form.paidAmount')}
                value={paidAmount}
                onChangeText={setPaidAmount}
                placeholder={t('form.paidAmountPlaceholder')}
                keyboardType="number-pad"
              />
            </>
          ) : null}

          <View className="mt-2 flex-row gap-3">
            {step > 0 ? (
              <Button
                title={t('form.back')}
                variant="outline"
                size="md"
                fullWidth={false}
                onPress={goBack}
                className="flex-1"
              />
            ) : null}
            {step < STEP_COUNT - 1 ? (
              <Button title={t('form.next')} size="md" fullWidth={false} onPress={goNext} className="flex-1" />
            ) : (
              <Button
                title={t('form.createOrderFinal')}
                size="md"
                fullWidth={false}
                onPress={handleSave}
                loading={loading}
                className="flex-1"
              />
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <QuickAddCustomerSheet
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
        onCreated={(customer) => {
          setQuickAddVisible(false);
          setCustomers((prev) => [...prev, { label: customer.name, value: customer.id }].sort((a, b) => a.label.localeCompare(b.label)));
          setCustomerId(customer.id);
        }}
      />
    </>
  );
}
