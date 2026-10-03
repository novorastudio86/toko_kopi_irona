import { useEffect, useState } from 'react';
import kora from '@/assets/home/kora.webp';
import { HERO_SLIDES } from '@/constants/heroSlides';
import { cn } from '@/lib/utils';
import WordmarkIntro from './WordmarkIntro';

const SLIDE_INTERVAL_MS = 5000;
// Foto pertama (dengan Kora) tampil lebih lama
const FIRST_SLIDE_MS = 8000;

/** Dipakai ulang oleh tombol CTA di section lain supaya style tombol tetap satu */
export const ctaClass =
  'grid h-[33px] place-items-center rounded-[6px] border border-foreground px-4 font-mono text-[11px] font-medium';

export default function HeroSection() {
  const [active, setActive] = useState(0);

  // Timer diulang tiap slide berganti, jadi klik manual juga mereset hitungan
  useEffect(() => {
    const timer = setTimeout(
      () => setActive((i) => (i + 1) % HERO_SLIDES.length),
      active === 0 ? FIRST_SLIDE_MS : SLIDE_INTERVAL_MS
    );
    return () => clearTimeout(timer);
  }, [active]);

  return (
    // Desktop: setinggi layar dan naik ke belakang navbar 61px (navbar transparan di atas Hero);
    // foto ±70% kanan jadi latar, teks menumpuk di atas bagian fade-nya
    <section className="relative flex flex-col border-b border-foreground md:-mt-[61px] md:min-h-svh md:justify-center md:pt-[61px]">
      <div className="relative z-10 order-1 px-4 pt-5 pb-8 md:mx-auto md:w-full md:max-w-page md:py-8 md:px-[30px]">
        <h1 className="max-md:sr-only">
          <WordmarkIntro className="h-[93.5px] md:h-32" />
        </h1>
        <h2 className="hero-reveal text-lg leading-7 [--i:1] font-medium md:mt-[21px] md:text-[22px]">
          A Place to Pause,{' '}
          <span className="font-display text-xl font-normal md:text-2xl">Connect &amp; Enjoy</span>
        </h2>
        <p className="hero-reveal mt-2 max-w-[453px] [--i:2] text-[13px] leading-6 md:max-w-[400px] md:text-sm">
          Berdiri sejak Juli 2025 di Balung, Jember, Irona dibikin buat jadi tempat pulang sejenak.
          Ruang nyaman buat nikmatin kopi, ngobrol santai, dan lepas penat.
        </p>
        <div className="hero-reveal mt-3.5 grid grid-cols-2 [--i:3] gap-1.5 md:flex">
          <a
            href="#menu"
            className={cn(ctaClass, 'bg-primary text-primary-foreground hover:bg-primary/80')}
          >
            Lihat menu
          </a>
          <a href="#lokasi" className={cn(ctaClass, 'bg-background hover:bg-secondary')}>
            Kunjungi kami
          </a>
        </div>
      </div>

      {/* Foto full-bleed tanpa sudut; tepi kiri memudar ke warna latar lewat mask (desktop) */}
      <div className="relative aspect-[3/2] md:absolute md:inset-y-0 md:right-0 md:left-1/2 md:aspect-auto lg:left-[30%]">
        <div className="absolute inset-0 overflow-hidden md:mask-[linear-gradient(to_right,transparent,black_40%)]">
          {HERO_SLIDES.map((slide, i) => (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              aria-hidden={i !== active}
              style={{ objectPosition: slide.position }}
              className={cn(
                'absolute inset-0 size-full object-cover transition-opacity duration-700 motion-reduce:transition-none',
                i === active ? 'opacity-100' : 'opacity-0'
              )}
            />
          ))}
        </div>

        <div className="absolute top-[22px] right-4 flex gap-[7px] md:top-[83px]">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Tampilkan foto ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={cn(
                'w-4 text-center font-mono text-[10.5px] leading-[14.7px] text-foreground transition-opacity',
                i === active ? 'opacity-100' : 'opacity-40 hover:opacity-70'
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Seperti Figma 546:2: menjorok ±31px melewati garis bawah; disembunyikan kalau foto sudah memuat Kora */}
        <img
          src={kora}
          alt=""
          className={cn(
            'pointer-events-none absolute top-[58%] left-[64%] z-10 w-[24%] transition-opacity duration-700 motion-reduce:transition-none',
            'md:top-auto md:-bottom-[31px] md:left-[60%] md:h-[37%] md:w-auto',
            HERO_SLIDES[active].hasMascot ? 'opacity-0' : 'opacity-100'
          )}
        />
      </div>
    </section>
  );
}
