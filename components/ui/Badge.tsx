import { View, Text } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, darkColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import type { OrderStatus, PaymentStatus } from '../../types';

export type BadgeProps =
  | { type: 'order_status'; value: OrderStatus; label?: never; bg?: never; color?: never }
  | { type: 'payment_status'; value: PaymentStatus; label?: never; bg?: never; color?: never }
  | { type?: never; value?: never; label: string; bg?: string; color?: string };

// Status must be readable by shape, not color alone — small colored text is
// hard to scan fast, and color-only differences are lost on low-vision or
// colorblind users.
type IconName = React.ComponentProps<typeof FontAwesome5>['name'];

const ORDER_STATUS_ICONS: Record<OrderStatus, IconName> = {
  order_taken: 'clipboard-list',
  cutting: 'cut',
  stitching: 'shapes',
  ready: 'box-open',
  delivered: 'check-circle',
};

const PAYMENT_STATUS_ICONS: Record<PaymentStatus, IconName> = {
  paid: 'check-circle',
  partial: 'adjust',
  unpaid: 'exclamation-circle',
};

export function Badge(props: BadgeProps) {
  const { t } = useTranslation('common');
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  let text: string;
  let bgColor: string;
  let textColor: string;
  let icon: IconName | null = null;

  if (props.type === 'order_status') {
    text = t(`status.order.${props.value}`);
    ({ bg: bgColor, text: textColor } = (isDark ? darkColors : colors).status[props.value]);
    icon = ORDER_STATUS_ICONS[props.value];
  } else if (props.type === 'payment_status') {
    text = t(`status.payment.${props.value}`);
    ({ bg: bgColor, text: textColor } = (isDark ? darkColors : colors).payment[props.value]);
    icon = PAYMENT_STATUS_ICONS[props.value];
  } else {
    text = props.label;
    bgColor = props.bg ?? (isDark ? '#374151' : '#E5E7EB');
    textColor = props.color ?? (isDark ? '#E5E7EB' : '#374151');
  }

  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5"
      style={{ backgroundColor: bgColor }}
    >
      {icon ? <FontAwesome5 name={icon} size={11} color={textColor} /> : null}
      <Text className="text-base font-semibold" style={{ color: textColor }}>
        {text}
      </Text>
    </View>
  );
}
