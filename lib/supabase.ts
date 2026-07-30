import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

type SupabaseExtra = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

const { supabaseUrl, supabasePublishableKey } = (Constants.expoConfig?.extra ?? {}) as SupabaseExtra;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase config. Make sure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are set in .env'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
