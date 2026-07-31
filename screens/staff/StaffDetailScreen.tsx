import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Avatar, Badge, Button, Card, EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/format';
import type { SettingsScreenProps } from '../../navigation/types';
import type { Tables } from '../../lib/database.types';
import type { Customer, Order, Staff } from '../../types';

type StaffOrder = Order & {
  customers: Pick<Customer, 'name'> | null;
};

type WorkEntry = Tables<'staff_work_entries'>;

export default function StaffDetailScreen({ navigation, route }: SettingsScreenProps<'StaffDetail'>) {
  const { t } = useTranslation('staff');
  const { staffId } = route.params;
  const showToast = useToast();

  const WAGE_LABELS: Record<Staff['wage_type'], string> = {
    daily: t('wageUnit.daily'),
    monthly: t('wageUnit.monthly'),
    per_piece: t('wageUnit.per_piece'),
  };

  const WORK_TYPE_LABELS: Record<WorkEntry['work_type'], string> = {
    pant: t('workEntry.types.pant'),
    shirt: t('workEntry.types.shirt'),
    pant_shirt: t('workEntry.types.pant_shirt'),
  };

  const [staff, setStaff] = useState<Staff | null>(null);
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, ordersRes, workRes] = await Promise.all([
        supabase.from('staff').select('*').eq('id', staffId).single(),
        supabase
          .from('orders')
          .select('*, customers(name)')
          .eq('assigned_staff_id', staffId)
          .order('delivery_date', { ascending: true }),
        supabase
          .from('staff_work_entries')
          .select('*')
          .eq('staff_id', staffId)
          .order('work_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (staffRes.error) throw staffRes.error;

      setStaff(staffRes.data);
      setOrders(ordersRes.data ?? []);
      setWorkEntries(workRes.data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('detail.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [staffId, showToast, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading || !staff) return <LoadingSpinner fullScreen text={t('detail.loading')} />;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Header title={staff.name} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160, gap: 16 }}>
        <Card>
          <View className="flex-row items-center">
            <Avatar name={staff.name} size="lg" />
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold text-[#101828] dark:text-gray-50">{staff.name}</Text>
              <Text className="font-sans mt-0.5 text-sm text-gray-500 dark:text-gray-400">{staff.role ?? t('detail.defaultRole')}</Text>
              {staff.phone ? (
                <View className="mt-1 flex-row items-center">
                  <FontAwesome5 name="phone-alt" size={11} color="#9CA3AF" />
                  <Text className="font-sans ml-1.5 text-sm text-gray-500 dark:text-gray-400">{staff.phone}</Text>
                </View>
              ) : (
                <Text className="font-sans mt-1 text-sm text-gray-400 dark:text-gray-500">{t('detail.noPhone')}</Text>
              )}
            </View>
          </View>

          <View className="mt-4 gap-2">
            {staff.wage_type === 'per_piece' ? (
              <>
                <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                  <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('detail.amountPerPant')}</Text>
                  <Text className="text-base font-bold text-[#101828] dark:text-gray-50">
                    {formatCurrency(staff.wage_amount_pant ?? 0)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                  <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('detail.amountPerShirt')}</Text>
                  <Text className="text-base font-bold text-[#101828] dark:text-gray-50">
                    {formatCurrency(staff.wage_amount_shirt ?? 0)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                  <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('detail.amountPerPair')}</Text>
                  <Text className="text-base font-bold text-[#101828] dark:text-gray-50">
                    {formatCurrency(staff.wage_amount_pair ?? 0)}
                  </Text>
                </View>
              </>
            ) : (
              <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('detail.wageAmount')}</Text>
                <Text className="text-base font-bold text-[#101828] dark:text-gray-50">
                  {formatCurrency(staff.wage_amount)}
                  <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">{WAGE_LABELS[staff.wage_type]}</Text>
                </Text>
              </View>
            )}
          </View>

          <Button
            title={t('detail.editStaff')}
            onPress={() => navigation.navigate('StaffForm', { staffId: staff.id })}
            variant="secondary"
            className="mt-4"
          />
        </Card>

        <View>
          <View className="mb-2 flex-row items-center">
            <FontAwesome5 name="clipboard-list" size={13} color="#6B7280" />
            <Text className="ml-2 text-base font-semibold text-[#101828] dark:text-gray-50">{t('detail.workEntries')}</Text>
          </View>

          {workEntries.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="clipboard-list"
              title={t('detail.emptyWorkTitle')}
              description={t('detail.emptyWorkDescription')}
            />
          ) : (
            <View className="gap-2">
              {workEntries.map((w) => (
                <Card key={w.id}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-[#101828] dark:text-gray-50">
                        {WORK_TYPE_LABELS[w.work_type]} × {w.quantity}
                      </Text>
                      <Text className="font-sans mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(w.work_date)} · {formatCurrency(w.rate_applied)}
                        {t('detail.perPieceSuffix')}
                      </Text>
                    </View>
                    <Text className="text-base font-bold text-[#101828] dark:text-gray-50">
                      {formatCurrency(Number(w.quantity) * Number(w.rate_applied))}
                    </Text>
                  </View>
                </Card>
              ))}

              <View className="flex-row items-center justify-between rounded-md bg-emerald-50 p-3 dark:bg-emerald-950">
                <Text className="font-sans text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  {t('detail.workTotal')}
                </Text>
                <Text className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                  {formatCurrency(
                    workEntries.reduce((s, w) => s + Number(w.quantity) * Number(w.rate_applied), 0)
                  )}
                </Text>
              </View>
            </View>
          )}

          <Button
            title={t('detail.addWorkEntry')}
            onPress={() => navigation.navigate('StaffWorkEntryForm', { staffId: staff.id })}
            variant="secondary"
            className="mt-3"
          />
        </View>

        <View>
          <View className="mb-2 flex-row items-center">
            <FontAwesome5 name="tshirt" size={13} color="#6B7280" />
            <Text className="ml-2 text-base font-semibold text-[#101828] dark:text-gray-50">{t('detail.assignedOrders')}</Text>
          </View>
          {orders.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="tshirt"
              title={t('detail.emptyOrdersTitle')}
              description={t('detail.emptyOrdersDescription')}
            />
          ) : (
            <View className="gap-2">
              {orders.map((o) => (
                <Card key={o.id}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-[#101828] dark:text-gray-50">#{o.order_number}</Text>
                    <Badge type="order_status" value={o.status} />
                  </View>
                  <Text className="font-sans mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {o.customers?.name ?? t('detail.unknownCustomer')}
                    {o.delivery_date ? ` · ${t('detail.deliveryPrefix')} ${formatDate(o.delivery_date)}` : ''}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
