import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, darkColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import type { OrderStatus, PaymentStatus } from '../../types';

export type BadgeProps =
  | { type: 'order_status'; value: OrderStatus; label?: never; bg?: never; color?: never }
  | { type: 'payment_status'; value: PaymentStatus; label?: never; bg?: never; color?: never }
  | { type?: never; value?: never; label: string; bg?: string; color?: string };

export function Badge(props: BadgeProps) {
  const { t } = useTranslation('common');
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  let text: string;
  let bgColor: string;
  let textColor: string;

  if (props.type === 'order_status') {
    text = t(`status.order.${props.value}`);
    ({ bg: bgColor, text: textColor } = (isDark ? darkColors : colors).status[props.value]);
  } else if (props.type === 'payment_status') {
    text = t(`status.payment.${props.value}`);
    ({ bg: bgColor, text: textColor } = (isDark ? darkColors : colors).payment[props.value]);
  } else {
    text = props.label;
    bgColor = props.bg ?? (isDark ? '#374151' : '#E5E7EB');
    textColor = props.color ?? (isDark ? '#E5E7EB' : '#374151');
  }

  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: bgColor }}>
      <Text className="text-xs font-semibold" style={{ color: textColor }}>
        {text}
      </Text>
    </View>
  );
}
