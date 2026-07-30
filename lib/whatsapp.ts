import { Linking } from 'react-native';

function normalizePhone(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function sendWhatsAppMessage(
  phone: string | null | undefined,
  message: string
): Promise<void> {
  const target = normalizePhone(phone);
  if (!target) throw new Error('Customer has no phone number on file');

  const url = `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) throw new Error('WhatsApp is not available on this device');
  await Linking.openURL(url);
}

export function buildOrderReadyMessage({
  shopName,
  customerName,
  orderNumber,
}: {
  shopName: string;
  customerName: string;
  orderNumber: string;
}): string {
  return `Hi ${customerName}, your order #${orderNumber} at ${shopName} is ready for pickup!`;
}

export function buildBillMessage({
  shopName,
  customerName,
  total,
  paid,
  pending,
}: {
  shopName: string;
  customerName: string;
  total: number;
  paid: number;
  pending: number;
}): string {
  return `Hi ${customerName}, here's your bill summary from ${shopName}:\nTotal: ₹${total}\nPaid: ₹${paid}\nPending: ₹${pending}`;
}

export function buildPaymentDueMessage({
  shopName,
  customerName,
  pending,
}: {
  shopName: string;
  customerName: string;
  pending: number;
}): string {
  return `Hi ${customerName}, a friendly reminder that ₹${pending} is pending at ${shopName}. Please clear it at your convenience. Thank you!`;
}
