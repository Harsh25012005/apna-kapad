import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button } from './ui';
import { haptics } from '../lib/haptics';
import { useTabBarHighlight } from '../context/TabBarHighlightContext';
import type { MainTabParamList } from '../navigation/types';

type Step = {
  tab: keyof MainTabParamList;
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    tab: 'DashboardTab',
    icon: 'home',
    title: 'Your Dashboard',
    description:
      "Tap here anytime to see today's orders, today's collections, pending orders, and this month's sales.",
  },
  {
    tab: 'CustomersTab',
    icon: 'users',
    title: 'Manage Customers',
    description:
      "Add customers, save their measurements, and check each customer's order history and outstanding balance.",
  },
  {
    tab: 'OrdersTab',
    icon: 'tshirt',
    title: 'Track Every Order',
    description:
      'Create an order and move it through Cutting → Stitching → Ready → Delivered right from its detail page.',
  },
  {
    tab: 'BillingTab',
    icon: 'file-invoice-dollar',
    title: 'Bill & Collect Payments',
    description:
      'Generate a bill, record partial or full payments, and share it with your customer on WhatsApp.',
  },
  {
    tab: 'SettingsTab',
    icon: 'user-friends',
    title: 'Staff & Settings',
    description: 'Add tailors and helpers, assign them to orders, and manage your shop details here.',
  },
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
            className="mx-5 rounded-3xl border border-gray-200 bg-white p-5"
          >
            <View className="mb-3 flex-row items-center justify-between">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50">
                <FontAwesome5 name={step.icon} size={18} color="#2563EB" />
              </View>
              <Pressable onPress={handleFinish} hitSlop={8}>
                <Text className="text-sm font-medium text-gray-400">Skip</Text>
              </Pressable>
            </View>

            <Text className="mb-1.5 text-lg font-bold text-gray-900">{step.title}</Text>
            <Text className="mb-5 text-sm leading-5 text-gray-500">{step.description}</Text>

            <View className="mb-4 flex-row justify-center gap-1.5">
              {STEPS.map((s, i) => (
                <View
                  key={s.tab}
                  className={`h-1.5 rounded-full ${
                    i === index ? 'w-5 bg-primary-600' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </View>

            <Button title={isLast ? 'Get Started' : 'Next'} onPress={handleNext} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
