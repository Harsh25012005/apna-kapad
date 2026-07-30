import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

export type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
};

/**
 * Uses React Native's built-in Animated API rather than Reanimated.
 * Reanimated worklets segfault inside Expo Go on SDK 57 (crash in
 * libworklets.so), and this animation is simple enough not to need them.
 */
export function Toggle({ value, onChange, label, disabled = false }: ToggleProps) {
  const position = useRef(new Animated.Value(value ? 20 : 2)).current;

  useEffect(() => {
    Animated.timing(position, {
      toValue: value ? 20 : 2,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [value, position]);

  return (
    <View className="flex-row items-center justify-between">
      {label ? <Text className="font-sans text-base text-gray-800">{label}</Text> : null}
      <Pressable
        onPress={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`h-7 w-12 justify-center rounded-full ${
          value ? 'bg-primary-600' : 'bg-gray-300'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <Animated.View
          className="h-5 w-5 rounded-full bg-white"
          style={{ transform: [{ translateX: position }] }}
        />
      </Pressable>
    </View>
  );
}
