import { useState } from 'react';
import { Text, View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, GoogleIcon, InputField, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { AuthScreenProps } from '../../navigation/types';

export default function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const { t } = useTranslation('auth');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = t('login.errorEmailRequired');
    if (!password) next.password = t('login.errorPasswordRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      // Supabase refuses the sign-in until the address is verified — send the
      // user to the confirmation screen instead of a dead-end error toast.
      const message = err instanceof Error ? err.message : '';
      if (/email not confirmed|not confirmed/i.test(message)) {
        navigation.navigate('ConfirmEmail', { email: email.trim() });
        return;
      }

      // Supabase returns the same "invalid credentials" for a wrong password
      // and for an address that was never registered — it won't reveal which,
      // by design. So the message has to cover both and point at sign-up.
      if (/invalid login credentials|invalid_credentials/i.test(message)) {
        setErrors({ password: t('login.errorNoAccountOrPassword') });
        showToast(t('login.errorNoAccountOrPassword'), 'error');
        return;
      }

      showToast(message || t('login.errorSignIn'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('login.errorGoogle'), 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-gray-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-10">
          <View className="mb-6 h-14 w-14 items-center justify-center rounded-md bg-primary-50 dark:bg-primary-950">
            <FontAwesome5 name="tshirt" size={22} color="#1D4ED8" />
          </View>
          <Text className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{t('login.appName')}</Text>
          <Text className="font-sans mb-8 text-base text-gray-500 dark:text-gray-400">{t('login.subtitle')}</Text>

          <InputField
            label={t('login.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('login.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <InputField
            label={t('login.password')}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.password}
          />

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            hitSlop={10}
            className="mb-6 min-h-[44px] items-end justify-center self-end"
          >
            <Text className="text-base font-medium text-primary-600">{t('login.forgotPassword')}</Text>
          </Pressable>

          <Button title={t('login.signIn')} size="lg" onPress={handleLogin} loading={loading} />

          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            <Text className="font-sans mx-3 text-base text-gray-400 dark:text-gray-500">{t('login.or')}</Text>
            <View className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
          </View>

          <Button
            title={t('login.continueWithGoogle')}
            variant="google"
            size="lg"
            onPress={handleGoogle}
            loading={googleLoading}
            icon={<GoogleIcon size={20} />}
          />

          <View className="mt-8 flex-row items-center justify-center gap-1">
            <Text className="font-sans text-base text-gray-500 dark:text-gray-400">{t('login.noAccount')}</Text>
            <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={10} className="min-h-[44px] justify-center">
              <Text className="text-base font-semibold text-primary-600">{t('login.signUp')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
