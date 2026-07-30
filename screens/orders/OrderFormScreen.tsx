import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DatePickerField,
  Dropdown,
  Header,
  ImagePickerField,
  InputField,
  RadioGroup,
  useToast,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../lib/storage';
import { useShop } from '../../context/AuthContext';
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
  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .eq('shop_id', shopId);
  if (error) throw error;

  // created_at can tie for seeded/bulk-inserted rows, so the highest order
  // number must be found numerically across all rows rather than by taking
  // the "most recent" one.
  const highest = (data ?? []).reduce((max, row) => {
    const n = Number(row.order_number?.match(/(\d+)$/)?.[1] ?? 0);
    return n > max ? n : max;
  }, 0);
  return `ORD-${highest + 1}`;
}

export default function OrderFormScreen({ navigation, route }: AppScreenProps<'OrderForm'>) {
  const presetCustomerId = route.params?.customerId;
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
  const [clothCount, setClothCount] = useState('');
  const [designPhotoUris, setDesignPhotoUris] = useState<(string | null)[]>([]);
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [assignedStaffId, setAssignedStaffId] = useState<string>('');
  const [billBookNumber, setBillBookNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const clothCountNum = Math.max(0, Math.floor(Number(clothCount) || 0));

  useEffect(() => {
    // Keep the photo slot array in sync with the number of cloth pieces,
    // preserving any already-picked URIs when the count changes.
    setDesignPhotoUris((prev) => {
      if (prev.length === clothCountNum) return prev;
      const next = prev.slice(0, clothCountNum);
      while (next.length < clothCountNum) next.push(null);
      return next;
    });
  }, [clothCountNum]);

  useEffect(() => {
    void (async () => {
      const [customerRes, staffRes] = await Promise.all([
        supabase.from('customers').select('id, name').order('name'),
        supabase.from('staff').select('id, name').order('name'),
      ]);
      setCustomers((customerRes.data ?? []).map((c) => ({ label: c.name, value: c.id })));
      setStaff((staffRes.data ?? []).map((s) => ({ label: s.name, value: s.id })));
    })();
  }, []);

  const handleSave = async () => {
    if (!customerId) {
      setError(t('form.customerRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      let designPhotoUrls: string[] | null = null;
      const totalAmountNum = totalAmount.trim() ? Number(totalAmount) : null;
      const paidAmountNum = paidAmount.trim() ? Number(paidAmount) : 0;
      let createdOrderId: string | null = null;

      // Retry once on a unique-constraint conflict (code 23505): another
      // order could have taken the just-computed number between the read
      // and the write.
      for (let attempt = 0; attempt < 2; attempt++) {
        const orderNumber = await nextOrderNumber(shop.id);

        if (designPhotoUrls === null) {
          const urls: string[] = [];
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
              urls.push(url);
            } catch {
              showToast(t('form.photoUploadFailed'), 'info');
            }
          }
          designPhotoUrls = urls;
        }

        const { data: insertedOrder, error: insertError } = await supabase
          .from('orders')
          .insert({
            shop_id: shop.id,
            order_number: orderNumber,
            customer_id: customerId,
            cloth_count: clothCountNum || null,
            design_photo_urls: designPhotoUrls ?? [],
            delivery_date: deliveryDate ? deliveryDate.toISOString().slice(0, 10) : null,
            priority,
            assigned_staff_id: assignedStaffId || null,
            bill_book_number: billBookNumber.trim() || null,
            total_amount: totalAmountNum,
            paid_amount: paidAmountNum,
            payment_mode: paymentMode || null,
          })
          .select('id')
          .single();

        if (!insertError) {
          createdOrderId = insertedOrder?.id ?? null;
          break;
        }
        if (insertError.code !== '23505' || attempt === 1) throw insertError;
      }

      // The order itself is already saved at this point — a failure here
      // (e.g. RLS hiccup) shouldn't be reported as an order-creation failure.
      if (createdOrderId && totalAmountNum) {
        try {
          const paymentStatus =
            paidAmountNum <= 0 ? 'unpaid' : paidAmountNum >= totalAmountNum ? 'paid' : 'partial';

          const { data: bill, error: billError } = await supabase
            .from('bills')
            .insert({
              shop_id: shop.id,
              order_id: createdOrderId,
              customer_id: customerId,
              fabric_cost: 0,
              stitching_charge: totalAmountNum,
              tax: 0,
              discount: 0,
              payment_status: paymentStatus,
            })
            .select('id')
            .single();
          if (billError) throw billError;

          if (paidAmountNum > 0 && bill) {
            const { error: paymentError } = await supabase.from('payments').insert({
              shop_id: shop.id,
              bill_id: bill.id,
              customer_id: customerId,
              amount_paid: paidAmountNum,
              payment_mode: paymentMode || null,
            });
            if (paymentError) throw paymentError;
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

  return (
    <>
      <Header title={t('form.title')} onBack={() => navigation.goBack()} />
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
        <Dropdown
          label={t('form.customer')}
          value={customerId}
          onChange={setCustomerId}
          options={customers}
          placeholder={t('form.selectCustomer')}
          error={error}
        />

        <InputField
          label={t('form.clothCount')}
          value={clothCount}
          onChangeText={setClothCount}
          placeholder={t('form.clothCountPlaceholder')}
          keyboardType="numeric"
        />

        {clothCountNum > 0 ? (
          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-gray-700">{t('form.designPhotos')}</Text>
            <View className="flex-row flex-wrap gap-3">
              {Array.from({ length: clothCountNum }).map((_, index) => (
                <ImagePickerField
                  key={index}
                  label={t('form.piece', { number: index + 1 })}
                  uri={designPhotoUris[index] ?? null}
                  onChange={(uri) =>
                    setDesignPhotoUris((prev) => {
                      const next = [...prev];
                      next[index] = uri;
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
          onChange={setDeliveryDate}
          minimumDate={new Date()}
        />

        <View className="mb-4">
          <Text className="mb-1.5 text-sm font-medium text-gray-700">{t('form.priority')}</Text>
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

        <View className="mb-4">
          <Text className="mb-1.5 text-sm font-medium text-gray-700">{t('form.paymentMode')}</Text>
          <RadioGroup<string>
            value={paymentMode}
            onChange={setPaymentMode}
            direction="row"
            options={PAYMENT_MODES.map((m) => ({ label: PAYMENT_MODE_LABELS[m], value: m }))}
          />
        </View>

        <Button title={t('form.createOrder')} onPress={handleSave} loading={loading} />
      </ScrollView>
    </>
  );
}
