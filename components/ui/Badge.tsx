import { View, Text } from 'react-native';
import { colors } from '../../constants/theme';
import type { OrderStatus, PaymentStatus } from '../../types';

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  order_taken: 'Order Taken',
  cutting: 'Cutting',
  stitching: 'Stitching',
  ready: 'Ready',
  delivered: 'Delivered',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
};

export type BadgeProps =
  | { type: 'order_status'; value: OrderStatus; label?: never; bg?: never; color?: never }
  | { type: 'payment_status'; value: PaymentStatus; label?: never; bg?: never; color?: never }
  | { type?: never; value?: never; label: string; bg?: string; color?: string };

export function Badge(props: BadgeProps) {
  let text: string;
  let bgColor: string;
  let textColor: string;

  if (props.type === 'order_status') {
    text = ORDER_STATUS_LABELS[props.value];
    ({ bg: bgColor, text: textColor } = colors.status[props.value]);
  } else if (props.type === 'payment_status') {
    text = PAYMENT_STATUS_LABELS[props.value];
    ({ bg: bgColor, text: textColor } = colors.payment[props.value]);
  } else {
    text = props.label;
    bgColor = props.bg ?? '#E5E7EB';
    textColor = props.color ?? '#374151';
  }

  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: bgColor }}>
      <Text className="text-xs font-semibold" style={{ color: textColor }}>
        {text}
      </Text>
    </View>
  );
}
