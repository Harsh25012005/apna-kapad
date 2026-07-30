import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './ui';
import { haptics } from '../lib/haptics';
import { useTabBarHighlight } from '../context/TabBarHighlightContext';
import type { MainTabParamList } from '../navigation/types';

type Step = {
  tab: keyof MainTabParamList;
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  key: 'dashboard' | 'customers' | 'orders' | 'settings';
};

const STEPS: Step[] = [
  { tab: 'DashboardTab', icon: 'home', key: 'dashboard' },
  { tab: 'CustomersTab', icon: 'users', key: 'customers' },
  { tab: 'OrdersTab', icon: 'tshirt', key: 'orders' },
  { tab: 'SettingsTab', icon: 'file-invoice-dollar', key: 'settings' },
];

export type AppGuideProps = {
  visible: boolean;
  onDone: () => void;
};

/**
 * A coachmark-style tour: rather than showing illustrative slides in their
 * own screen, it dims the real app and points a tooltip at the actual
 * bottom-tab-bar icon for each section (see TabBarHighlightContext).
 */
export function AppGuide({ visible, onDone }: AppGuideProps) {
  const { t } = useTranslation('settings');
  const [index, setIndex] = useState(0);
  const { setHighlightedTab, tabBarHeight } = useTabBarHighlight();
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  useEffect(() => {
    if (!visible) {
      setHighlightedTab(null);
      return;
    }
    setHighlightedTab(step.tab);
    return () => setHighlightedTab(null);
  }, [visible, step.tab, setHighlightedTab]);

  const handleNext = () => {
    haptics.tap();
    if (isLast) {
      handleFinish();
      return;
    }
    setIndex((i) => i + 1);
  };

  const handleFinish = () => {
    haptics.success();
    setIndex(0);
    onDone();
  };

  const barSpace = tabBarHeight || 70;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1">
        {/* Scrim covers only the content area, leaving the real (highlighted)
            tab bar visible and untouched below it. */}
        <Pressable
          onPress={handleNext}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: barSpace }}
          className="bg-gray-900/70"
        />

        <View className="flex-1 justify-end" pointerEvents="box-none">
          <View
            style={{ marginBottom: barSpace + 14 }}
            className="mx-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-lg"
          >
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50">
                  <FontAwesome5 name={step.icon} size={18} color="#2563EB" />
                </View>
                <Text className="font-sans ml-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t('appGuide.stepOf', { current: index + 1, total: STEPS.length })}
                </Text>
              </View>
              <Pressable onPress={handleFinish} hitSlop={8} className="rounded-full px-2 py-1 active:bg-gray-100">
                <Text className="text-sm font-medium text-gray-400">{t('appGuide.skip')}</Text>
              </Pressable>
            </View>

            <Text className="mb-1.5 text-lg font-bold text-gray-900">{t(`appGuide.steps.${step.key}.title`)}</Text>
            <Text className="font-sans mb-5 text-sm leading-5 text-gray-500">{t(`appGuide.steps.${step.key}.description`)}</Text>

            <View className="mb-4 flex-row justify-center gap-1.5">
              {STEPS.map((s, i) => (
                <View
                  key={s.tab}
                  className={`h-1.5 rounded-full ${
                    i === index ? 'w-5 bg-primary-600' : i < index ? 'w-1.5 bg-primary-200' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </View>

            <Button title={isLast ? t('appGuide.getStarted') : t('appGuide.next')} onPress={handleNext} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
