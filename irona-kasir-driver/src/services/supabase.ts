import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// Diisi dari Doppler saat menjalankan: doppler run -- npx expo start
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY kosong. Jalankan aplikasi lewat "doppler run -- npx expo start".'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // sesi login disimpan di HP, jadi Owner cukup login sekali
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // khusus web, tidak dipakai di aplikasi
  },
});

// Perpanjang token otomatis hanya saat aplikasi sedang dibuka (hemat baterai)
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});