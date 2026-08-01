import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CustomerListScreen from '../screens/customers/CustomerListScreen';
import CustomerDetailScreen from '../screens/customers/CustomerDetailScreen';
import CustomerFormScreen from '../screens/customers/CustomerFormScreen';
import MeasurementFormScreen from '../screens/customers/MeasurementFormScreen';
import OrderFormScreen from '../screens/orders/OrderFormScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import BillFormScreen from '../screens/billing/BillFormScreen';
import BillDetailScreen from '../screens/billing/BillDetailScreen';
import type { CustomersStackParamList } from './types';

const Stack = createNativeStackNavigator<CustomersStackParamList>();

export function CustomersNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerList" component={CustomerListScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      <Stack.Screen name="CustomerForm" component={CustomerFormScreen} />
      <Stack.Screen name="MeasurementForm" component={MeasurementFormScreen} />
      <Stack.Screen name="OrderForm" component={OrderFormScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="BillForm" component={BillFormScreen} />
      <Stack.Screen name="BillDetail" component={BillDetailScreen} />
    </Stack.Navigator>
  );
}
