import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Card, EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import type { SettingsScreenProps } from '../../navigation/types';

type MonthBucket = {
  /** YYYY-MM */
  key: string;
  label: string;
  amount: number;
};

type RevenueData = {
  total: number;
  thisMonth: number;
  today: number;
  months: MonthBucket[];
  outstanding: number;
  staffCost: number;
};

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function localDayString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export default function RevenueScreen({ navigation }: SettingsScreenProps<'Revenue'>) {
  const { t } = useTranslation('revenue');
  const showToast = useToast();

  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [paymentsRes, billsRes, workRes] = await Promise.all([
        supabase.from('payments').select('amount_paid, payment_date'),
        supabase.from('bills').select('total_amount, payments(amount_paid)'),
        supabase.from('staff_work_entries').select('quantity, rate_applied'),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;

      const payments = paymentsRes.data ?? [];
      const now = new Date();
      const todayKey = localDayString(now);
      const monthKey = todayKey.slice(0, 7);

      let total = 0;
      let thisMonth = 0;
      let today = 0;
      const byMonth = new Map<string, number>();

      for (const p of payments) {
        const amount = Number(p.amount_paid) || 0;
        const day = localDayString(new Date(p.payment_date));
        const mKey = day.slice(0, 7);

        total += amount;
        if (day === todayKey) today += amount;
        if (mKey === monthKey) thisMonth += amount;
        byMonth.set(mKey, (byMonth.get(mKey) ?? 0) + amount);
      }

      const months: MonthBucket[] = [...byMonth.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, 12)
        .map(([key, amount]) => ({ key, label: monthLabel(key), amount }));

      // Same shape the dashboard uses for totalPendingBalance: bill total minus
      // everything received against that bill, never below zero.
      const outstanding = (billsRes.data ?? []).reduce((sum, bill) => {
        const paid = bill.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
        return sum + Math.max(Number(bill.total_amount ?? 0) - paid, 0);
      }, 0);

      const staffCost = (workRes.data ?? []).reduce(
        (s, w) => s + Number(w.quantity ?? 0) * Number(w.rate_applied ?? 0),
        0
      );

      setData({ total, thisMonth, today, months, outstanding, staffCost });
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('loadError'), 'error');
    }
  }, [showToast, t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  if (loading || !data) return <LoadingSpinner fullScreen text={t('loading')} />;

  const net = data.total - data.staffCost;

  return (
    <View className="flex-1 bg-gray-50">
      <Header title={t('title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 16 }}>
        {/* Total revenue hero */}
        <View className="rounded-md bg-[#101828] p-4">
          <View className="flex-row items-start justify-between">
            <View className="gap-1">
              <Text className="font-sans text-sm font-medium text-[#98A2B3]">{t('totalRevenue')}</Text>
              <Text className="text-[32px] font-medium tracking-tight text-white">
                {formatCurrency(data.total)}
              </Text>
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-md bg-[#1D4ED8]/20">
              <FontAwesome5 name="rupee-sign" size={20} color="#1D4ED8" />
            </View>
          </View>
          <Text className="font-sans mt-2 text-xs text-[#667085]">{t('revenueNote')}</Text>
        </View>

        {/* This month / today */}
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-md border border-gray-200 bg-white p-4">
            <Text className="font-sans text-xs font-medium text-gray-500">{t('thisMonth')}</Text>
            <Text className="mt-1 text-lg font-bold text-[#101828]">{formatCurrency(data.thisMonth)}</Text>
          </View>
          <View className="flex-1 rounded-md border border-gray-200 bg-white p-4">
            <Text className="font-sans text-xs font-medium text-gray-500">{t('today')}</Text>
            <Text className="mt-1 text-lg font-bold text-[#101828]">{formatCurrency(data.today)}</Text>
          </View>
        </View>

        {/* Net summary */}
        <Card>
          <Text className="mb-3 text-base font-semibold text-[#101828]">{t('summary')}</Text>
          <View className="gap-2">
            <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-3">
              <Text className="font-sans text-sm text-gray-600">{t('received')}</Text>
              <Text className="text-base font-bold text-emerald-700">{formatCurrency(data.total)}</Text>
            </View>
            <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-3">
              <Text className="font-sans text-sm text-gray-600">{t('staffCost')}</Text>
              <Text className="text-base font-bold text-danger">- {formatCurrency(data.staffCost)}</Text>
            </View>
            <View className="flex-row items-center justify-between rounded-md bg-gray-100 p-3">
              <Text className="font-sans text-sm font-medium text-[#101828]">{t('net')}</Text>
              <Text className="text-base font-bold text-[#101828]">{formatCurrency(net)}</Text>
            </View>
            <View className="flex-row items-center justify-between rounded-md bg-amber-50 p-3">
              <Text className="font-sans text-sm text-amber-800">{t('outstanding')}</Text>
              <Text className="text-base font-bold text-amber-800">{formatCurrency(data.outstanding)}</Text>
            </View>
          </View>
        </Card>

        {/* Month breakdown */}
        <View>
          <View className="mb-2 flex-row items-center">
            <FontAwesome5 name="chart-line" size={13} color="#6B7280" />
            <Text className="ml-2 text-base font-semibold text-[#101828]">{t('byMonth')}</Text>
          </View>
          {data.months.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="chart-line"
              title={t('emptyTitle')}
              description={t('emptyDescription')}
            />
          ) : (
            <View className="gap-2">
              {data.months.map((m) => (
                <View
                  key={m.key}
                  className="flex-row items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3.5"
                >
                  <Text className="font-sans text-sm font-medium text-[#101828]">{m.label}</Text>
                  <Text className="text-sm font-semibold text-[#1D4ED8]">{formatCurrency(m.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
