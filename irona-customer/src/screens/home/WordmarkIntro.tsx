import { motion, useReducedMotion } from 'motion/react';
import t from '@/assets/home/wordmark/t.webp';
import o1 from '@/assets/home/wordmark/o1.webp';
import k1 from '@/assets/home/wordmark/k1.webp';
import o2 from '@/assets/home/wordmark/o2.webp';
import k2 from '@/assets/home/wordmark/k2.webp';
import o3 from '@/assets/home/wordmark/o3.webp';
import p from '@/assets/home/wordmark/p.webp';
import i from '@/assets/home/wordmark/i.webp';
import ironaI from '@/assets/home/wordmark/irona-i.webp';
import ironaR from '@/assets/home/wordmark/irona-r.webp';
import ironaO from '@/assets/home/wordmark/irona-o.webp';
import ironaN from '@/assets/home/wordmark/irona-n.webp';
import ironaA from '@/assets/home/wordmark/irona-a.webp';
import { cn } from '@/lib/utils';

const START_DELAY = 1.2;
const STAGGER = 0.05;
const LETTER_DURATION = 0.7;
const SETTLE_EASE = [0.16, 1, 0.3, 1] as const;

/*
 * Tiap huruf dipotong langsung dari file source wordmark (3000x3000).
 * Posisi & ukuran dalam % dari kanvas wordmark (1439x869), jadi susunannya
 * identik dengan file asli di ukuran berapa pun. Urutan = urutan animasi.
 */
const LETTERS = [
  // toko kopi
  { src: t, left: 0.764, top: 12.198, width: 7.783, height: 20.138 },
  { src: o1, left: 7.436, top: 13.349, width: 7.088, height: 17.606 },
  { src: k1, left: 13.551, top: 10.702, width: 8.061, height: 20.713 },
  { src: o2, left: 20.5, top: 10.242, width: 7.158, height: 17.606 },
  { src: k2, left: 30.229, top: 6.789, width: 8.061, height: 20.829 },
  { src: o3, left: 37.248, top: 6.329, width: 7.158, height: 17.606 },
  { src: p, left: 43.085, top: 2.877, width: 7.575, height: 20.368 },
  { src: i, left: 48.992, top: 0.575, width: 6.185, height: 20.483 },
  // IRONA
  { src: ironaI, left: 0.347, top: 40.161, width: 11.953, height: 56.041 },
  { src: ironaR, left: 11.327, top: 31.53, width: 42.182, height: 62.486 },
  { src: ironaO, left: 33.634, top: 29.574, width: 19.458, height: 48.216 },
  { src: ironaN, left: 53.231, top: 24.741, width: 44.823, height: 74.684 },
  { src: ironaA, left: 76.372, top: 45.8, width: 23.28, height: 49.942 },
];

const seeded = (n: number, salt: number) => {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const between = (min: number, max: number, t: number) => min + (max - min) * t;

const scatterProps = (n: number) => ({
  initial: {
    x: between(-70, 70, seeded(n, 1)),
    y: between(-90, 90, seeded(n, 2)),
    rotate: between(-35, 35, seeded(n, 3)),
    opacity: 0,
  },
  animate: { x: 0, y: 0, rotate: 0, opacity: 1 },
  transition: { duration: LETTER_DURATION, delay: START_DELAY + n * STAGGER, ease: SETTLE_EASE },
});

/** Wordmark Hero: tiap huruf berhamburan lalu settle tepat di posisi logo asli (permanen) */
export default function WordmarkIntro({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="img"
      aria-label="Toko Kopi Irona"
      className={cn('relative aspect-[1439/869] select-none', className)}
    >
      {LETTERS.map((l, n) => (
        <motion.img
          key={n}
          src={l.src}
          alt=""
          aria-hidden
          draggable={false}
          loading="eager"
          className="absolute max-w-none"
          style={{
            left: `${l.left}%`,
            top: `${l.top}%`,
            width: `${l.width}%`,
            height: `${l.height}%`,
          }}
          {...(reduceMotion ? {} : scatterProps(n))}
        />
      ))}
    </div>
  );
}