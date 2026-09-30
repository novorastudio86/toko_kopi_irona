import baristaPhoto from '@/assets/home/hero-barista.webp';
import interiorPhoto from '@/assets/home/hero-interior.webp';
import storePhoto from '@/assets/home/hero-store.webp';
import latteImage from '@/assets/images/730cf7c3-5ce8-4323-9d49-1d3694e6ead0.jpg';
import menuBanner from '@/assets/menu/menu-banner.webp';

// TODO(backend): ganti dengan event/promo dari Supabase. Isi & foto masih dummy (pakai foto yang ada).
export interface EventItem {
  id: string;
  kind: 'event' | 'promo';
  /** Tanggal singkat di kartu */
  date: string;
  title: string;
  description: string;
  image: string;
  status: string;
  tag?: string;
  location: string;
  quota: { left: number; total: number };
  /** Event saja */
  fullDate?: string;
  time?: string;
  price?: number;
  rundown?: { time: string; text: string }[];
  photos?: string[];
  /** Promo saja */
  period?: string;
}

export const EVENTS: EventItem[] = [
  {
    id: 'event-1',
    kind: 'event',
    date: '12 Okt 2026',
    title: 'Judul event',
    description: 'Deskripsi singkat event, detailnya menyusul.',
    image: interiorPhoto,
    status: 'Sedang berjalan',
    tag: 'Workshop',
    location: 'Toko Kopi Irona',
    quota: { left: 18, total: 30 },
    fullDate: 'Sabtu, 12 Oktober 2026',
    time: '16.00 – 21.00 WIB',
    price: 50000,
    rundown: [
      { time: '16.00', text: 'Deskripsi sesi pertama.' },
      { time: '17.00', text: 'Deskripsi sesi kedua.' },
      { time: '19.00', text: 'Deskripsi sesi penutup.' },
    ],
    photos: [baristaPhoto, storePhoto, latteImage],
  },
  {
    id: 'promo-1',
    kind: 'promo',
    date: '09 Okt 2026',
    title: 'Judul promo',
    description: 'Deskripsi singkat promo, detailnya menyusul.',
    image: menuBanner,
    status: 'Sedang berjalan',
    location: 'Toko Kopi Irona',
    quota: { left: 18, total: 30 },
    period: 'Berlaku 7 - 30 Oktober 2026, selama kuota masih ada.',
  },
  {
    id: 'event-2',
    kind: 'event',
    date: '05 Okt 2026',
    title: 'Judul event',
    description: 'Deskripsi singkat event, detailnya menyusul.',
    image: baristaPhoto,
    status: 'Selesai',
    tag: 'Live music',
    location: 'Toko Kopi Irona',
    quota: { left: 0, total: 40 },
    fullDate: 'Minggu, 5 Oktober 2026',
    time: '19.00 – 22.00 WIB',
    price: 0,
    rundown: [
      { time: '19.00', text: 'Deskripsi sesi pertama.' },
      { time: '20.30', text: 'Deskripsi sesi kedua.' },
    ],
    photos: [interiorPhoto, menuBanner, storePhoto],
  },
];
