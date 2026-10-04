import { useEffect } from 'react';
import { useLocation } from 'react-router';
import baristaPhoto from '@/assets/home/hero-barista.webp';
import interiorPhoto from '@/assets/home/hero-interior.webp';
import storePhoto from '@/assets/home/hero-store.webp';
import koraStanding from '@/assets/home/kora_berdiri_cutout.png';
import wordmark from '@/assets/home/wordmark.webp';
import latteImage from '@/assets/images/730cf7c3-5ce8-4323-9d49-1d3694e6ead0.jpg';
import membershipPhoto from '@/assets/membership/membership-hero.webp';
import menuBanner from '@/assets/menu/menu-banner.webp';
import { KORA_INSTAGRAM_URL } from '@/constants/kora';
import { cn } from '@/lib/utils';
import VisitSection from '../home/VisitSection';
import EventCards from './EventCards';
import KoraParade from './KoraParade';

// Bento maks 8 foto, urutan = posisi (grid-flow-dense):
// desktop 4×3 → [besar 2×2][a][b] / [besar][c][tinggi 1×2] / [d][e][f][tinggi]; mobile 2 kolom × 6 baris.
// TODO(aset): ganti dengan foto galeri asli (2 foto terakhir sementara pakai ulang foto lain).
const GALLERY_MAX = 8;
const GALLERY = [
  {
    src: storePhoto,
    alt: 'Tampak depan Toko Kopi Irona',
    caption: 'Rumah kecil di Balung',
    className: 'col-span-2 row-span-2',
  },
  { src: latteImage, alt: 'Es kopi susu Irona', caption: 'Es kopi susu andalan' },
  { src: menuBanner, alt: 'Menu Toko Kopi Irona', caption: 'Menu favorit' },
  { src: membershipPhoto, alt: 'Kora di sudut bar', caption: 'Sudut bar' },
  {
    src: baristaPhoto,
    alt: 'Kora di meja barista',
    caption: 'Kora si barista',
    className: 'row-span-2',
  },
  { src: interiorPhoto, alt: 'Interior Toko Kopi Irona', caption: 'Ruang ngobrol' },
  {
    src: interiorPhoto,
    alt: 'Teras Toko Kopi Irona',
    caption: 'Teras santai',
    className: '[&_img]:object-right',
  },
  {
    src: storePhoto,
    alt: 'Suasana sore di Toko Kopi Irona',
    caption: 'Sore di Irona',
    className: '[&_img]:object-bottom',
  },
].slice(0, GALLERY_MAX);

const sectionClass = 'mx-auto max-w-page px-4 pt-6 pb-8 md:px-[30px] md:pb-[34px]';
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

      {/* Banner: strip 3 foto diburamkan, judul di atas overlay gelap */}
      <section className="relative grid h-[190px] place-items-center overflow-hidden border-b border-foreground md:h-[270px]">
        {/* scale-110 menutup tepi transparan akibat blur */}
        <div
          aria-hidden
          className="absolute inset-0 grid scale-110 grid-cols-[31fr_26fr_43fr] blur-[3px]"
        >
          {[storePhoto, baristaPhoto, interiorPhoto].map((src) => (
            <img key={src} src={src} alt="" className="size-full min-h-0 object-cover" />
          ))}
        </div>
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-primary/85 via-primary/50 to-primary/30"
        />
        <div className="relative px-4 text-center text-primary-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <h1 className="font-display text-4xl drop-shadow-lg md:text-[56px] md:leading-none">
            Tentang Kami
          </h1>
          <p className="mt-3 flex items-center justify-center gap-3 text-[13px] italic opacity-90 md:text-sm">
            <span aria-hidden className="h-px w-8 bg-primary-foreground/60 md:w-12" />
            Cerita di balik secangkir kopi
            <span aria-hidden className="h-px w-8 bg-primary-foreground/60 md:w-12" />
          </p>
        </div>
      </section>

      {/* Intro + barisan Kora (muncul bergantian) */}
      <section className="border-b border-foreground">
        <div className="mx-auto flex max-w-page flex-col gap-6 px-4 pt-6 md:flex-row md:items-end md:justify-between md:px-[30px]">
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
          <KoraParade />
        </div>
      </section>

      {/* Kenalan dengan Kora */}
      <section className="border-b border-foreground">
        <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-7 sm:flex-row sm:items-start md:gap-6 md:px-[30px]">
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
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="galeri-title" className={headingClass}>
              Galeri Cafe
            </h2>
            <a
              href={KORA_INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[11px] hover:underline"
            >
              @tokokopiirona →
            </a>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground md:text-sm">
            Sudut favorit, kopi andalan, dan Kora yang selalu menyapa.
          </p>
          <div className="mt-5 grid auto-rows-[130px] grid-flow-dense grid-cols-2 gap-3 md:auto-rows-[150px] md:grid-cols-4 md:gap-4">
            {GALLERY.map((g, i) => (
              <figure
                key={g.alt}
                style={{ animationDelay: `${i * 70}ms` }}
                className={cn(
                  'group relative overflow-hidden border border-foreground shadow-[4px_4px_0_0_var(--color-foreground)] transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[6px_8px_0_0_var(--color-foreground)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:fill-mode-both motion-safe:duration-500',
                  g.className
                )}
              >
                <img
                  src={g.src}
                  alt={g.alt}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                {/* Caption: selalu tampil di layar sentuh, muncul saat hover di desktop */}
                <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/30 to-transparent px-3 pt-8 pb-2.5 text-xs font-medium text-white transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100">
                  {g.caption}
                </figcaption>
                {i === 0 && (
                  <span className="absolute top-3 left-3 rounded-full border border-foreground bg-primary px-2.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                    #coffeehumanity
                  </span>
                )}
              </figure>
            ))}
          </div>
        </div>
      </section>

      <VisitSection />
    </>
  );
}
