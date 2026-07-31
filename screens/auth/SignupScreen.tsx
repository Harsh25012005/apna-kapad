import { useState } from 'react';
import { Text, View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, GoogleIcon, InputField, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { AuthScreenProps } from '../../navigation/types';

type SignupErrors = { email?: string; password?: string; confirmPassword?: string };

export default function SignupScreen({ navigation }: AuthScreenProps<'Signup'>) {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const { t } = useTranslation('auth');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const validate = () => {
    const next: SignupErrors = {};
    if (!email.trim()) next.email = t('signup.errorEmailRequired');
    if (!password) next.password = t('signup.errorPasswordRequired');
    else if (password.length < 6) next.password = t('signup.errorPasswordLength');
    if (confirmPassword !== password) next.confirmPassword = t('signup.errorPasswordMismatch');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { alreadyRegistered } = await signUpWithEmail(email.trim(), password);
      if (alreadyRegistered) {
        setErrors({ email: t('signup.errorAlreadyRegistered') });
        showToast(t('signup.errorAlreadyRegistered'), 'error');
        return;
      }
      navigation.navigate('ConfirmEmail', { email: email.trim() });
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('signup.errorSignUp'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('signup.errorGoogle'), 'error');
    } finally {
      setGoogleLoading(false);
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
            <FontAwesome5 name="tshirt" size={22} color="#1D4ED8" />
          </View>
          <Text className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{t('signup.title')}</Text>
          <Text className="font-sans mb-8 text-base text-gray-500 dark:text-gray-400">{t('signup.subtitle')}</Text>

          <InputField
            label={t('signup.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('signup.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <InputField
            label={t('signup.password')}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.password}
          />

          <InputField
            label={t('signup.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.confirmPassword}
          />

          <Button title={t('signup.signUp')} onPress={handleSignup} loading={loading} />

          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            <Text className="font-sans mx-3 text-xs text-gray-400 dark:text-gray-500">{t('signup.or')}</Text>
            <View className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
          </View>

          <Button
            title={t('signup.continueWithGoogle')}
            variant="google"
            onPress={handleGoogle}
            loading={googleLoading}
            icon={<GoogleIcon size={20} />}
          />

          <View className="mt-8 flex-row items-center justify-center gap-1">
            <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{t('signup.haveAccount')}</Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text className="text-sm font-semibold text-primary-600">{t('signup.signIn')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
