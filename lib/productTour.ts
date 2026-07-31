import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_KEY_PREFIX = 'product_tour_seen:';

/** Scoped per-user so a second account on the same device still gets the tour. */
export async function hasSeenProductTour(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(SEEN_KEY_PREFIX + userId);
  return value === 'true';
}

export async function markProductTourSeen(userId: string): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY_PREFIX + userId, 'true');
}
