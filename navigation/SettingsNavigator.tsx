import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/settings/SettingsScreen';
import StaffListScreen from '../screens/staff/StaffListScreen';
import StaffFormScreen from '../screens/staff/StaffFormScreen';
import type { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="Staff" component={StaffListScreen} />
      <Stack.Screen name="StaffForm" component={StaffFormScreen} />
    </Stack.Navigator>
  );
}
