import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Dropdown, EmptyState, Header, InputField, useToast } from '../../components/ui';
import { customersRepo, billsRepo } from '../../lib/data/repository';
import { formatCurrency } from '../../lib/format';
import { sendWhatsAppMessage, buildBillMessage } from '../../lib/whatsapp';
import { useShop } from '../../context/AuthContext';
import type { AppScreenProps } from '../../navigation/types';
import type { Customer } from '../../types';

type Option = { label: string; value: string };

function toAmount(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default function BillFormScreen({ navigation, route }: AppScreenProps<'BillForm'>) {
  const orderId = route.params?.orderId;
  const presetCustomerId = route.params?.customerId;
  const shop = useShop();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const { t } = useTranslation('billing');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customerId, setCustomerId] = useState<string>(presetCustomerId ?? '');
  const [fabricCost, setFabricCost] = useState('');
  const [stitchingCharge, setStitchingCharge] = useState('');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCustomers = async () => {
    const data = await customersRepo.list(shop.id);
    setCustomers(data);
    setCustomersLoaded(true);
  };

  useEffect(() => {
    void loadCustomers();
  }, [shop.id]);

  const customerOptions: Option[] = customers.map((c) => ({ label: c.name, value: c.id }));
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  const total = useMemo(
    () =>
      Math.max(toAmount(fabricCost) + toAmount(stitchingCharge) + toAmount(tax) - toAmount(discount), 0),
    [fabricCost, stitchingCharge, discount, tax]
  );

  const handleSave = async () => {
    if (!customerId) {
      setError(t('form.customerRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const bill = await billsRepo.create({
        shop_id: shop.id,
        order_id: orderId ?? null,
        customer_id: customerId,
        fabric_cost: toAmount(fabricCost),
        stitching_charge: toAmount(stitchingCharge),
        discount: toAmount(discount),
        tax: toAmount(tax),
      });
      showToast(t('form.successCreated'), 'success');

      const goToBillDetail = () => {
        navigation.replace('BillDetail', { billId: bill.id });
      };

      if (selectedCustomer?.phone) {
        Alert.alert(t('form.sendMessageTitle'), t('form.sendMessageMessage'), [
          {
            text: t('form.doItLater'),
            style: 'cancel',
            onPress: goToBillDetail,
          },
          {
            text: t('form.sendMessage'),
            onPress: async () => {
              try {
                await sendWhatsAppMessage(
                  selectedCustomer.phone,
                  buildBillMessage({
                    shopName: shop.shop_name,
                    customerName: selectedCustomer.name,
                    total,
                    paid: 0,
                    pending: total,
                  })
                );
              } catch {
                // Bill is already saved — a failed WhatsApp open shouldn't be reported as a save failure.
              }
              goToBillDetail();
            },
          },
        ]);
      } else {
        goToBillDetail();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('form.errorCreate'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title={t('form.title')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-950"
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 160 }}
        keyboardShouldPersistTaps="handled"
      >
        {customersLoaded && customers.length === 0 ? (
          <View className="mb-4">
            <EmptyState
              variant="compact"
              icon="user-plus"
              title={t('form.noClientsTitle')}
              description={t('form.noClientsDescription')}
              actionLabel={t('form.addClient')}
              onAction={() => navigation.navigate('CustomersTab' as any, { screen: 'CustomerForm' })}
            />
          </View>
        ) : (
          <>
            <Dropdown
              label={t('form.customer')}
              value={customerId}
              onChange={setCustomerId}
              options={customerOptions}
              placeholder={t('form.selectCustomer')}
              error={error}
              required
              searchable
              searchPlaceholder={t('form.searchClientPlaceholder')}
              onAddNew={() => navigation.navigate('CustomersTab' as any, { screen: 'CustomerForm' })}
              addNewLabel={t('form.addClient')}
            />

            {selectedCustomer ? (
              <View className="mb-4 flex-row items-center gap-2 rounded-md bg-gray-50 px-4 py-3 dark:bg-gray-800">
                <FontAwesome5 name="phone-alt" size={12} color="#6B7280" />
                <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">
                  {selectedCustomer.phone ?? t('form.noPhone')}
                </Text>
              </View>
            ) : null}
          </>
        )}

        <InputField
          label={t('form.fabricCost')}
          value={fabricCost}
          onChangeText={setFabricCost}
          placeholder={t('form.fabricCostPlaceholder')}
          keyboardType="numeric"
        />
        <InputField
          label={t('form.stitchingCharge')}
          value={stitchingCharge}
          onChangeText={setStitchingCharge}
          placeholder={t('form.stitchingChargePlaceholder')}
          keyboardType="numeric"
        />
        <InputField
          label={t('form.discount')}
          value={discount}
          onChangeText={setDiscount}
          placeholder={t('form.discountPlaceholder')}
          keyboardType="numeric"
        />
        <InputField
          label={t('form.tax')}
          value={tax}
          onChangeText={setTax}
          placeholder={t('form.taxPlaceholder')}
          keyboardType="numeric"
        />

        <View className="mb-6 flex-row items-center justify-between rounded-lg bg-primary-50 p-4 dark:bg-primary-950">
          <Text className="text-sm font-medium text-primary-700 dark:text-primary-300">{t('form.totalAmount')}</Text>
          <Text className="text-xl font-bold text-primary-700 dark:text-primary-300">{formatCurrency(total)}</Text>
        </View>

        <Button title={t('form.createBill')} onPress={handleSave} loading={loading} />
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
