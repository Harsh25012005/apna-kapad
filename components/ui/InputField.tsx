import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export type InputFieldProps = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  secureTextEntry?: boolean;
  leftIcon?: React.ComponentProps<typeof FontAwesome5>['name'];
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  multiline?: boolean;
  /** Shows a red "*" next to the label to mark the field as mandatory. */
  required?: boolean;
};

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  secureTextEntry = false,
  leftIcon,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  editable = true,
  multiline = false,
  required = false,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);
  const { colors } = useTheme();

  const borderColor = error
    ? 'border-danger'
    : isFocused
      ? 'border-primary-600'
      : 'border-gray-200 dark:border-gray-700';
  const bgColor = !editable
    ? 'bg-gray-100 dark:bg-gray-800'
    : isFocused
      ? 'bg-white dark:bg-gray-900'
      : 'bg-gray-50 dark:bg-gray-800';
  const iconColor = error ? '#DC2626' : isFocused ? '#2563EB' : colors.iconMuted;

  return (
    <View className="w-full mb-4">
      {label ? (
        <Text
          className={`mb-1.5 text-base font-semibold ${error ? 'text-danger' : isFocused ? 'text-primary-600' : 'text-gray-600 dark:text-gray-400'
            }`}
        >
          {label}
          {required ? <Text className="text-danger"> *</Text> : null}
        </Text>
      ) : null}

      <View
        className={`flex-row items-center rounded-md border px-4 ${borderColor} ${bgColor} ${multiline ? 'min-h-[96px] items-start py-3' : 'h-[52px]'
          }`}
      >
        {leftIcon ? (
          <View className={`mr-3 ${multiline ? 'pt-1' : ''}`}>
            <FontAwesome5 name={leftIcon} size={15} color={iconColor} />
          </View>
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          // Belt-and-suspenders for react-native & web to force top alignment
          style={multiline ? { textAlignVertical: 'top', verticalAlign: 'top', paddingTop: 0 } : undefined}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`font-sans flex-1 text-base text-gray-900 dark:text-gray-50 ${multiline ? 'pt-0 align-top' : ''}`}
        />

        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <FontAwesome5 name={hidden ? 'eye' : 'eye-slash'} size={15} color={colors.iconMuted} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text className="mt-1.5 text-sm font-medium text-danger">{error}</Text>
      ) : helperText ? (
        <Text className="font-sans mt-1.5 text-sm text-gray-500 dark:text-gray-400">{helperText}</Text>
      ) : null}
    </View>
  );
}
