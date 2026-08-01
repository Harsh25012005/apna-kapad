import { Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, darkColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import type { OrderStatus } from '../../types';

export type OrderProgressStepperProps = {
  status: OrderStatus;
  /** Compact renders dots only (for list rows); full adds the current step's label underneath. */
  variant?: 'compact' | 'full';
};

const STEPS: OrderStatus[] = ['order_taken', 'cutting', 'stitching', 'ready', 'delivered'];

/**
 * A visual "where is this order right now" indicator — meant to be readable
 * in about a second, without reading the status word. Complements (doesn't
 * replace) the text Badge, which still carries the precise status for
 * screen readers and anyone who wants the word.
 */
export function OrderProgressStepper({ status, variant = 'compact' }: OrderProgressStepperProps) {
  const { t } = useTranslation('common');
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const activeIndex = STEPS.indexOf(status);
  const activeColor = (isDark ? darkColors : colors).status[status].text;
  const trackColor = isDark ? '#374151' : '#E5E7EB';

  return (
    <View>
      <View className="flex-row items-center">
        {STEPS.map((step, i) => {
          const done = i < activeIndex;
          const current = i === activeIndex;
          const dotColor = done || current ? activeColor : trackColor;
          return (
            <View key={step} className="flex-1 flex-row items-center">
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: current ? 16 : 10,
                  height: current ? 16 : 10,
                  backgroundColor: dotColor,
                }}
              >
                {done ? <FontAwesome5 name="check" size={7} color="#FFFFFF" /> : null}
              </View>
              {i < STEPS.length - 1 ? (
                <View className="h-[3px] flex-1" style={{ backgroundColor: done ? activeColor : trackColor }} />
              ) : null}
            </View>
          );
        })}
      </View>
      {variant === 'full' ? (
        <Text className="mt-2 text-base font-semibold" style={{ color: activeColor }}>
          {t(`status.order.${status}`)}
        </Text>
      ) : null}
    </View>
  );
}
