import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

function storageKey(shopId: string): string {
  return `apna-kapad:has-seen-guide:${shopId}`;
}

/**
 * Whether the owner has already been through the intro tour.
 *
 * The flag lives on the shop row so it survives a reinstall, a cleared cache
 * or signing in on a second phone — the tour is meant to run exactly once per
 * account. AsyncStorage is kept as a local mirror so a slow or failed network
 * call can't cause the tour to pop up again on a returning user.
 */
export async function hasSeenAppGuide(shopId: string): Promise<boolean> {
  try {
    const cached = await AsyncStorage.getItem(storageKey(shopId));
    if (cached === 'true') return true;
  } catch {
    // Fall through to the server check.
  }

  try {
    const { data, error } = await supabase
      .from('shops')
      .select('has_seen_guide')
      .eq('id', shopId)
      .maybeSingle();
    if (error) throw error;

    if (data?.has_seen_guide) {
      void AsyncStorage.setItem(storageKey(shopId), 'true').catch(() => undefined);
      return true;
    }
    return false;
  } catch {
    // If the lookup fails, assume seen rather than risk re-running the tour
    // on an existing user every time they open the app offline.
    return true;
  }
}

export async function markAppGuideSeen(shopId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(shopId), 'true');
  } catch {
    // Non-fatal — the server flag below is the source of truth.
  }

  try {
    await supabase.from('shops').update({ has_seen_guide: true }).eq('id', shopId);
  } catch {
    // Non-fatal — the local flag still suppresses it on this device.
  }
}
