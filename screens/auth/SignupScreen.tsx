import { useState } from 'react';
import { Text, View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, GoogleIcon, InputField, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { AuthScreenProps } from '../../navigation/types';

type SignupErrors = { email?: string; password?: string; confirmPassword?: string };

export default function SignupScreen({ navigation }: AuthScreenProps<'Signup'>) {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const showToast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const validate = () => {
    const next: SignupErrors = {};
    if (!email.trim()) next.email = 'Email is required';
    if (!password) next.password = 'Password is required';
    else if (password.length < 6) next.password = 'At least 6 characters';
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password);
      showToast('Account created! Check your email to confirm.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not sign up', 'error');
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
          <Text className="mb-1 text-2xl font-bold text-gray-900">Create Account</Text>
          <Text className="mb-8 text-base text-gray-500">Set up your shop in a few steps</Text>

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

          <InputField
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.confirmPassword}
          />

          <Button title="Sign Up" onPress={handleSignup} loading={loading} />

          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-gray-200" />
            <Text className="mx-3 text-xs text-gray-400">OR</Text>
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
            <Text className="text-sm text-gray-500">Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text className="text-sm font-semibold text-primary-600">Sign In</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
