import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import { useMember } from '@/hooks/useMember';
import { fetchActivePromo } from '@/services/promoService';
import type { Promo } from '@/types/promo';

const SHOW_DELAY_MS = 10_000;

/** open = popup tampil; tab = popup ditutup, tersisa tab di sisi kiri; gone = tab ikut ditutup */
type View = 'open' | 'tab' | 'gone';

/**
 * Popup ajakan gabung member, muncul 10 detik setelah situs dibuka. Ditutup → jadi tab di kiri
 * (klik = buka lagi). Hilang total kalau sudah jadi member (= voucher sudah diklaim).
 * TODO(backend): status member/klaim masih di memori, jadi tiap refresh popup muncul lagi.
 */
export default function PromoPopup() {
  const { member } = useMember();
  const [promo, setPromo] = useState<Promo | null>(null);
  const [view, setView] = useState<View>('open');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchActivePromo()
        .then((data) => !cancelled && setPromo(data))
        .catch((err) => console.error('Gagal memuat promo', err));
    }, SHOW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const visible = !!promo && !member;

  useEffect(() => {
    if (visible && view === 'open') dialogRef.current?.showModal();
  }, [visible, view]);

  if (!visible || view === 'gone') return null;

  const toTab = () => setView('tab');

  if (view === 'tab') {
    return (
      <div className="fixed top-1/2 left-0 z-40 -translate-y-1/2 motion-safe:animate-in motion-safe:slide-in-from-left">
        <button
          type="button"
          onClick={() => setView('open')}
          className="rounded-r-[8px] bg-primary px-1 py-5 font-display text-[18px] leading-none tracking-[0.5px] text-primary-foreground transition-colors outline-none [writing-mode:vertical-rl] hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-foreground/30"
        >
          {promo.headline}
        </button>
        <button
          type="button"
          aria-label="Sembunyikan promo"
          onClick={() => setView('gone')}
          className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full border border-foreground bg-background outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-foreground/30"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    // <dialog> native: focus trap + Esc gratis. Mobile = bottom-sheet tanpa foto, md+ = modal 2 kolom.
    <dialog
      ref={dialogRef}
      aria-labelledby="promo-headline"
      onClose={toTab}
      onClick={(e) => e.target === e.currentTarget && toTab()}
      className="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-2xl border border-foreground bg-secondary p-0 text-foreground backdrop:bg-black/50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 md:m-auto md:max-w-[680px] md:rounded-2xl"
    >
      <div className="grid md:grid-cols-[1fr_300px]">
        <div className="px-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center md:px-10 md:py-11">
          <p className="font-mono text-[11px] tracking-[1px] text-muted-foreground uppercase">
            Kora Club
          </p>
          <h2
            id="promo-headline"
            className="mt-1 font-display text-4xl leading-tight md:text-[44px]"
          >
            {promo.headline}
          </h2>
          <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-6">{promo.description}</p>

          <Link
            to={promo.ctaHref}
            onClick={toTab}
            className="mt-7 grid h-11 place-items-center rounded-[6px] bg-primary font-mono text-[13px] font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-foreground/30"
          >
            {promo.ctaLabel}
          </Link>
          <button
            type="button"
            onClick={toTab}
            className="mt-3 h-10 w-full rounded-[6px] font-mono text-[13px] font-medium tracking-[0.5px] uppercase transition-colors outline-none hover:bg-background/60 focus-visible:ring-3 focus-visible:ring-foreground/30"
          >
            Nanti saja
          </button>

          {promo.terms && (
            <p className="mx-auto mt-4 max-w-[300px] text-xs leading-5 text-muted-foreground">
              {promo.terms}
            </p>
          )}
        </div>

        <img
          src={promo.imageUrl}
          alt=""
          className="hidden size-full border-l border-foreground bg-white object-cover md:block"
        />
      </div>

      <button
        type="button"
        aria-label="Tutup promo"
        onClick={toTab}
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-background/80 transition-colors outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-foreground/30"
      >
        <X className="size-5" />
      </button>
    </dialog>
  );
}
