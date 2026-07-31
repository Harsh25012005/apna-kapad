import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/ui';
import { useTranslation } from 'react-i18next';
import { AuthNavigator } from './AuthNavigator';
import ShopSetupScreen from '../screens/onboarding/ShopSetupScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import { MainNavigator } from './MainNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, shop, loading, passwordRecovery } = useAuth();
  const { t } = useTranslation('common');

  if (loading) {
    return <LoadingSpinner fullScreen text={t('labels.loading')} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : passwordRecovery ? (
          // The recovery deep link establishes a real session before the user
          // has chosen a new password, so this must be checked ahead of the
          // shop/main routes or they'd be dropped straight into the app with
          // their old password still active.
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        ) : !shop ? (
          <Stack.Screen name="ShopSetup" component={ShopSetupScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
