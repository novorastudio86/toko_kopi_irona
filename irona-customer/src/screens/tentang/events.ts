import baristaPhoto from '@/assets/home/hero-barista.webp';
import interiorPhoto from '@/assets/home/hero-interior.webp';
import storePhoto from '@/assets/home/hero-store.webp';
import latteImage from '@/assets/images/730cf7c3-5ce8-4323-9d49-1d3694e6ead0.jpg';
import membershipPhoto from '@/assets/membership/membership-hero.webp';
import menuBanner from '@/assets/menu/menu-banner.webp';
import type { FeedItem } from './eventFormat';

const IRONA_MAPS = 'https://maps.app.goo.gl/nwKvo3XnjkZ3fCeE6';

// TODO(backend): promo = tabel diskon (Promosi › Diskon), event = tabel event. Isi & foto masih dummy.
export const FEED: FeedItem[] = [
  {
    kind: 'promo',
    id: 'promo-jumat-berkah',
    name: 'Jumat Berkah',
    description:
      'Tiap Jumat, Es Kopi Susu Irona lebih hemat. Ajak teman, potongannya ikut berlipat.',
    image: latteImage,
    channel: 'offline',
    discountTarget: 'produk',
    discountKind: 'nominal',
    discountValue: 4000,
    maxDistanceKm: null,
    productNames: ['Es Kopi Susu Irona'],
    promoType: 'otomatis',
    targetCustomer: 'semua',
    minPurchaseType: 'qty',
    minPurchaseValue: 1,
    isRepeatable: true,
    maxOneClaimPerCustomer: false,
    appliesToTakeAway: true,
    isActive: true,
    startDate: '2026-08-21',
    endDate: '2027-12-01',
    validDays: [5],
    validStartTime: null,
    validEndTime: null,
  },
  {
    kind: 'event',
    id: 'event-manual-brew',
    title: 'Kelas Manual Brew Bareng Kora',
    description:
      'Belajar seduh kopi manual dari nol bareng barista Irona, pulang bawa resep andalanmu.',
    image: interiorPhoto,
    tag: 'Workshop',
    date: '2026-10-12',
    time: '16.00 – 21.00 WIB',
    location: 'Toko Kopi Irona',
    mapsUrl: IRONA_MAPS,
    price: 50000,
    details: [
      'Kelas santai untuk kamu yang penasaran cara menyeduh kopi sendiri di rumah. Barista Irona akan mengenalkan biji kopi lokal, cara menggiling, dan takaran air yang pas.',
      'Setiap peserta mencoba langsung V60 dan Vietnam drip, lalu mencicipi hasil seduhan bersama.',
    ],
    highlights: [
      'Praktik langsung V60 & Vietnam drip',
      'Cupping 3 biji kopi lokal',
      '1 minuman gratis + snack',
      'Diskon biji kopi 10% di hari acara',
    ],
  },
  {
    kind: 'event',
    id: 'event-live-music',
    title: 'Live Music Sabtu Malam',
    description: 'Malam akustik di teras Irona: lagu-lagu santai, kopi hangat, dan teman lama.',
    image: baristaPhoto,
    tag: 'Live music',
    date: '2026-09-26',
    time: '19.00 – 22.00 WIB',
    location: 'Toko Kopi Irona',
    mapsUrl: IRONA_MAPS,
    price: 0,
    photos: [
      { src: storePhoto, caption: 'Teras mulai ramai sejak sore' },
      { src: baristaPhoto, caption: 'Kora sibuk di meja barista' },
      { src: latteImage, caption: 'Es kopi susu paling laris malam itu' },
      { src: interiorPhoto, caption: 'Panggung kecil di dalam toko' },
      { src: menuBanner },
      { src: membershipPhoto, caption: 'Member Kora Club ikut kumpul' },
    ],
  },
  {
    // Sudah lewat → otomatis tidak tampil (contoh promo online/ongkir)
    kind: 'promo',
    id: 'promo-gratis-ongkir',
    name: 'Ongkir Hemat Kora Club',
    description: 'Potongan ongkir untuk member yang pesan lewat website.',
    image: menuBanner,
    channel: 'online',
    discountTarget: 'ongkir',
    discountKind: 'nominal',
    discountValue: 10000,
    maxDistanceKm: 5,
    productNames: [],
    promoType: 'manual',
    targetCustomer: 'member',
    minPurchaseType: 'nominal',
    minPurchaseValue: 50000,
    isRepeatable: false,
    maxOneClaimPerCustomer: true,
    appliesToTakeAway: false,
    isActive: true,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    validDays: [],
    validStartTime: null,
    validEndTime: null,
  },
];
