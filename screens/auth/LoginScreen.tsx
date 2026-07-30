import { useState } from 'react';
import { Text, View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, GoogleIcon, InputField, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { AuthScreenProps } from '../../navigation/types';

export default function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const showToast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Email is required';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not sign in', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google sign-in failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-10">
          <Text className="mb-1 text-2xl font-bold text-gray-900">Apna Kapad</Text>
          <Text className="font-sans mb-8 text-base text-gray-500">Sign in to manage your shop</Text>

          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <InputField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.password}
          />

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            className="mb-6 self-end"
          >
            <Text className="text-sm font-medium text-primary-600">Forgot Password?</Text>
          </Pressable>

          <Button title="Sign In" onPress={handleLogin} loading={loading} />

          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-gray-200" />
            <Text className="font-sans mx-3 text-xs text-gray-400">OR</Text>
            <View className="h-px flex-1 bg-gray-200" />
          </View>

          <Button
            title="Continue with Google"
            variant="google"
            onPress={handleGoogle}
            loading={googleLoading}
            icon={<GoogleIcon size={20} />}
          />

          <View className="mt-8 flex-row justify-center">
            <Text className="font-sans text-sm text-gray-500">Don&apos;t have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Signup')}>
              <Text className="text-sm font-semibold text-primary-600">Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
