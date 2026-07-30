import { Linking } from 'react-native';
import i18n from './i18n';

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
  if (!target) throw new Error(i18n.t('whatsapp.errorNoPhone', { ns: 'common' }));

  const text = encodeURIComponent(message);

  // Android 11+ hides other installed apps unless they're declared in the
  // manifest's <queries>, so canOpenURL answers false even when WhatsApp is
  // installed. Opening optimistically and catching the failure is the only
  // reliable check. The whatsapp:// scheme is tried first so the app opens
  // directly; wa.me is the fallback and also covers WhatsApp Business.
  const candidates = [
    `whatsapp://send?phone=${target}&text=${text}`,
    `https://wa.me/${target}?text=${text}`,
  ];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Try the next form.
    }
  }

  throw new Error(i18n.t('whatsapp.errorNotAvailable', { ns: 'common' }));
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
  return i18n.t('whatsapp.orderReady', { ns: 'common', shopName, customerName, orderNumber });
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
  return i18n.t('whatsapp.bill', { ns: 'common', shopName, customerName, total, paid, pending });
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
  return i18n.t('whatsapp.paymentDue', { ns: 'common', shopName, customerName, pending });
}
