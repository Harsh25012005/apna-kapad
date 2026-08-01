import { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Calendar, type DateData } from 'react-native-calendars';
import { Card, EmptyState, Header, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { ordersRepo } from '../../lib/data/repository';
import { useShop } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { DashboardScreenProps } from '../../navigation/types';

type AgendaItem = { id: string; kind: 'delivery' | 'trial' | 'leave'; title: string; subtitle?: string };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Unified view of delivery dates, trial dates, and staff leave days for the shop. */
export default function CalendarScreen({ navigation }: DashboardScreenProps<'Calendar'>) {
  const shop = useShop();
  const showToast = useToast();
  const { t } = useTranslation('dashboard');
  const { colors, scheme } = useTheme();

  const calendarTheme = useMemo(
    () => ({
      backgroundColor: colors.bgPage,
      calendarBackground: colors.bgPage,
      textSectionTitleColor: colors.textMuted,
      dayTextColor: colors.textPrimary,
      todayTextColor: colors.primary,
      monthTextColor: colors.textPrimary,
      textDisabledColor: colors.textFaint,
      arrowColor: colors.primary,
      selectedDayBackgroundColor: colors.primary,
      selectedDayTextColor: '#FFFFFF',
      indicatorColor: colors.primary,
      textDayFontFamily: undefined,
      textMonthFontFamily: undefined,
      textDayHeaderFontFamily: undefined,
    }),
    [colors, scheme]
  );

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [byDate, setByDate] = useState<Record<string, AgendaItem[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orders, { data: leave, error: leaveError }] = await Promise.all([
        ordersRepo.list(shop.id),
        supabase.from('staff_leave').select('id, leave_date, reason, staff(name)').eq('shop_id', shop.id),
      ]);
      if (leaveError) throw leaveError;

      const map: Record<string, AgendaItem[]> = {};
      const push = (date: string | null | undefined, item: AgendaItem) => {
        if (!date) return;
        (map[date] ??= []).push(item);
      };

      for (const o of orders) {
        push(o.delivery_date, {
          id: `${o.id}-delivery`,
          kind: 'delivery',
          title: t('calendar.deliveryLabel', { number: o.order_number }),
        });
        push(o.trial_date, {
          id: `${o.id}-trial`,
          kind: 'trial',
          title: t('calendar.trialLabel', { number: o.order_number }),
        });
      }
      for (const l of leave ?? []) {
        push(l.leave_date, {
          id: `leave-${l.id}`,
          kind: 'leave',
          title: t('calendar.leaveLabel', { name: (l.staff as { name: string } | null)?.name ?? '' }),
          subtitle: l.reason ?? undefined,
        });
      }
      setByDate(map);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('calendar.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [shop.id, showToast, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const markedDates = useMemo(() => {
    const dotColors: Record<AgendaItem['kind'], string> = {
      delivery: '#1D4ED8',
      trial: '#D97706',
      leave: '#DC2626',
    };
    const marks: Record<string, any> = {};
    for (const [date, items] of Object.entries(byDate)) {
      marks[date] = {
        dots: Array.from(new Set(items.map((i) => i.kind))).map((kind) => ({ color: dotColors[kind] })),
      };
    }
    marks[selectedDate] = { ...(marks[selectedDate] ?? {}), selected: true, selectedColor: '#1D4ED8' };
    return marks;
  }, [byDate, selectedDate]);

  const dayItems = byDate[selectedDate] ?? [];

  if (loading) return <LoadingSpinner fullScreen text={t('calendar.loading')} />;

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <Header title={t('calendar.title')} onBack={() => navigation.goBack()} />
      <Calendar
        key={scheme}
        style={{ backgroundColor: colors.bgPage }}
        theme={calendarTheme}
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={(d: DateData) => setSelectedDate(d.dateString)}
      />
      <FlatList
        data={dayItems}
        keyExtractor={(item) => item.id}
        className="px-5"
        contentContainerStyle={dayItems.length === 0 ? { flexGrow: 1, paddingTop: 12 } : { paddingTop: 12, paddingBottom: 160, gap: 8 }}
        ListEmptyComponent={<EmptyState icon="calendar-alt" title={t('calendar.emptyTitle')} description={t('calendar.emptyDescription')} />}
        renderItem={({ item }) => (
          <Card>
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">{item.title}</Text>
            {item.subtitle ? <Text className="font-sans mt-1 text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</Text> : null}
          </Card>
        )}
      />
    </View>
  );
}
