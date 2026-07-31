import { supabase } from './supabase';

/**
 * Invokes the send-push Edge Function. Best-effort — a failed push should
 * never block the order/payment action that triggered it.
 */
export async function sendPushNotification(input: {
  shopId: string;
  type: 'order_ready' | 'payment_due';
  customerId?: string | null;
  title: string;
  body: string;
}): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        shop_id: input.shopId,
        type: input.type,
        customer_id: input.customerId ?? null,
        title: input.title,
        body: input.body,
      },
    });
  } catch (err) {
    console.warn('[notify] push send failed:', err);
  }
}
