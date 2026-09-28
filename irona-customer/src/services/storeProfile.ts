import type { StoreProfile } from '@/types/storeProfile';
import { mockDelay } from './mockDelay';

const ADDRESS =
  'Jl. Rambipuji No.99, Kebonsari, Balung Lor, Kec. Balung, Kabupaten Jember, Jawa Timur 68161';

// TODO(backend): belum ada tabelnya. Handle IG/TikTok & nomor WA masih tebakan/dummy — verifikasi.
const MOCK_STORE_PROFILE: StoreProfile = {
  address: ADDRESS,
  mapsEmbedUrl: null,
  mapsLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`,
  instagramUrl: 'https://www.instagram.com/tokokopiirona',
  tiktokUrl: 'https://www.tiktok.com/@tokokopiirona',
  whatsappNumber: '6280000000000',
};

export async function fetchStoreProfile(): Promise<StoreProfile> {
  return mockDelay(MOCK_STORE_PROFILE);
}
