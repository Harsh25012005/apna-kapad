import { Pressable, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export type FilterNoticeProps = {
  /** Hidden entirely when no filter is active. */
  visible: boolean;
  /** Plain-language summary of what's currently filtered, e.g. "Urgent only". */
  label: string;
  onClear: () => void;
};

/**
 * Banner shown whenever a list is filtered. Without it a filtered list is
 * indistinguishable from an empty one — a shop owner who left a filter on
 * days ago just sees "missing" orders and assumes data was lost.
 */
export function FilterNotice({ visible, label, onClear }: FilterNoticeProps) {
  const { t } = useTranslation('common');
  if (!visible) return null;

  return (
    <View className="mb-2 flex-row items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
      <FontAwesome5 name="filter" size={14} color="#B45309" />
      <Text className="flex-1 text-base font-medium text-amber-800 dark:text-amber-300" numberOfLines={2}>
        {label}
      </Text>
      <Pressable
        onPress={onClear}
        hitSlop={10}
        className="min-h-[40px] items-center justify-center rounded-md bg-amber-100 px-3 dark:bg-amber-900"
      >
        <Text className="text-base font-semibold text-amber-900 dark:text-amber-200">{t('filters.clear')}</Text>
      </Pressable>
    </View>
  );
}
