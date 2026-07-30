import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { Avatar, Card, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAppGuide } from '../../context/AppGuideContext';
import { haptics } from '../../lib/haptics';
import type { SettingsScreenProps } from '../../navigation/types';

export default function SettingsScreen({ navigation }: SettingsScreenProps<'SettingsHome'>) {
  const { shop, user, signOut } = useAuth();
  const { openGuide } = useAppGuide();
  const showToast = useToast();
  const insets = useSafeAreaInsets();

  const confirmSignOut = () => {
    haptics.warning();
    Alert.alert('Sign out?', 'You can sign back in anytime with your email or Google account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not sign out', 'error');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 20, gap: 16 }}
    >
      <Text className="text-2xl font-bold text-gray-900">Settings</Text>

      <Card>
        <View className="flex-row items-center">
          {shop?.logo_url ? (
            <Image source={{ uri: shop.logo_url }} className="h-14 w-14 rounded-full" />
          ) : (
            <Avatar name={shop?.shop_name} size="lg" />
          )}
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900">{shop?.shop_name}</Text>
            <Text className="text-sm text-gray-500">{shop?.owner_name}</Text>
            <Text className="text-sm text-gray-400">{user?.email}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <MenuRow
          icon="user-friends"
          label="Staff Management"
          onPress={() => navigation.navigate('Staff')}
        />
        <MenuRow icon="tshirt" label="Tailoring Enabled" value={shop?.has_tailoring ? 'Yes' : 'No'} />
        <MenuRow icon="compass" label="How to Use This App" onPress={openGuide} isLast />
      </Card>

      <Pressable
        onPress={confirmSignOut}
        className="flex-row items-center justify-center rounded-lg border border-danger py-3"
      >
        <FontAwesome5 name="sign-out-alt" size={14} color="#DC2626" />
        <Text className="ml-2 text-sm font-semibold text-danger">Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  value,
  onPress,
  isLast = false,
}: {
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const className = `flex-row items-center justify-between py-3 ${
    isLast ? '' : 'border-b border-gray-100'
  }`;

  const content: ReactNode = (
    <>
      <View className="flex-row items-center">
        <FontAwesome5 name={icon} size={14} color="#6B7280" />
        <Text className="ml-3 text-sm text-gray-800">{label}</Text>
      </View>
      {value ? (
        <Text className="text-sm text-gray-500">{value}</Text>
      ) : onPress ? (
        <FontAwesome5 name="chevron-right" size={12} color="#9CA3AF" />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={className}>
        {content}
      </Pressable>
    );
  }
  return <View className={className}>{content}</View>;
}
