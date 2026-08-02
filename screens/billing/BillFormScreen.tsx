import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Dropdown, EmptyState, Header, InputField, QuickAddCustomerSheet, RadioGroup, useToast } from '../../components/ui';
import { customersRepo, billsRepo, paymentsRepo } from '../../lib/data/repository';
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
  // Most shops just want to type one number and move on — the itemized
  // fields are an opt-in expansion, not the default.
  const [itemized, setItemized] = useState(false);
  const [billAmount, setBillAmount] = useState('');
  const [fabricCost, setFabricCost] = useState('');
  const [stitchingCharge, setStitchingCharge] = useState('');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [error, setError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [paidStatus, setPaidStatus] = useState<'unpaid' | 'paid'>('unpaid');

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const data = await customersRepo.list(shop.id);
        setCustomers(data);
        setCustomersLoaded(true);
      })();
    }, [shop.id])
  );

  const customerOptions: Option[] = customers.map((c) => ({ label: c.name, value: c.id }));
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  const total = useMemo(
    () =>
      itemized
        ? Math.max(toAmount(fabricCost) + toAmount(stitchingCharge) + toAmount(tax) - toAmount(discount), 0)
        : toAmount(billAmount),
    [itemized, billAmount, fabricCost, stitchingCharge, discount, tax]
  );

  const handleSave = async () => {
    let hasError = false;
    if (!customerId) {
      setError(t('form.customerRequired'));
      hasError = true;
    } else {
      setError('');
    }
    if (!itemized && toAmount(billAmount) <= 0) {
      setAmountError(t('form.amountRequired'));
      hasError = true;
    } else {
      setAmountError('');
    }
    if (hasError) return;

    setLoading(true);
    try {
      const bill = await billsRepo.create({
        shop_id: shop.id,
        order_id: orderId ?? null,
        customer_id: customerId,
        fabric_cost: itemized ? toAmount(fabricCost) : toAmount(billAmount),
        stitching_charge: itemized ? toAmount(stitchingCharge) : 0,
        discount: itemized ? toAmount(discount) : 0,
        tax: itemized ? toAmount(tax) : 0,
      });
      showToast(t('form.successCreated'), 'success');

      // Payment status is now chosen up-front in the form (paidStatus state)
      // instead of an Alert fired after the bill already exists — many bills
      // are settled on the spot, and asking here means the whole "create a
      // bill" action is one decision instead of two sequential pop-ups.
      let paidAmount = 0;
      if (paidStatus === 'paid') {
        try {
          await paymentsRepo.create({
            shop_id: shop.id,
            bill_id: bill.id,
            customer_id: customerId,
            amount_paid: total,
            payment_mode: 'Cash',
          });
          paidAmount = total;
        } catch {
          // Bill is already saved — a failed payment record shouldn't be reported as a save failure.
        }
      }

      const goToBillDetail = () => {
        navigation.replace('BillDetail', { billId: bill.id });
      };

      const pending = Math.max(total - paidAmount, 0);
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
                    paid: paidAmount,
                    pending,
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-950"
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
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
              onAction={() => setQuickAddVisible(true)}
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
              onAddNew={() => setQuickAddVisible(true)}
              addNewLabel={t('form.addClient')}
            />

            {selectedCustomer ? (
              <View className="mb-4 flex-row items-center gap-2 rounded-md bg-gray-50 px-4 py-3 dark:bg-gray-800">
                <FontAwesome5 name="phone-alt" size={12} color="#6B7280" />
                <Text className="font-sans text-base text-gray-600 dark:text-gray-300">
                  {selectedCustomer.phone ?? t('form.noPhone')}
                </Text>
              </View>
            ) : null}
          </>
        )}

        {itemized ? (
          <>
            <InputField
              label={t('form.fabricCost')}
              value={fabricCost}
              onChangeText={setFabricCost}
              placeholder={t('form.fabricCostPlaceholder')}
              keyboardType="number-pad"
            />
            <InputField
              label={t('form.stitchingCharge')}
              value={stitchingCharge}
              onChangeText={setStitchingCharge}
              placeholder={t('form.stitchingChargePlaceholder')}
              keyboardType="number-pad"
            />
            <InputField
              label={t('form.discount')}
              value={discount}
              onChangeText={setDiscount}
              placeholder={t('form.discountPlaceholder')}
              keyboardType="number-pad"
            />
            <InputField
              label={t('form.tax')}
              value={tax}
              onChangeText={setTax}
              placeholder={t('form.taxPlaceholder')}
              keyboardType="number-pad"
            />
            <Pressable onPress={() => setItemized(false)} hitSlop={8} className="mb-4 -mt-1 self-start py-2">
              <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">
                {t('form.useSimpleTotal')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <InputField
              label={t('form.billAmount')}
              value={billAmount}
              onChangeText={(v) => {
                setBillAmount(v);
                setAmountError('');
              }}
              placeholder={t('form.billAmountPlaceholder')}
              keyboardType="number-pad"
              error={amountError}
              required
            />
            <Pressable onPress={() => setItemized(true)} hitSlop={8} className="mb-4 -mt-1 self-start py-2">
              <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">
                {t('form.splitIntoItems')}
              </Text>
            </Pressable>
          </>
        )}

        <View className="mb-4">
          <Text className="mb-1.5 text-base font-semibold text-gray-600 dark:text-gray-400">
            {t('form.paymentStatus')}
          </Text>
          <RadioGroup
            variant="cards"
            direction="row"
            value={paidStatus}
            onChange={setPaidStatus}
            options={[
              { label: t('form.markUnpaid'), value: 'unpaid' },
              { label: t('form.markPaid'), value: 'paid' },
            ]}
          />
        </View>

        <View className="mb-6 flex-row items-center justify-between rounded-lg bg-primary-50 p-4 dark:bg-primary-950">
          <Text className="text-base font-medium text-primary-700 dark:text-primary-300">{t('form.totalAmount')}</Text>
          <Text className="text-2xl font-bold text-primary-700 dark:text-primary-300">{formatCurrency(total)}</Text>
        </View>

        <Button title={t('form.createBill')} size="lg" onPress={handleSave} loading={loading} />
      </ScrollView>
      </KeyboardAvoidingView>

      <QuickAddCustomerSheet
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
        onCreated={(customer) => {
          setQuickAddVisible(false);
          setCustomers((prev) => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name)));
          setCustomerId(customer.id);
        }}
      />
    </>
  );
}
