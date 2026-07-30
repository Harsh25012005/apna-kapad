import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BillingListScreen from '../screens/billing/BillingListScreen';
import BillFormScreen from '../screens/billing/BillFormScreen';
import BillDetailScreen from '../screens/billing/BillDetailScreen';
import type { BillingStackParamList } from './types';

const Stack = createNativeStackNavigator<BillingStackParamList>();

export function BillingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BillingList" component={BillingListScreen} />
      <Stack.Screen name="BillForm" component={BillFormScreen} />
      <Stack.Screen name="BillDetail" component={BillDetailScreen} />
    </Stack.Navigator>
  );
}
