import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Avatar, Button, Card, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { staffRepo } from '../../lib/data/repository';
import { formatCurrency, formatDate } from '../../lib/format';
import { sendWhatsAppMessage } from '../../lib/whatsapp';
import { useShop } from '../../context/AuthContext';
import type { SettingsScreenProps } from '../../navigation/types';
import type { Tables } from '../../lib/database.types';
import type { Staff } from '../../types';

type WorkEntry = Tables<'staff_work_entries'>;

/** Sums up a work entry's earnings — quantity × the rate applied when it was logged. */
function entryEarning(entry: WorkEntry): number {
  return Number(entry.quantity) * Number(entry.rate_applied);
}

function isInMonth(dateStr: string, monthsAgo: number): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
}

export default function StaffDetailScreen({ navigation, route }: SettingsScreenProps<'StaffDetail'>) {
  const { t } = useTranslation('staff');
  const { staffId } = route.params;
  const showToast = useToast();
  const shop = useShop();

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
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReport, setSendingReport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffData, workRes] = await Promise.all([
        staffRepo.get(staffId),
        supabase
          .from('staff_work_entries')
          .select('*')
          .eq('staff_id', staffId)
          .order('work_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (!staffData) {
        // Staff member no longer exists (e.g. deleted elsewhere) — leave, but
        // say why instead of silently bouncing back with no explanation.
        showToast(t('detail.loadError'), 'error');
        navigation.goBack();
        return;
      }

      setStaff(staffData);
      setWorkEntries(workRes.data ?? []);
    } catch {
      showToast(t('detail.loadError'), 'error');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [staffId, navigation, showToast, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const thisMonthEarnings = useMemo(
    () => workEntries.filter((w) => isInMonth(w.work_date, 0)).reduce((s, w) => s + entryEarning(w), 0),
    [workEntries]
  );
  const lastMonthEarnings = useMemo(
    () => workEntries.filter((w) => isInMonth(w.work_date, 1)).reduce((s, w) => s + entryEarning(w), 0),
    [workEntries]
  );
  const totalEarnings = useMemo(() => workEntries.reduce((s, w) => s + entryEarning(w), 0), [workEntries]);

  const handleDelete = () => {
    if (!staff) return;
    Alert.alert(t('detail.deleteConfirmTitle'), t('detail.deleteConfirmMessage', { name: staff.name }), [
      { text: t('detail.cancel'), style: 'cancel' },
      {
        text: t('detail.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await staffRepo.remove(staff.id, shop.id);
            showToast(t('detail.deleteSuccess'), 'success');
            navigation.goBack();
          } catch (err) {
            showToast(err instanceof Error ? err.message : t('detail.deleteFailed'), 'error');
          }
        },
      },
    ]);
  };

  const handleSendReport = async () => {
    if (!staff) return;
    setSendingReport(true);
    try {
      await sendWhatsAppMessage(
        staff.phone,
        t('detail.reportMessage', {
          staffName: staff.name,
          shopName: shop.shop_name,
          amount: formatCurrency(thisMonthEarnings),
        })
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('detail.reportSendFailed'), 'error');
    } finally {
      setSendingReport(false);
    }
  };

  if (loading || !staff) return <LoadingSpinner fullScreen text={t('detail.loading')} />;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Header
        title={staff.name}
        onBack={() => navigation.goBack()}
        right={
          <View className="flex-row items-center">
            <Pressable
              onPress={() => navigation.navigate('StaffForm', { staffId: staff.id })}
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
                  <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">/{WAGE_LABELS[staff.wage_type]}</Text>
                </Text>
              </View>
            )}
          </View>
        </Card>

        <Card>
          <View className="mb-3 flex-row items-center">
            <FontAwesome5 name="chart-line" size={13} color="#6B7280" />
            <Text className="ml-2 text-base font-semibold text-[#101828] dark:text-gray-50">{t('detail.performanceReport')}</Text>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-md bg-emerald-50 p-3 dark:bg-emerald-950">
              <Text className="font-sans text-xs text-emerald-700 dark:text-emerald-400">{t('detail.thisMonth')}</Text>
              <Text className="mt-1 text-lg font-bold text-emerald-800 dark:text-emerald-300">
                {formatCurrency(thisMonthEarnings)}
              </Text>
            </View>
            <View className="flex-1 rounded-md bg-gray-50 p-3 dark:bg-gray-800">
              <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">{t('detail.lastMonth')}</Text>
              <Text className="mt-1 text-lg font-bold text-[#101828] dark:text-gray-50">
                {formatCurrency(lastMonthEarnings)}
              </Text>
            </View>
          </View>
          <View className="mt-2 flex-row items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800">
            <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('detail.allTimeEarnings')}</Text>
            <Text className="text-base font-bold text-[#101828] dark:text-gray-50">{formatCurrency(totalEarnings)}</Text>
          </View>

          <Button
            title={t('detail.sendReport')}
            onPress={handleSendReport}
            loading={sendingReport}
            disabled={!staff.phone}
            variant="secondary"
            className="mt-4"
          />
        </Card>

        {workEntries.length > 0 ? (
          <View>
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <FontAwesome5 name="clipboard-list" size={13} color="#6B7280" />
                <Text className="ml-2 text-base font-semibold text-[#101828] dark:text-gray-50">{t('detail.workEntries')}</Text>
              </View>
              <Pressable onPress={() => navigation.navigate('StaffWorkEntryForm', { staffId: staff.id })}>
                <Text className="text-sm font-semibold text-primary-600 dark:text-primary-400">{t('detail.addWorkEntry')}</Text>
              </Pressable>
            </View>

            <Card>
              <View className="mb-3 flex-row items-center justify-between rounded-md bg-emerald-50 p-3 dark:bg-emerald-950">
                <Text className="font-sans text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  {t('detail.workTotal')}
                </Text>
                <Text className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                  {formatCurrency(
                    workEntries.reduce((s, w) => s + Number(w.quantity) * Number(w.rate_applied), 0)
                  )}
                </Text>
              </View>

              <View className="gap-3">
                {workEntries.map((w, index) => (
                  <View
                    key={w.id}
                    className={`flex-row items-center ${
                      index < workEntries.length - 1 ? 'border-b border-gray-100 pb-3 dark:border-gray-800' : ''
                    }`}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950">
                      <FontAwesome5 name="tshirt" size={14} color="#1D4ED8" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-semibold text-[#101828] dark:text-gray-50">
                        {WORK_TYPE_LABELS[w.work_type]} × {w.quantity}
                      </Text>
                      <Text className="font-sans mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(w.work_date)} · {formatCurrency(w.rate_applied)}
                        {t('detail.perPieceSuffix')}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-[#101828] dark:text-gray-50">
                      {formatCurrency(Number(w.quantity) * Number(w.rate_applied))}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ) : (
          <Button
            title={t('detail.addWorkEntry')}
            onPress={() => navigation.navigate('StaffWorkEntryForm', { staffId: staff.id })}
            variant="secondary"
          />
        )}
      </ScrollView>
    </View>
  );
}
