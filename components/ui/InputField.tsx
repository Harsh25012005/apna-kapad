import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

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
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);

  const borderColor = error ? 'border-danger' : isFocused ? 'border-primary-600' : 'border-gray-200';
  const bgColor = !editable ? 'bg-gray-100' : isFocused ? 'bg-white' : 'bg-gray-50';

  return (
    <View className="w-full mb-4">
      {label ? (
        <Text
          className={`mb-1.5 text-sm font-semibold ${error ? 'text-danger' : isFocused ? 'text-primary-600' : 'text-gray-500'
            }`}
        >
          {label}
        </Text>
      ) : null}

      <View
        className={`flex-row items-center rounded-md border px-4 ${borderColor} ${bgColor} ${multiline ? 'min-h-[96px] items-start py-3' : 'h-[52px]'
          }`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="font-sans flex-1 text-base text-gray-900"
        />

        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <FontAwesome5 name={hidden ? 'eye' : 'eye-slash'} size={15} color="#9CA3AF" />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text className="mt-1.5 text-xs font-medium text-danger">{error}</Text>
      ) : helperText ? (
        <Text className="font-sans mt-1.5 text-xs text-gray-500">{helperText}</Text>
      ) : null}
    </View>
  );
}
