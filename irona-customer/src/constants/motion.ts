/*
 * Transisi pindah halaman (SiteLayout), detik — meniru escape.cafe:
 * tirai warna latar memudar menutupi layar, lalu "jendela" tergulung ke atas membuka halaman baru.
 */
export const PAGE_COVER = 0.3;
export const PAGE_REVEAL = 1.4;
/** Animasi konten halaman baru (card menu, hero, ...) mulai saat tirai sudah sebagian besar terbuka */
export const PAGE_CONTENT_DELAY = 0.45;
export const COVER_EASE = [0.645, 0.045, 0.355, 1] as const;
export const REVEAL_EASE = [0.4, 0, 0, 1] as const;
