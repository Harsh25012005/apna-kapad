import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppGuideProvider } from '../context/AppGuideContext';
import { TabBarHighlightProvider } from '../context/TabBarHighlightContext';
import { CustomTabBar } from './CustomTabBar';
import { DashboardNavigator } from './DashboardNavigator';
import { CustomersNavigator } from './CustomersNavigator';
import { OrdersNavigator } from './OrdersNavigator';
import { BillingNavigator } from './BillingNavigator';
import { SettingsNavigator } from './SettingsNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  return (
    <TabBarHighlightProvider>
      <AppGuideProvider>
        <Tab.Navigator
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="DashboardTab" component={DashboardNavigator} />
          <Tab.Screen name="CustomersTab" component={CustomersNavigator} />
          <Tab.Screen name="OrdersTab" component={OrdersNavigator} />
          <Tab.Screen name="BillingTab" component={BillingNavigator} />
          <Tab.Screen name="SettingsTab" component={SettingsNavigator} />
        </Tab.Navigator>
      </AppGuideProvider>
    </TabBarHighlightProvider>
  );
}
