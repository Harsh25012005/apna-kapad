import { useState } from 'react';
import { Text, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, InputField, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

type ResetPasswordErrors = { password?: string; confirmPassword?: string };

export default function ResetPasswordScreen() {
  const { completePasswordReset } = useAuth();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const { t } = useTranslation('auth');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ResetPasswordErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: ResetPasswordErrors = {};
    if (!password) next.password = t('resetPassword.errorPasswordRequired');
    else if (password.length < 6) next.password = t('resetPassword.errorPasswordLength');
    if (confirmPassword !== password) next.confirmPassword = t('resetPassword.errorPasswordMismatch');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await completePasswordReset(password);
      showToast(t('resetPassword.success'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('resetPassword.errorSave'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white dark:bg-gray-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-10">
          <View className="mb-6 h-14 w-14 items-center justify-center rounded-md bg-primary-50 dark:bg-primary-950">
            <FontAwesome5 name="key" size={20} color="#1D4ED8" />
          </View>
          <Text className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{t('resetPassword.title')}</Text>
          <Text className="font-sans mb-8 text-base text-gray-500 dark:text-gray-400">{t('resetPassword.instructions')}</Text>

          <InputField
            label={t('resetPassword.password')}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.password}
          />

          <InputField
            label={t('resetPassword.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.confirmPassword}
          />

          <Button title={t('resetPassword.save')} onPress={handleSave} loading={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
