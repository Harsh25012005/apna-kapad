import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SearchBar, type SearchBarProps } from './SearchBar';
import { useTheme } from '../../context/ThemeContext';

export type HeaderProps = {
  title: string;
  showBack?: boolean;
  backText?: string;
  right?: ReactNode;
  onBack?: () => void;
  searchProps?: SearchBarProps;
  subtitle?: string;
};

export function Header({
  title,
  showBack = true,
  backText,
  right,
  onBack,
  searchProps,
  subtitle,
}: HeaderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const resolvedBackText = backText ?? t('actions.back');

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="border-b border-gray-200 bg-white px-5 pb-3 dark:border-gray-800 dark:bg-gray-950"
    >
      {/* Top row with Title or Back Button */}
      <View className="flex-row items-center justify-between min-h-[40px] mb-1">
        {showBack ? (
          <Pressable
            onPress={onBack ?? (() => navigation.goBack())}
            hitSlop={8}
            className="-ml-2 flex-row items-center gap-1 rounded-lg px-2 py-1 active:bg-gray-100 dark:active:bg-gray-800"
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            <Text className="font-sans text-[15px] font-medium text-[#101828] dark:text-gray-50">
              {resolvedBackText}
            </Text>
          </Pressable>
        ) : null}

        <View className={`flex-1 ${showBack ? 'px-2' : ''}`}>
          <Text
            className={`font-semibold text-[#101828] dark:text-gray-50 ${
              showBack ? 'text-center text-[18px]' : 'text-[22px] font-bold'
            }`}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">{subtitle}</Text>
          ) : null}
        </View>

        {right ? (
          <View className="items-end">{right}</View>
        ) : showBack ? (
          <View className="w-14" />
        ) : null}
      </View>

      {/* Second row with Search & Filter side-by-side if provided */}
      {searchProps ? (
        <View className="mt-2">
          <SearchBar {...searchProps} />
        </View>
      ) : null}
    </View>
  );
}

