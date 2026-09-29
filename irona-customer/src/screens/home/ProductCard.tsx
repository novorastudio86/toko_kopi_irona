import { useRef, useState, type MouseEvent } from 'react';
import { ShoppingCart } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';
import recommendedIcon from '@/assets/home/recommended.webp';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product';
import { formatRupiah } from '@/utils/format';
import MenuImage from './MenuImage';
import { MAX_QTY } from './useQuickCart';

// Tombol & stepper sama lebar/tinggi supaya bergantian tanpa geser layout.
// z-10 = di atas stretched link, jadi klik tombol tidak membuka detail.
const controlClass =
  'relative z-10 flex h-[27px] w-20 shrink-0 items-center rounded-[6px] text-[11px] font-medium pointer-coarse:h-10';
const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';
const mutedClass =
  'cursor-not-allowed border border-dashed border-muted-foreground bg-transparent text-muted-foreground';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Efek sekali jalan lewat Web Animations API; dilewati saat reduced motion */
function play(el: Element | null | undefined, keyframes: Keyframe[], duration: number) {
  if (el && !reducedMotion()) el.animate(keyframes, { duration, easing: 'ease-out' });
}
const SHAKE = [0, -3, 3, -3, 3, 0].map((x) => ({ transform: `translateX(${x}px)` }));
const POP = [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }];

export default function ProductCard({
  product,
  quantity,
  orderingOpen,
  onQuantityChange,
  onClosedAttempt,
}: {
  product: Product;
  quantity: number;
  orderingOpen: boolean;
  onQuantityChange: (quantity: number) => void;
  /** Klik tombol order saat toko tutup */
  onClosedAttempt: () => void;
}) {
  const { name, sellingPrice: price, isSoldOut: soldOut } = product;
  const [announcement, setAnnouncement] = useState('');
  const cardRef = useRef<HTMLElement>(null);
  const qtyRef = useRef<HTMLSpanElement>(null);
  // Tombol "+ Tambah" ↔ stepper bertukar elemen (setelah animasi keluar selesai);
  // callback ref memindahkan fokus ke tombol pengganti begitu ia terpasang.
  const refocus = useRef<'add' | 'inc' | null>(null);
  const focusWhen = (which: 'add' | 'inc') => (el: HTMLButtonElement | null) => {
    if (el && refocus.current === which) {
      refocus.current = null;
      el.focus();
    }
  };

  /** control = tombol/stepper yang digetarkan saat toko tutup */
  const change = (qty: number, control: Element | null) => {
    if (!orderingOpen) {
      play(control, SHAKE, 250);
      return onClosedAttempt();
    }
    refocus.current = quantity === 0 ? 'inc' : qty === 0 ? 'add' : null;
    if (quantity === 0) play(cardRef.current, POP, 220);
    else if (qty > 0) {
      const y = qty > quantity ? 6 : -6;
      play(
        qtyRef.current,
        [
          { transform: `translateY(${y}px)`, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        150
      );
    }
    onQuantityChange(qty);
    setAnnouncement(qty === 0 ? `${name} dihapus dari keranjang` : `${qty} ${name} di keranjang`);
  };

  // aria-disabled (bukan disabled) supaya klik saat tutup tetap sampai dan memunculkan toast
  const closedProps = orderingOpen ? {} : { 'aria-disabled': true };
  const fromStepper = (e: MouseEvent<HTMLButtonElement>) => e.currentTarget.parentElement;

  return (
    <article
      ref={cardRef}
      data-added={(!soldOut && quantity > 0) || undefined}
      data-sold-out={soldOut || undefined}
      className={cn(
        'menu-card relative flex flex-col border p-2 pb-[9px] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-foreground',
        soldOut ? 'border-border' : 'border-foreground'
      )}
    >
      <div
        className={cn(
          'menu-card-frame relative h-[118px] overflow-hidden border',
          soldOut ? 'border-border' : 'border-foreground'
        )}
      >
        <MenuImage src={product.photoUrl} alt={name} />
        {product.isRecommended && (
          <span className="pointer-events-none absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-primary py-0.5 pr-2 pl-1.5 text-[11px] leading-4 text-primary-foreground">
            {/* Ikon koala dipakai sebagai mask supaya warnanya ikut teks badge */}
            <span
              aria-hidden
              className="h-3 w-[19px] bg-current mask-contain mask-center mask-no-repeat"
              style={{ maskImage: `url(${recommendedIcon})` }}
            />
            Pilihan Kora
          </span>
        )}
      </div>

      <h3
        title={soldOut ? name : undefined}
        className={cn(
          'mt-[7px] truncate text-[13px] leading-[15.6px] font-medium',
          soldOut ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {/* Stretched link: ::after menutup seluruh card (termasuk foto) tanpa elemen interaktif bersarang.
            Menu habis tidak bisa diklik, jadi tanpa link. */}
        {/* TODO(route): halaman detail /menu/:id belum ada; sementara tampil "Segera hadir" */}
        {soldOut ? (
          name
        ) : (
          <Link
            to={`/menu/${product.id}`}
            title={name}
            className="outline-none after:absolute after:inset-0"
          >
            {name}
          </Link>
        )}
      </h3>

      {/* flex-wrap: di card sangat sempit tombol turun ke baris kedua, bukan meluber.
          min-h = tinggi kontrol, jaga baris tidak menyusut saat tombol ↔ stepper bergantian */}
      <div className="mt-2 flex min-h-[27px] flex-wrap items-center justify-between gap-x-1.5 gap-y-1 pointer-coarse:min-h-10">
        <span
          className={cn(
            'text-xs leading-[14.4px] font-medium tracking-[1.08px] tabular-nums',
            soldOut ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {price === null ? '-' : formatRupiah(price)}
        </span>

        <AnimatePresence mode="wait" initial={false}>
          {soldOut ? (
            <span
              key="sold-out"
              className={cn(
                controlClass,
                'justify-center border border-border text-muted-foreground'
              )}
            >
              Habis
            </span>
          ) : quantity > 0 ? (
            <motion.div
              key="stepper"
              initial={{ opacity: 0, scale: 0.9, x: 6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12, ease: 'easeIn' } }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              style={{ originX: 1 }}
              className={cn(
                controlClass,
                orderingOpen ? 'bg-primary text-primary-foreground' : mutedClass
              )}
            >
              <button
                type="button"
                onClick={(e) => change(quantity - 1, fromStepper(e))}
                aria-label={`Kurangi jumlah ${name}`}
                {...closedProps}
                className={cn(
                  'h-full flex-1 rounded-[6px]',
                  focusClass,
                  !orderingOpen && 'cursor-not-allowed'
                )}
              >
                −
              </button>
              <span ref={qtyRef} className="min-w-5 text-center tabular-nums">
                {quantity}
              </span>
              <button
                ref={focusWhen('inc')}
                type="button"
                onClick={(e) => change(quantity + 1, fromStepper(e))}
                disabled={orderingOpen && quantity >= MAX_QTY}
                aria-label={`Tambah jumlah ${name}`}
                {...closedProps}
                className={cn(
                  'h-full flex-1 rounded-[6px] disabled:opacity-40',
                  focusClass,
                  !orderingOpen && 'cursor-not-allowed'
                )}
              >
                +
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="add"
              ref={focusWhen('add')}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12, ease: 'easeIn' } }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              type="button"
              onClick={(e) => change(1, e.currentTarget)}
              disabled={price === null}
              aria-label={`Tambah ${name}`}
              {...closedProps}
              className={cn(
                controlClass,
                'justify-center gap-1',
                focusClass,
                orderingOpen
                  ? 'menu-add border border-primary bg-primary text-primary-foreground disabled:opacity-50'
                  : mutedClass
              )}
            >
              <ShoppingCart aria-hidden className="size-3" strokeWidth={2.25} />
              Tambah
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </article>
  );
}
