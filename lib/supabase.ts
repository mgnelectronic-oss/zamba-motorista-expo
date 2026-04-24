import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

console.log('SUPABASE URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
