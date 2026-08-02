import { Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useTheme } from '../../context/ThemeContext';

export type EmptyStateProps = {
  icon?: React.ComponentProps<typeof FontAwesome5>['name'];
  /** Defaults to a translated generic "nothing here yet" title. */
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * 'full' centers within all available space (use for a whole screen/tab).
   * 'compact' is a smaller, non-flex card for nesting inside a section on a
   * screen that already has other content (e.g. one part of a detail page).
   */
  variant?: 'full' | 'compact';
};

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  variant = 'full',
}: EmptyStateProps) {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const isCompact = variant === 'compact';

  return (
    <View
      className={
        isCompact
          ? 'items-center justify-center rounded-md border border-dashed border-gray-200 bg-white px-6 py-8 dark:border-gray-700 dark:bg-gray-900'
          : 'flex-1 items-center justify-center px-8 py-12'
      }
    >
      <View
        className={`items-center justify-center rounded-md bg-primary-50 dark:bg-primary-950 ${
          isCompact ? 'mb-3 h-12 w-12' : 'mb-4 h-16 w-16'
        }`}
      >
        <FontAwesome5 name={icon} size={isCompact ? 18 : 24} color={colors.primary} />
      </View>
      <Text
        className={`text-center font-semibold text-gray-900 dark:text-gray-50 ${
          isCompact ? 'mb-0.5 text-base' : 'mb-1 text-base'
        }`}
      >
        {title ?? t('empty.title')}
      </Text>
      {description ? (
        <Text
          className={`text-center text-gray-500 dark:text-gray-400 ${isCompact ? 'mb-3 text-base' : 'mb-5 text-base'}`}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} fullWidth={false} size="sm" />
      ) : null}
    </View>
  );
}
