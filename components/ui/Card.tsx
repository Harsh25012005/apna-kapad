import { View, Pressable } from 'react-native';
import type { ReactNode } from 'react';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
};

export function Card({ children, onPress, className = '' }: CardProps) {
  const baseClass = `rounded-md border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
        className={`active:border-gray-300 active:bg-gray-50 dark:active:border-gray-700 dark:active:bg-gray-800 ${baseClass}`}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={baseClass}>{children}</View>;
}
