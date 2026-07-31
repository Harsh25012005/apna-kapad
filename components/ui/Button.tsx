import { Pressable, Text, ActivityIndicator } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'google';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_STYLES: Record<ButtonVariant, { container: string; text: string; spinner: string }> = {
  primary: {
    container: 'bg-primary-600 active:bg-primary-700',
    text: 'text-white',
    spinner: '#FFFFFF',
  },
  secondary: {
    container: 'border border-primary-200 bg-primary-50 active:bg-primary-100 dark:border-primary-800 dark:bg-primary-950 dark:active:bg-primary-900',
    text: 'text-primary-700 dark:text-primary-300',
    spinner: '#1D4ED8',
  },
  outline: {
    container: 'bg-white border border-primary-600 active:bg-primary-50 dark:bg-transparent dark:active:bg-primary-950',
    text: 'text-primary-600 dark:text-primary-400',
    spinner: '#2563EB',
  },
  danger: {
    container: 'bg-danger active:bg-red-700',
    text: 'text-white',
    spinner: '#FFFFFF',
  },
  google: {
    container: 'bg-[#E6E6E6] active:bg-[#D6D6D6] border-0 dark:bg-[#3C4043] dark:active:bg-[#484A4D]',
    text: 'text-gray-900 dark:text-white',
    spinner: '#1F2937',
  },
};

/** Spinner colors that need to flip with the scheme — the rest read fine on both. */
const DARK_SPINNER_OVERRIDES: Partial<Record<ButtonVariant, string>> = {
  google: '#FFFFFF',
  outline: '#60A5FA',
};

const SIZE_STYLES: Record<ButtonSize, { container: string; text: string }> = {
  sm: { container: 'h-10 px-4', text: 'text-sm' },
  md: { container: 'h-[52px] px-5', text: 'text-base' },
  lg: { container: 'h-14 px-6', text: 'text-lg' },
};

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  className?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  className = '',
}: ButtonProps) {
  const { scheme } = useTheme();
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];
  const isDisabled = disabled || loading;
  const spinnerColor = (scheme === 'dark' && DARK_SPINNER_OVERRIDES[variant]) || variantStyle.spinner;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({
        transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
      })}
      className={`flex-row items-center justify-center rounded-md ${sizeStyle.container} ${
        variantStyle.container
      } ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {icon}
          <Text
            className={`font-semibold tracking-[0.2px] ${sizeStyle.text} ${variantStyle.text} ${icon ? 'ml-2' : ''}`}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
