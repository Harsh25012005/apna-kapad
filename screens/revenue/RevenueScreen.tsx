import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Card, EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { billsRepo, paymentsRepo } from '../../lib/data/repository';
import { formatCurrency } from '../../lib/format';
import { useShop } from '../../context/AuthContext';
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

/**
 * Plain flexbox bar chart — deliberately avoids SVG/viewBox math (which kept
 * looking subtly off across devices) in favor of something that can't get
 * the geometry wrong: each bar's height is just a CSS percentage.
 */
function MonthlyBarChart({ months }: { months: MonthBucket[] }) {
  const ordered = [...months].reverse(); // oldest -> newest, left to right
  const max = Math.max(...ordered.map((m) => m.amount), 1);

  return (
    <View className="mt-3 flex-row items-end justify-between" style={{ height: 160 }}>
      {ordered.map((m, i) => {
        const isLast = i === ordered.length - 1;
        const heightPct = Math.max(4, (m.amount / max) * 100);
        return (
          <View key={m.key} className="flex-1 items-center">
            <Text
              className={`mb-1 text-[10px] font-semibold ${
                isLast ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
              }`}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatCurrency(m.amount)}
            </Text>
            <View className="w-full flex-1 justify-end px-1">
              <View
                className={`w-full rounded-t-md ${isLast ? 'bg-primary-600' : 'bg-primary-200 dark:bg-primary-900'}`}
                style={{ height: `${heightPct}%` }}
              />
            </View>
            <Text className="font-sans mt-2 text-[10px] text-gray-500 dark:text-gray-400" numberOfLines={1}>
              {m.label.split(' ')[0]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function RevenueScreen({ navigation }: SettingsScreenProps<'Revenue'>) {
  const { t } = useTranslation('revenue');
  const showToast = useToast();
  const shop = useShop();

  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // Payments and bills come from the local-first mirror (same one every
      // create/record-payment flow writes through), so this reflects the
      // real, current data instead of racing the background sync.
      const [payments, pendingByCustomer, workRes] = await Promise.all([
        paymentsRepo.listForShop(shop.id),
        billsRepo.pendingBalanceByCustomer(shop.id),
        supabase.from('staff_work_entries').select('quantity, rate_applied'),
      ]);

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

      // Always the last 6 calendar months, in order, even ones with zero
      // payments — filling gaps with 0 (instead of only listing months that
      // happened to have a payment) keeps bar spacing an honest timeline.
      const months: MonthBucket[] = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { key, label: monthLabel(key), amount: byMonth.get(key) ?? 0 };
      });

      const outstanding = Object.values(pendingByCustomer).reduce((s, v) => s + v, 0);

      const staffCost = (workRes.data ?? []).reduce(
        (s, w) => s + Number(w.quantity ?? 0) * Number(w.rate_applied ?? 0),
        0
      );

      setData({ total, thisMonth, today, months, outstanding, staffCost });
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('loadError'), 'error');
    }
  }, [showToast, t, shop.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  if (loading || !data) return <LoadingSpinner fullScreen text={t('loading')} />;

  const net = data.total - data.staffCost;

  if (data.total === 0) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-950">
        <Header title={t('title')} onBack={() => navigation.goBack()} />
        <EmptyState icon="chart-bar" title={t('emptyTitle')} description={t('emptyDescription')} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Header title={t('title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 180, gap: 16 }}>
        {/* Total revenue hero */}
        <View className="rounded-md bg-[#101828] p-4 dark:border dark:border-gray-700">
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
          <Text className="font-sans mt-2 text-xs text-[#667085] dark:text-gray-400">{t('revenueNote')}</Text>
        </View>

        {/* This month / today / net */}
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <Text className="font-sans text-xs font-medium text-gray-500 dark:text-gray-400">{t('thisMonth')}</Text>
            <Text className="mt-1 text-base font-bold text-[#101828] dark:text-gray-50">{formatCurrency(data.thisMonth)}</Text>
          </View>
          <View className="flex-1 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <Text className="font-sans text-xs font-medium text-gray-500 dark:text-gray-400">{t('today')}</Text>
            <Text className="mt-1 text-base font-bold text-[#101828] dark:text-gray-50">{formatCurrency(data.today)}</Text>
          </View>
          <View className="flex-1 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <Text className="font-sans text-xs font-medium text-gray-500 dark:text-gray-400">{t('net')}</Text>
            <Text className="mt-1 text-base font-bold text-[#101828] dark:text-gray-50">{formatCurrency(net)}</Text>
          </View>
        </View>

        {/* Monthly trend chart */}
        <Card>
          <View className="mb-1 flex-row items-center">
            <FontAwesome5 name="chart-bar" size={13} color="#6B7280" />
            <Text className="ml-2 text-base font-semibold text-[#101828] dark:text-gray-50">{t('byMonth')}</Text>
          </View>
          <MonthlyBarChart months={data.months} />
        </Card>

        {/* Net summary */}
        <Card>
          <Text className="mb-3 text-base font-semibold text-[#101828] dark:text-gray-50">{t('summary')}</Text>
          <View className="gap-2">
            <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800">
              <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('received')}</Text>
              <Text className="text-base font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(data.total)}</Text>
            </View>
            <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800">
              <Text className="font-sans text-sm text-gray-600 dark:text-gray-300">{t('staffCost')}</Text>
              <Text className="text-base font-bold text-danger">- {formatCurrency(data.staffCost)}</Text>
            </View>
            <View className="flex-row items-center justify-between rounded-md bg-gray-100 p-3 dark:bg-gray-800">
              <Text className="font-sans text-sm font-medium text-[#101828] dark:text-gray-50">{t('net')}</Text>
              <Text className="text-base font-bold text-[#101828] dark:text-gray-50">{formatCurrency(net)}</Text>
            </View>
            <View className="flex-row items-center justify-between rounded-md bg-amber-50 p-3 dark:bg-amber-950">
              <Text className="font-sans text-sm text-amber-800 dark:text-amber-300">{t('outstanding')}</Text>
              <Text className="text-base font-bold text-amber-800 dark:text-amber-300">{formatCurrency(data.outstanding)}</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
