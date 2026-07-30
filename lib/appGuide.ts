import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(shopId: string): string {
  return `apna-kapad:has-seen-guide:${shopId}`;
}

export async function hasSeenAppGuide(shopId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(storageKey(shopId));
  return value === 'true';
}

export async function markAppGuideSeen(shopId: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(shopId), 'true');
}
