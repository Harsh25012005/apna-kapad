import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTabBarHighlight } from '../context/TabBarHighlightContext';
import { haptics } from '../lib/haptics';
import type { MainTabParamList } from './types';

const ICONS: Record<keyof MainTabParamList, React.ComponentProps<typeof FontAwesome5>['name']> = {
  DashboardTab: 'home',
  CustomersTab: 'users',
  OrdersTab: 'tshirt',
  BillingTab: 'file-invoice-dollar',
  SettingsTab: 'cog',
};

const LABELS: Record<keyof MainTabParamList, string> = {
  DashboardTab: 'Home',
  CustomersTab: 'Customers',
  OrdersTab: 'Orders',
  BillingTab: 'Billing',
  SettingsTab: 'Settings',
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { highlightedTab, setTabBarHeight } = useTabBarHighlight();

  return (
    <View
      onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}
      style={{ paddingBottom: insets.bottom || 10 }}
      className="flex-row border-t border-gray-200 bg-white px-2 pt-2.5"
    >
      {state.routes.map((route, index) => {
        const key = route.name as keyof MainTabParamList;
        const isFocused = state.index === index;
        const isHighlighted = highlightedTab === key;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            haptics.tap();
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            className="flex-1 items-center justify-center py-1"
          >
            <View
              className={`h-9 w-9 items-center justify-center rounded-full border-2 ${
                isFocused
                  ? 'border-primary-600'
                  : isHighlighted
                    ? 'border-primary-300'
                    : 'border-transparent'
              }`}
            >
              <FontAwesome5
                name={ICONS[key]}
                size={15}
                color={isFocused ? '#2563EB' : isHighlighted ? '#60A5FA' : '#9CA3AF'}
              />
            </View>
            <Text
              className={`mt-1 text-[11px] ${
                isFocused ? 'font-bold text-primary-600' : 'font-medium text-gray-400'
              }`}
            >
              {LABELS[key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
