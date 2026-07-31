import { Pressable, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  onFilterPress?: () => void;
  hasActiveFilter?: boolean;
};

/**
 * Reusable search input component.
 * Standardized across all list screens with left padding (no icon)
 * and an optional side-by-side filter button trigger.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder,
  className = '',
  onFilterPress,
  hasActiveFilter = false,
}: SearchBarProps) {
  const { colors } = useTheme();
  return (
    <View className={`flex-row items-center gap-2 ${className}`}>
      <View className="h-[46px] flex-1 flex-row items-center rounded-md border border-gray-200 bg-gray-50 px-4 dark:border-gray-700 dark:bg-gray-800">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          className="font-sans flex-1 text-[15px] text-gray-900 py-0 dark:text-gray-50"
        />
        {value.length > 0 ? (
          <Pressable onPress={() => onChangeText('')} hitSlop={8}>
            <FontAwesome5 name="times-circle" size={15} color={colors.iconMuted} solid />
          </Pressable>
        ) : null}
      </View>

      {onFilterPress ? (
        <Pressable
          onPress={onFilterPress}
          className={`h-[46px] w-[46px] items-center justify-center rounded-md border ${
            hasActiveFilter
              ? 'border-primary-600 bg-primary-600'
              : 'border-gray-200 bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:active:bg-gray-700'
          }`}
        >
          <FontAwesome5
            name="sliders-h"
            size={15}
            color={hasActiveFilter ? '#FFFFFF' : colors.iconMuted}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
