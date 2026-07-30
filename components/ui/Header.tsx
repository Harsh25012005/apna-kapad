import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
      className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 pb-3"
    >
      <View className="w-10">
        {showBack ? (
          <Pressable
            onPress={onBack ?? (() => navigation.goBack())}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <Ionicons name="arrow-back" size={22} color="#101828" />
          </Pressable>
        ) : null}
      </View>

      <Text className="flex-1 text-center text-[18px] font-semibold text-[#101828]" numberOfLines={1}>
        {title}
      </Text>

      <View className="w-10 items-end">{right}</View>
    </View>
  );
}

