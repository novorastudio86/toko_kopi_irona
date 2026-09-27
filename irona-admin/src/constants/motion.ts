import type { Transition, Variants } from 'motion/react';

/** Durasi & easing standar aplikasi. Jangan tulis angka acak di komponen — pakai ini. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const; // halus, cocok untuk masuk
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

export const DURATION = {
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
} as const;

export const springSoft: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 };

/** Latar gelap di belakang pop up */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

/** Panel pop up: naik sedikit + membesar halus */
export const modalVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { ...springSoft } },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: DURATION.fast } },
};

/** Panel menu samping (rail iPad) */
export const drawerVariants: Variants = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: { ...springSoft } },
  exit: { x: '-100%', transition: { duration: DURATION.base, ease: EASE_IN_OUT } },
};

/** Banner/flash yang muncul-hilang di atas konten */
export const bannerVariants: Variants = {
  hidden: { opacity: 0, y: -8, height: 0 },
  visible: { opacity: 1, y: 0, height: 'auto', transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, height: 0, transition: { duration: DURATION.fast, ease: EASE_IN_OUT } },
};

/** Baris expand di tabel (Master Resep, dll) */
export const expandVariants: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, height: 0, transition: { duration: DURATION.fast, ease: EASE_IN_OUT } },
};

/** Kontainer daftar: anak-anaknya muncul berurutan */
export const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Pergantian isi halaman/langkah form */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.fast } },
};