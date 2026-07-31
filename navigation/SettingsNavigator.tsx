import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ShopEditScreen from '../screens/settings/ShopEditScreen';
import StaffListScreen from '../screens/staff/StaffListScreen';
import StaffFormScreen from '../screens/staff/StaffFormScreen';
import StaffDetailScreen from '../screens/staff/StaffDetailScreen';
import StaffWorkEntryFormScreen from '../screens/staff/StaffWorkEntryFormScreen';
import RevenueScreen from '../screens/revenue/RevenueScreen';
import { BillingNavigator } from './BillingNavigator';
import type { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="ShopEdit" component={ShopEditScreen} />
      <Stack.Screen name="Staff" component={StaffListScreen} />
      <Stack.Screen name="StaffForm" component={StaffFormScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="StaffWorkEntryForm" component={StaffWorkEntryFormScreen} />
      <Stack.Screen name="Revenue" component={RevenueScreen} />
      {/* Billing lost its own tab when the bar moved to 4 tabs + Add, so the
          whole Billing stack is nested here instead. Nesting (rather than
          re-registering each screen) keeps the Billing screens' existing
          BillingScreenProps typing working unchanged. */}
      <Stack.Screen name="Billing" component={BillingNavigator} />
    </Stack.Navigator>
  );
}
