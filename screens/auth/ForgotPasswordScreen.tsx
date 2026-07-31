import { useState } from 'react';
import { Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Header, InputField, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { AuthScreenProps } from '../../navigation/types';

export default function ForgotPasswordScreen({ navigation }: AuthScreenProps<'ForgotPassword'>) {
  const { resetPassword } = useAuth();
  const showToast = useToast();
  const { t } = useTranslation('auth');

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      setError(t('forgotPassword.errorEmailRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('forgotPassword.errorSend'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <Header title={t('forgotPassword.title')} onBack={() => navigation.goBack()} />
      <View className="flex-1 px-6 py-8">
        {sent ? (
          <View className="items-center pt-6">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
              <FontAwesome5 name="check" size={20} color="#047857" />
            </View>
            <Text className="font-sans text-center text-base text-gray-700 dark:text-gray-300">
              {t('forgotPassword.sentMessage', { email })}
            </Text>
          </View>
        ) : (
          <>
            <Text className="font-sans mb-6 text-sm text-gray-500 dark:text-gray-400">
              {t('forgotPassword.instructions')}
            </Text>
            <InputField
              label={t('forgotPassword.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('forgotPassword.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              error={error}
            />
            <Button title={t('forgotPassword.sendResetLink')} onPress={handleReset} loading={loading} />
          </>
        )}
      </View>
    </View>
  );
}
