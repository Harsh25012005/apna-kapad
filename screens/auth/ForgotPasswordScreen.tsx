import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Header, InputField, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { AuthScreenProps } from '../../navigation/types';

export default function ForgotPasswordScreen({ navigation }: AuthScreenProps<'ForgotPassword'>) {
  const { resetPassword } = useAuth();
  const showToast = useToast();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send reset email', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <Header title="Reset Password" onBack={() => navigation.goBack()} />
      <View className="flex-1 px-6 py-8">
        {sent ? (
          <Text className="font-sans text-base text-gray-700">
            If an account exists for {email}, a password reset link has been sent.
          </Text>
        ) : (
          <>
            <Text className="font-sans mb-6 text-sm text-gray-500">
              Enter the email linked to your account and we&apos;ll send you a reset link.
            </Text>
            <InputField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={error}
            />
            <Button title="Send Reset Link" onPress={handleReset} loading={loading} />
          </>
        )}
      </View>
    </View>
  );
}
