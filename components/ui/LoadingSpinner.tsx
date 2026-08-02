import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export type LoadingSpinnerProps = {
  text?: string;
  fullScreen?: boolean;
  size?: 'small' | 'large';
};

export function LoadingSpinner({ text, fullScreen = false, size = 'large' }: LoadingSpinnerProps) {
  const { colors } = useTheme();
  return (
    <View
      className={
        fullScreen
          ? 'flex-1 items-center justify-center bg-white dark:bg-gray-950'
          : 'items-center justify-center py-8'
      }
    >
      <ActivityIndicator size={size} color={colors.primary} />
      {text ? <Text className="font-sans mt-3 text-base text-gray-500 dark:text-gray-400">{text}</Text> : null}
    </View>
  );
}
