import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import koraBarista from '@/assets/home/kora-barista.svg';
import koraDriver from '@/assets/home/kora-driver.svg';
import koraKasir from '@/assets/home/kora-kasir.svg';
import koraMenyapa from '@/assets/home/kora_menyapa_cutout.png';
import './kora.css';

/**
 * Pose Kora di Home.
 */
const KORA_CREW = [
  {
    id: 'menyapa',
    image: koraMenyapa,
    alt: 'Kora melambai sambil memegang kopi',
    title: 'Hai, kenalin aku Kora!',
    subtitle: 'Yang jaga Toko Kopi Irona sejak hari pertama.',
    isPlaceholder: false,
  },
  {
    id: 'kopi-susu',
    image: koraBarista,
    alt: 'Kora membawa kopi susu',
    title: 'Ini kopi susu andalan Kora.',
    subtitle: 'Manis, creamy, bikin melek seharian.',
    isPlaceholder: false,
  },
  {
    id: 'kasir',
    image: koraKasir,
    alt: 'Kora berjaga di kasir',
    title: 'Mampir ke toko, Kora tunggu di kasir.',
    subtitle: 'Alamatnya ada di bawah, jangan lupa mampir ya.',
    isPlaceholder: false,
  },
  {
    id: 'driver',
    image: koraDriver,
    alt: 'Kora naik vespa mengantar pesanan',
    title: 'Pesan dari rumah, Kora yang antar.',
    subtitle: 'Order online, tinggal tunggu di depan pintu.',
    isPlaceholder: false,
  },
];

const LEAVE_DELAY = 180;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Panggung Kora full-bleed: Kora besar saling tumpuk, bisa digeser. Diam: tanpa gerak.
 * Hover / fokus keyboard / ketuk: latar meredup, sinar berputar di belakang Kora itu, label
 * menyapa muncul di badannya. Style & animasi di kora.css.
 */
export default function KoraSection() {
  const [active, setActive] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number>(undefined);
  const pointerType = useRef('');

  const activate = (i: number) => {
    clearTimeout(leaveTimer.current);
    setActive(i);
  };
  // Kursor keluar dari maskot: jeda singkat, batal bila langsung masuk Kora lain (tanpa kedip)
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setActive(null), LEAVE_DELAY);
  };
  const deactivate = () => {
    clearTimeout(leaveTimer.current);
    setActive(null);
  };
  const slide = (dir: 1 | -1) =>
    rowRef.current?.scrollBy({
      left: dir * rowRef.current.clientWidth * 0.6,
      behavior: reduceMotion() ? 'auto' : 'smooth',
    });

  // Track scroll retro + status ujung (panah redup, petunjuk geser hilang bila semua muat)
  useLayoutEffect(() => {
    const section = sectionRef.current!;
    const row = rowRef.current!;
    const track = trackRef.current!;
    const update = () => {
      const max = row.scrollWidth - row.clientWidth;
      track.style.setProperty('--w', String(row.clientWidth / row.scrollWidth));
      track.style.setProperty('--p', String(max > 0 ? row.scrollLeft / max : 0));
      section.toggleAttribute('data-scrollable', max > 24);
      section.toggleAttribute('data-at-start', row.scrollLeft <= 1);
      section.toggleAttribute('data-at-end', row.scrollLeft >= max - 1);
    };
    update();
    row.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      row.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Ketuk di luar barisan = kembali diam
  useEffect(() => {
    if (active === null) return;
    const onDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [active]);

  const current = active === null ? null : KORA_CREW[active];

  return (
    <section
      ref={sectionRef}
      id="kora"
      aria-labelledby="kora-title"
      data-active={active !== null || undefined}
      className="kora scroll-mt-[60px] border-b border-foreground"
    >
      <div className="kora-head">
        <h2 id="kora-title" className="kora-title font-display">
          Kenalan sama Kora,
          <br />
          si koala barista
        </h2>
        <div className="kora-hint font-display">
          <button type="button" aria-label="Geser ke kiri" onClick={() => slide(-1)}>
            &lsaquo;&lsaquo;
          </button>
          <span>Geser untuk lihat lainnya</span>
          <button type="button" aria-label="Geser ke kanan" onClick={() => slide(1)}>
            &rsaquo;&rsaquo;
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="kora-row no-scrollbar"
        onKeyDown={(e) => e.key === 'Escape' && deactivate()}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) deactivate();
        }}
      >
        <div className="kora-crew">
          {KORA_CREW.map((k, i) => (
            <button
              key={k.id}
              type="button"
              aria-label={k.title}
              data-active={active === i || undefined}
              className="kora-item"
              onPointerDown={(e) => (pointerType.current = e.pointerType)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && activate(i)}
              onPointerLeave={leave}
              // Fokus dari ketukan/klik diabaikan; hanya fokus keyboard yang setara hover
              onFocus={(e) => e.currentTarget.matches(':focus-visible') && activate(i)}
              onClick={(e) => {
                // detail 0 = Enter/Space; mouse sudah ditangani hover
                if (e.detail === 0 || pointerType.current === 'mouse') return;
                if (active === i) return deactivate();
                activate(i);
                e.currentTarget.scrollIntoView({
                  behavior: reduceMotion() ? 'auto' : 'smooth',
                  block: 'nearest',
                  inline: 'center',
                });
              }}
            >
              <span aria-hidden className="kora-rays" />
              <img
                src={k.image}
                alt={k.alt}
                width={1263}
                height={1375}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              <span aria-hidden className="kora-tag">
                <span className="block font-display text-[20px] leading-[1.1] md:text-[24px]">
                  {k.title}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-muted-foreground md:text-sm">
                  {k.subtitle}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div ref={trackRef} aria-hidden className="kora-track">
        <span />
      </div>

      <p aria-live="polite" className="sr-only">
        {current && `${current.title} ${current.subtitle}`}
      </p>
    </section>
  );
}
