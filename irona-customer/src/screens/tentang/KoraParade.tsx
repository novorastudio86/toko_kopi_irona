import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import koraBerjalan from '@/assets/tentang/kora-berjalan.webp';
import koraMelompat from '@/assets/tentang/kora-melompat.webp';
import koraNgopi from '@/assets/tentang/kora-ngopi.webp';
import { cn } from '@/lib/utils';

// Figma 690:123: kiri rendah (ngopi), tengah tinggi (melompat), kanan rendah (berjalan).
const KORA = [
  { src: koraNgopi, className: '-mb-2 h-[86px] md:-mb-[10px] md:h-[122px]' },
  { src: koraMelompat, className: 'mb-16 h-[104px] md:mb-[92px] md:h-[148px]' },
  { src: koraBerjalan, className: 'h-24 md:h-[135px]' },
];

const SWITCH_MS = 3500;

/** Barisan Kora: satu per satu muncul bergantian kiri → kanan tiap 2 detik, terus berulang */
export default function KoraParade() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setActive((i) => (i + 1) % KORA.length), SWITCH_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <div aria-hidden className="flex shrink-0 items-end justify-center gap-2 md:gap-1">
      {KORA.map((k, i) => (
        // Yang tidak aktif tetap memakan tempat supaya posisi tiap Kora sama seperti di Figma
        <motion.img
          key={k.src}
          src={k.src}
          alt=""
          className={cn('w-auto', k.className)}
          initial={false}
          animate={
            reduceMotion || i === active
              ? { opacity: 1, y: 0, scale: 1 }
              : { opacity: 0, y: 16, scale: 0.9 }
          }
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
