import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, LogBox } from 'react-native';

// Saat HP dibuka lagi, refresh token jalan sebelum jaringan siap. Supabase menyimpan sesi
// dan mencoba ulang otomatis, jadi peringatan ini aman disembunyikan.
LogBox.ignoreLogs(['AuthRetryableFetchError']);

// Diisi dari Doppler saat menjalankan: doppler run -- npx expo start
const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!envUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY kosong. Jalankan aplikasi lewat "doppler run -- npx expo start".'
  );
}

// Saat development dengan Supabase lokal, IP laptop sering berubah (ganti Wi-Fi / DHCP).
// Pakai IP laptop yang sama dengan server Metro, jadi IP di Doppler tidak perlu diubah-ubah.
const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
const isLocalUrl = /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.)/.test(envUrl);
const isLanIp = !!metroHost && /^\d+\.\d+\.\d+\.\d+$/.test(metroHost); // bukan mode --tunnel
const supabaseUrl =
  __DEV__ && isLanIp && isLocalUrl ? envUrl.replace(/\/\/[^:/]+/, `//${metroHost}`) : envUrl;

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