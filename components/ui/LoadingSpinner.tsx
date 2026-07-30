import { ActivityIndicator, Text, View } from 'react-native';

export type LoadingSpinnerProps = {
  text?: string;
  fullScreen?: boolean;
  size?: 'small' | 'large';
};

export function LoadingSpinner({ text, fullScreen = false, size = 'large' }: LoadingSpinnerProps) {
  return (
    <View
      className={
        fullScreen
          ? 'flex-1 items-center justify-center bg-white'
          : 'items-center justify-center py-8'
      }
    >
      <ActivityIndicator size={size} color="#2563EB" />
      {text ? <Text className="mt-3 text-sm text-gray-500">{text}</Text> : null}
    </View>
  );
}
