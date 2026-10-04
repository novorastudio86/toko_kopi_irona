import type { RefObject } from 'react';
import { Check, TicketPercent, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Voucher } from '@/types/onlineOrder';
import { formatRupiah } from '@/utils/format';
import {
  checkVoucher,
  TARGET_TONE,
  type VoucherContext,
  type VoucherPicks,
  type VoucherTarget,
} from './checkoutLogic';

const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';

const GROUPS: { target: VoucherTarget; title: string }[] = [
  { target: 'produk', title: 'Diskon Menu' },
  { target: 'ongkir', title: 'Diskon Ongkir' },
];

function terms(v: Voucher): string {
  return [
    v.minPurchase > 0 ? `Min. belanja ${formatRupiah(v.minPurchase)}` : 'Tanpa min. belanja',
    v.memberOnly && 'Khusus member',
    v.maxDistanceKm !== null && `Maks. ${v.maxDistanceKm.toLocaleString('id-ID')} km`,
  ]
    .filter(Boolean)
    .join(' · ');
}

const formatEnd = (date: string) =>
  new Date(`${date}T00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/**
 * Popup pilih voucher: maks. 1 voucher menu + 1 voucher ongkir. Klik = pakai, klik lagi = lepas.
 * <dialog> native: focus trap + Esc gratis. Mobile = bottom-sheet.
 */
export default function VoucherDialog({
  dialogRef,
  vouchers,
  ctx,
  picks,
  onPick,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  vouchers: Voucher[];
  ctx: VoucherContext;
  picks: VoucherPicks;
  /** id null = tanpa voucher untuk sasaran itu */
  onPick: (target: VoucherTarget, id: string | null) => void;
}) {
  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="voucher-title"
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-0 mt-auto flex max-h-[85dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl border border-foreground bg-background p-0 text-foreground backdrop:bg-black/50 not-open:hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 md:m-auto md:max-w-[440px] md:rounded-[6px]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-foreground px-4 py-3">
        <div>
          <h2 id="voucher-title" className="text-sm font-semibold">
            Pilih Voucher
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Bisa pakai 1 voucher menu + 1 voucher ongkir.
          </p>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={close}
          className={cn(
            'grid size-8 place-items-center rounded-full hover:bg-secondary',
            focusClass
          )}
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="grid gap-4 overflow-y-auto px-4 py-4">
        {vouchers.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Belum ada voucher.</p>
        )}
        {GROUPS.map(({ target, title }) => {
          const list = vouchers.filter((v) => v.target === target);
          if (list.length === 0) return null;
          return (
            <section key={target} aria-label={title} className="grid gap-2">
              <h3 className="text-[11px] font-medium tracking-[0.12em] uppercase">{title}</h3>
              {list.map((v) => {
                const r = checkVoucher(v, ctx);
                const ok = 'discount' in r && r.discount > 0;
                const selected = picks[target] === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={!ok && !selected}
                    onClick={() => onPick(target, selected ? null : v.id)}
                    className={cn(
                      'flex items-center gap-3 rounded-[6px] border border-foreground px-3 py-2.5 text-left transition-colors',
                      selected ? TARGET_TONE[target] : 'hover:bg-secondary',
                      !ok &&
                        'cursor-not-allowed border-dashed border-border text-muted-foreground hover:bg-transparent',
                      focusClass
                    )}
                  >
                    <TicketPercent aria-hidden className="size-4 shrink-0" />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-xs font-medium">{v.name}</span>
                      <span className="text-[10px] opacity-80">
                        {'reason' in r ? r.reason : terms(v)}
                      </span>
                      {v.endDate && (
                        <span className="text-[10px] opacity-80">
                          Berlaku s.d. {formatEnd(v.endDate)}
                        </span>
                      )}
                    </span>
                    {ok && (
                      <span className="shrink-0 text-[11px] font-semibold">
                        −{formatRupiah(r.discount)}
                      </span>
                    )}
                    {selected && <Check aria-hidden className="size-4 shrink-0" />}
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>

      <div className="border-t border-foreground px-4 py-3">
        <button
          type="button"
          onClick={close}
          className={cn(
            'h-10 w-full rounded-[6px] bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85',
            focusClass
          )}
        >
          Selesai
        </button>
      </div>
    </dialog>
  );
}
