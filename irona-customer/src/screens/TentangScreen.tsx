import { useEffect } from 'react';
import { useLocation } from 'react-router';
import baristaPhoto from '@/assets/home/hero-barista.webp';
import interiorPhoto from '@/assets/home/hero-interior.webp';
import storePhoto from '@/assets/home/hero-store.webp';
import koraSitting from '@/assets/home/kora.webp';
import koraStanding from '@/assets/home/kora_berdiri_cutout.png';
import koraWaving from '@/assets/home/kora_menyapa_cutout.png';
import wordmark from '@/assets/home/wordmark.webp';
import latteImage from '@/assets/images/730cf7c3-5ce8-4323-9d49-1d3694e6ead0.jpg';
import menuBanner from '@/assets/menu/menu-banner.webp';
import { cn } from '@/lib/utils';
import VisitSection from './home/VisitSection';
import EventCards from './tentang/EventCards';

// Figma 690:122: 2 foto besar di tepi, 2 foto kecil + 1 panorama di tengah (desktop 4 kolom × 2 baris).
// TODO(aset): ganti dengan foto galeri asli.
const GALLERY = [
  { src: storePhoto, alt: 'Tampak depan Toko Kopi Irona', className: 'row-span-2' },
  { src: baristaPhoto, alt: 'Kora di meja barista', className: '' },
  { src: menuBanner, alt: 'Menu Toko Kopi Irona', className: '' },
  {
    src: latteImage,
    alt: 'Es kopi susu Irona',
    className: 'md:col-start-4 md:row-span-2 md:row-start-1',
  },
  {
    src: interiorPhoto,
    alt: 'Kora di dalam dan di teras Toko Kopi Irona',
    className: 'md:col-span-2 md:col-start-2 md:row-start-2',
  },
];

const sectionClass = 'mx-auto max-w-[1200px] px-4 pt-6 pb-8 md:px-[30px] md:pb-[34px]';
const headingClass = 'font-display text-2xl leading-[22px]';

export default function TentangScreen() {
  const { hash } = useLocation();
  // Link "/tentang#event" dari halaman lain: router tidak scroll ke anchor sendiri
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <>
      <title>Tentang | Toko Kopi Irona</title>
      <meta
        name="description"
        content="Kenalan dengan Toko Kopi Irona di Balung, Jember: cerita kami, Kora si koala barista, event & promo, galeri, dan lokasi toko."
      />

      {/* Banner: strip 3 foto + judul di tengah */}
      <section className="relative grid h-[160px] grid-cols-[31fr_26fr_43fr] overflow-hidden border-b border-foreground md:h-[222px]">
        {[storePhoto, baristaPhoto, interiorPhoto].map((src) => (
          <img key={src} src={src} alt="" className="size-full min-h-0 object-cover" />
        ))}
        <div className="absolute inset-0 grid place-items-center">
          <h1 className="bg-primary/35 px-8 py-4 font-display text-3xl text-primary-foreground italic backdrop-blur-[2px] md:px-12 md:py-7 md:text-[34px]">
            Tentang Kami?
          </h1>
        </div>
      </section>

      {/* Intro + barisan Kora (diam, tanpa animasi) */}
      <section className="border-b border-foreground">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pt-6 md:flex-row md:items-end md:justify-between md:px-[39px]">
          <div className="pb-6 md:pb-[26px]">
            <img
              src={wordmark}
              alt="Toko Kopi Irona"
              width={360}
              height={193}
              className="h-20 w-auto md:h-[104px]"
            />
            <h2 className="mt-4 text-lg leading-7 font-medium md:text-[22px]">
              A Place to Pause,{' '}
              <span className="font-display text-xl font-normal md:text-2xl">
                Connect &amp; Enjoy
              </span>
            </h2>
            <p className="mt-2 max-w-[540px] text-[13px] leading-6 md:text-sm">
              Berdiri sejak Juli 2025 di Balung, Jember, Toko Kopi Irona dibikin buat jadi tempat
              pulang sejenak. Ruang nyaman buat nikmatin kopi, ngobrol santai, dan lepas penat.
              #coffeehumanity
            </p>
          </div>
          <div aria-hidden className="flex shrink-0 items-end justify-center gap-2 md:gap-4">
            <img src={koraSitting} alt="" className="h-24 w-auto md:h-[118px]" />
            <img src={koraWaving} alt="" className="-mb-1 h-36 w-auto md:h-[196px]" />
            <img src={koraStanding} alt="" className="h-24 w-auto md:h-[120px]" />
          </div>
        </div>
      </section>

      {/* Kenalan dengan Kora */}
      <section className="border-b border-foreground">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-7 sm:flex-row sm:items-start md:gap-6 md:px-[30px]">
          <div className="grid size-[120px] shrink-0 place-items-center border border-foreground bg-background p-2 md:size-[150px]">
            <img
              src={koraStanding}
              alt="Kora, koala barista Toko Kopi Irona"
              className="max-h-full w-auto"
            />
          </div>
          <div className="md:pt-6">
            <h2 className={headingClass}>Halo Aku Kora.</h2>
            <p className="mt-2 text-[13px] leading-6 md:text-sm">
              Setiap pagi, aku duduk di sudut Irona, menyapa orang-orang yang datang dengan cerita
              mereka masing-masing. Ada yang datang untuk bekerja, belajar, ngobrol, tertawa, bahkan
              sekadar mencari tempat untuk diam.
              <br />
              Kata Kora, “Pelan bukan berarti tertinggal. Seperti kopi yang diseduh dengan sabar,
              hal-hal terbaik selalu butuh waktu.”
            </p>
          </div>
        </div>
      </section>

      <EventCards />

      {/* Galeri */}
      <section aria-labelledby="galeri-title" className="border-b border-foreground">
        <div className={sectionClass}>
          <h2 id="galeri-title" className={headingClass}>
            Galeri Cafe
          </h2>
          <div className="mt-4 grid auto-rows-[120px] grid-cols-2 gap-2.5 md:grid-cols-4 md:grid-rows-[110px_110px]">
            {GALLERY.map((g) => (
              <img
                key={g.src}
                src={g.src}
                alt={g.alt}
                loading="lazy"
                className={cn('size-full border border-foreground object-cover', g.className)}
              />
            ))}
          </div>
        </div>
      </section>

      <VisitSection />
    </>
  );
}
