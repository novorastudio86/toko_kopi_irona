import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { formatQty } from '../../utils/format';
import type { LowStockItem } from '../../types/product';

type Props = {
  items: LowStockItem[];
  productUnit: string;
  onViewInventory: () => void;
};

const POPOVER_WIDTH = 360;

export function LowStockBadge({ items, productUnit, onViewInventory }: Props) {
  const badgeRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; arrowLeft: number; above: boolean } | null>(
    null
  );

  const unitShort = productUnit.split(' (')[0] || 'porsi';

  function place() {
    const rect = badgeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedHeight = 110 + items.length * 112;
    const above = rect.bottom + 12 + estimatedHeight > window.innerHeight && rect.top > estimatedHeight;
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 16));
    setPosition({
      top: above ? rect.top - 12 : rect.bottom + 12,
      left,
      arrowLeft: rect.left - left + 20,
      above,
    });
  }

  function show() {
    window.clearTimeout(hideTimer.current);
    place();
    setOpen(true);
  }

  function scheduleHide() {
    if (pinned) return;
    hideTimer.current = window.setTimeout(() => setOpen(false), 150);
  }

  function close() {
    setOpen(false);
    setPinned(false);
  }

  // Tutup saat halaman digulir/ukuran berubah, atau klik di luar saat sedang "dikunci"
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!badgeRef.current?.contains(target) && !popoverRef.current?.contains(target)) close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        onClick={() => {
          if (pinned) {
            close();
          } else {
            show();
            setPinned(true);
          }
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded border border-dashed border-[#f43f5e] bg-white px-2 py-[3px] text-xs font-medium leading-4 text-[#e11d48] hover:bg-[#fff1f2]"
      >
        <AlertTriangle className="size-3" />
        Bahan Baku Menipis
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Peringatan ketersediaan bahan baku"
            onMouseEnter={() => window.clearTimeout(hideTimer.current)}
            onMouseLeave={scheduleHide}
            style={{
              top: position.top,
              left: position.left,
              width: POPOVER_WIDTH,
              transform: position.above ? 'translateY(-100%)' : undefined,
            }}
            className="fixed z-50 rounded-2xl border border-[#1e293b] bg-[#0f172a] p-4 font-['Plus_Jakarta_Sans_Variable',sans-serif] text-white shadow-[0px_20px_40px_-12px_rgba(0,0,0,0.45)] animate-in fade-in duration-100"
          >
            <span
              className={`absolute size-3 rotate-45 border-[#1e293b] bg-[#0f172a] ${
                position.above ? '-bottom-1.5 border-b border-r' : '-top-1.5 border-l border-t'
              }`}
              style={{ left: position.arrowLeft }}
            />

            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                <AlertTriangle className="size-4" />
              </span>
              <p className="text-sm font-semibold">Peringatan Ketersediaan Bahan Baku</p>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {items.map((item) => {
                const portions = item.qtyPerPortion > 0 ? Math.floor(item.currentStock / item.qtyPerPortion) : null;
                return (
                  <div key={`${item.itemType}:${item.itemId}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {item.name}
                        {item.itemType === 'racikan' && (
                          <span className="ml-1.5 text-xs font-normal text-[#94a3b8]">(racikan)</span>
                        )}
                      </p>
                      <span className="shrink-0 rounded bg-white px-2 py-0.5 text-xs font-semibold text-[#0f172a]">
                        Menipis
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 border-t border-white/10 pt-2">
                      <div>
                        <p className="text-xs text-[#94a3b8]">Stok Tersisa</p>
                        <p className="text-sm font-semibold">
                          {formatQty(item.currentStock)} {item.unitName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#94a3b8]">Batas Minimum</p>
                        <p className="text-sm font-semibold">
                          {formatQty(item.minStock)} {item.unitName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#94a3b8]">Estimasi Porsi</p>
                        <p className="text-sm font-semibold">
                          {portions !== null ? `± ${formatQty(portions)} ${unitShort}` : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  close();
                  onViewInventory();
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-white hover:underline"
              >
                Lihat di Inventory
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}