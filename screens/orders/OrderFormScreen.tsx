import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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

/**
 * Derives the next order number from the highest existing one for this shop.
 * Using the max rather than a row count keeps numbers unique even after
 * orders are deleted (order_number is UNIQUE per shop).
 */
async function nextOrderNumber(shopId: string): Promise<string> {
  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;

  const last = data?.[0]?.order_number ?? '';
  const lastNumber = Number(last.match(/(\d+)$/)?.[1] ?? 0);
  return `ORD-${lastNumber + 1}`;
}

export default function OrderFormScreen({ navigation, route }: AppScreenProps<'OrderForm'>) {
  const presetCustomerId = route.params?.customerId;
  const shop = useShop();
  const showToast = useToast();

  const [customers, setCustomers] = useState<Option[]>([]);
  const [measurements, setMeasurements] = useState<Option[]>([]);
  const [staff, setStaff] = useState<Option[]>([]);

  const [customerId, setCustomerId] = useState<string>(presetCustomerId ?? '');
  const [clothType, setClothType] = useState('');
  const [designPhotoUri, setDesignPhotoUri] = useState<string | null>(null);
  const [measurementId, setMeasurementId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [assignedStaffId, setAssignedStaffId] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!customerId) {
      setMeasurements([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from('measurements')
        .select('id, garment_type')
        .eq('customer_id', customerId);
      setMeasurements((data ?? []).map((m) => ({ label: m.garment_type, value: m.id })));
    })();
    // A measurement belongs to one customer, so clear any stale selection.
    setMeasurementId('');
  }, [customerId]);

  const handleSave = async () => {
    if (!customerId) {
      setError('Customer is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const orderNumber = await nextOrderNumber(shop.id);

      let designPhotoUrl: string | null = null;
      if (designPhotoUri) {
        try {
          designPhotoUrl = await uploadImage({
            bucket: 'design-photos',
            shopId: shop.id,
            localUri: designPhotoUri,
            fileName: orderNumber,
          });
        } catch {
          showToast('Could not upload the design photo — saving order without it', 'info');
        }
      }

      const { error: insertError } = await supabase.from('orders').insert({
        shop_id: shop.id,
        order_number: orderNumber,
        customer_id: customerId,
        cloth_type: clothType.trim() || null,
        design_photo_url: designPhotoUrl,
        measurement_id: measurementId || null,
        delivery_date: deliveryDate ? deliveryDate.toISOString().slice(0, 10) : null,
        priority,
        assigned_staff_id: assignedStaffId || null,
      });
      if (insertError) throw insertError;

      showToast('Order created', 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create order', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="New Order" onBack={() => navigation.goBack()} />
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20 }}>
        <Dropdown
          label="Customer"
          value={customerId}
          onChange={setCustomerId}
          options={customers}
          placeholder="Select customer"
          error={error}
        />

        <InputField
          label="Cloth Type"
          value={clothType}
          onChangeText={setClothType}
          placeholder="e.g. Cotton, Silk"
          leftIcon="cut"
        />

        <ImagePickerField
          label="Design Photo"
          uri={designPhotoUri}
          onChange={setDesignPhotoUri}
          aspect={[3, 4]}
        />

        {measurements.length > 0 ? (
          <Dropdown
            label="Measurement"
            value={measurementId}
            onChange={setMeasurementId}
            options={measurements}
            placeholder="Select saved measurement"
          />
        ) : null}

        <DatePickerField
          label="Delivery Date"
          value={deliveryDate}
          onChange={setDeliveryDate}
          minimumDate={new Date()}
        />

        <View className="mb-4">
          <Text className="mb-1.5 text-sm font-medium text-gray-700">Priority</Text>
          <RadioGroup<OrderPriority>
            value={priority}
            onChange={setPriority}
            direction="row"
            options={[
              { label: 'Normal', value: 'normal' },
              { label: 'Urgent', value: 'urgent' },
            ]}
          />
        </View>

        {staff.length > 0 ? (
          <Dropdown
            label="Assign Staff"
            value={assignedStaffId}
            onChange={setAssignedStaffId}
            options={staff}
            placeholder="Select tailor"
          />
        ) : null}

        <Button title="Create Order" onPress={handleSave} loading={loading} />
      </ScrollView>
    </>
  );
}
