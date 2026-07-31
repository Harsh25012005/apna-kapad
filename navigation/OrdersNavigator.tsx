import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OrderListScreen from '../screens/orders/OrderListScreen';
import OrderFormScreen from '../screens/orders/OrderFormScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import BulkOrderFormScreen from '../screens/orders/BulkOrderFormScreen';
import BillFormScreen from '../screens/billing/BillFormScreen';
import type { OrdersStackParamList } from './types';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export function OrdersNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrderList" component={OrderListScreen} />
      <Stack.Screen name="OrderForm" component={OrderFormScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="BulkOrderForm" component={BulkOrderFormScreen} />
      <Stack.Screen name="BillForm" component={BillFormScreen} />
    </Stack.Navigator>
  );
}
