import storePhoto from '@/assets/home/hero-store.webp';
import baristaPhoto from '@/assets/home/hero-barista.webp';
import interiorPhoto from '@/assets/home/hero-interior.webp';

export interface HeroSlide {
  src: string;
  alt: string;
  /** CSS object-position supaya fokus foto tetap terlihat saat di-crop */
  position: string;
  /** Foto sudah memuat ilustrasi Kora → maskot overlay disembunyikan */
  hasMascot: boolean;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    src: storePhoto,
    alt: 'Tampak depan Toko Kopi Irona',
    position: '70% center',
    hasMascot: false,
  },
  {
    src: baristaPhoto,
    alt: 'Kora meracik kopi di meja barista Toko Kopi Irona',
    position: '55% center',
    hasMascot: true,
  },
  {
    src: interiorPhoto,
    alt: 'Kora di dalam dan di teras Toko Kopi Irona',
    position: 'center',
    hasMascot: true,
  },
];
