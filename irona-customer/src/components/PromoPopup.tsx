import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { fetchActivePromo } from '@/services/promoService';
import type { Promo } from '@/types/promo';

const SHOW_DELAY_MS = 5000;
// Flag per sesi browser. TODO(backend): ganti dengan status "sudah dilihat" dari server.
const SEEN_KEY = 'irona:promo-seen';

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage diblokir: popup bisa muncul lagi, tidak masalah
  }
}

/** Popup promo 5 detik setelah mount, maksimal 1x per sesi; tidak render apa pun kalau tidak ada promo */
export default function PromoPopup() {
  const [promo, setPromo] = useState<Promo | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (alreadySeen()) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchActivePromo()
        .then((data) => {
          if (cancelled || !data) return;
          markSeen();
          setPromo(data);
        })
        .catch((err) => console.error('Gagal memuat promo', err));
    }, SHOW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (promo) dialogRef.current?.showModal();
  }, [promo]);

  if (!promo) return null;

  // Unmount langsung; onClose di bawah menangani tutup via Esc
  const close = () => setPromo(null);

  return (
    // <dialog> native: focus trap + Esc gratis. Mobile = bottom-sheet, md+ = modal tengah.
    <dialog
      ref={dialogRef}
      aria-labelledby="promo-headline"
      onClose={() => setPromo(null)}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl border border-foreground bg-card p-0 text-foreground backdrop:bg-black/50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 md:m-auto md:max-w-[420px] md:rounded-2xl"
    >
      <div className="relative px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-7 md:pt-8 md:pb-7">
        <button
          type="button"
          aria-label="Tutup promo"
          onClick={close}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-foreground/30"
        >
          <X className="size-5" />
        </button>

        <p className="font-mono text-[11px] tracking-[1px] text-muted-foreground uppercase">
          Promo
        </p>
        <h2 id="promo-headline" className="mt-1 pr-8 font-display text-2xl leading-tight">
          {promo.headline}
        </h2>
        <p className="mt-2 text-sm leading-6">{promo.description}</p>

        {promo.code && (
          <p className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-foreground bg-secondary px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Kode promo</span>
            <span className="font-mono font-semibold tracking-[1.5px]">{promo.code}</span>
          </p>
        )}

        <a
          href={promo.ctaHref}
          onClick={close}
          className="mt-5 grid h-11 place-items-center rounded-[6px] bg-primary font-mono text-[13px] font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-foreground/30"
        >
          {promo.ctaLabel}
        </a>
      </div>
    </dialog>
  );
}
