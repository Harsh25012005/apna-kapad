import type { OrderStatus, PaymentStatus } from '../types';

type BadgeColor = { bg: string; text: string };

export const colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#0891B2',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',

  status: {
    order_taken: { bg: '#EDE9FE', text: '#6D28D9' },
    cutting: { bg: '#FEF3C7', text: '#B45309' },
    stitching: { bg: '#DBEAFE', text: '#1D4ED8' },
    ready: { bg: '#D1FAE5', text: '#047857' },
    delivered: { bg: '#E5E7EB', text: '#374151' },
  } satisfies Record<OrderStatus, BadgeColor>,

  payment: {
    paid: { bg: '#D1FAE5', text: '#047857' },
    partial: { bg: '#FEF3C7', text: '#B45309' },
    unpaid: { bg: '#FEE2E2', text: '#B91C1C' },
  } satisfies Record<PaymentStatus, BadgeColor>,
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;
