import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CustomTabBar } from './CustomTabBar';
import { DashboardNavigator } from './DashboardNavigator';
import { CustomersNavigator } from './CustomersNavigator';
import { OrdersNavigator } from './OrdersNavigator';
import { SettingsNavigator } from './SettingsNavigator';
import { ProductTourWelcome } from '../components/ProductTourWelcome';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="DashboardTab" component={DashboardNavigator} />
        <Tab.Screen name="CustomersTab" component={CustomersNavigator} />
        <Tab.Screen name="OrdersTab" component={OrdersNavigator} />
        <Tab.Screen name="SettingsTab" component={SettingsNavigator} />
      </Tab.Navigator>
      <ProductTourWelcome />
    </>
  );
}
