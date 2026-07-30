import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type HeaderProps = {
  title: string;
  showBack?: boolean;
  right?: ReactNode;
  onBack?: () => void;
};

export function Header({ title, showBack = true, right, onBack }: HeaderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="flex-row items-center justify-between border-b border-gray-200 bg-white px-3 pb-3"
    >
      <View className="w-10">
        {showBack ? (
          <Pressable
            onPress={onBack ?? (() => navigation.goBack())}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full border border-gray-200 active:bg-gray-50"
          >
            <FontAwesome5 name="arrow-left" size={15} color="#111827" />
          </Pressable>
        ) : null}
      </View>

      <Text className="flex-1 text-center text-lg font-bold text-gray-900" numberOfLines={1}>
        {title}
      </Text>

      <View className="w-10 items-end">{right}</View>
    </View>
  );
}
