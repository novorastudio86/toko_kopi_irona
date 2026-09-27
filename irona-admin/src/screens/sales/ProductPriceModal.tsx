import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchProductPrices } from '../../services/orderTypes';
import { formatRupiah } from '../../utils/format';
import type { OrderTypeRule, ProductPrices } from '../../types/orderType';
import { SCOPE_LABELS, formatQty } from './orderTypeFormat';

function RuleLines({ ids, ruleById }: { ids: string[]; ruleById: Map<string, OrderTypeRule> }) {
  if (ids.length === 0)
    return <p className="text-[11px] text-[#94a3b8]">Tidak ada aturan yang kena produk ini.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {ids.map((id) => {
        const r = ruleById.get(id);
        if (!r) return null;
        return (
          <li key={id} className="flex items-start justify-between gap-3 text-[11px]">
            <span className="text-[#475569]">
              <span className="font-semibold text-[#0f172a]">
                {r.appliesToAllProducts ? 'Semua Produk' : 'Produk tertentu'} ·{' '}
                {SCOPE_LABELS[r.scope]}
              </span>
              <span className="block">
                {r.items
                  .map((i) => `${i.rawMaterialName} (${formatQty(i.quantity)} ${i.unitName})`)
                  .join(', ')}
              </span>
            </span>
            <span className="shrink-0 font-mono font-semibold text-[#0f172a]">
              + {formatRupiah(r.totalCost)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type Props = { productId: string; rules: OrderTypeRule[]; onClose: () => void };

/** Popup "Rincian Harga per Tipe": kenapa harga Take Away / Online segini */
export default function ProductPriceModal({ productId, rules, onClose }: Props) {
  const [prices, setPrices] = useState<ProductPrices | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProductPrices(productId)
      .then(setPrices)
      .catch((err) => setError(err?.message ?? 'Gagal memuat rincian harga.'));
  }, [productId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ruleById = new Map(rules.map((r) => [r.id, r]));

  const rowClass = 'flex flex-col gap-2 rounded-xl border border-[#e2e8f0] p-4';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Rincian Harga per Tipe</h2>
            <p className="text-xs leading-4 text-[#64748b]">{prices?.productName ?? 'Memuat...'}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-6">
          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}
          {prices && (
            <>
              <div className={rowClass}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0f172a]">Dine In</span>
                  <span className="font-mono text-sm font-bold text-[#0f172a]">
                    {formatRupiah(prices.dineInPrice)}
                  </span>
                </div>
                <p className="text-[11px] text-[#94a3b8]">
                  Harga jual dari Daftar Produk, tanpa biaya tambahan.
                </p>
              </div>

              <div className={rowClass}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0f172a]">Take Away</span>
                  <span className="font-mono text-sm font-bold text-[#0f172a]">
                    {formatRupiah(prices.takeAwayPrice)}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748b]">
                  Harga Dine In {formatRupiah(prices.dineInPrice)}
                </p>
                <RuleLines ids={prices.takeAwayRuleIds} ruleById={ruleById} />
              </div>

              <div className={rowClass}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0f172a]">Online</span>
                  <span className="font-mono text-sm font-bold text-[#0f172a]">
                    {formatRupiah(prices.onlinePrice)}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748b]">
                  Harga Dine In {formatRupiah(prices.dineInPrice)}
                </p>
                <RuleLines ids={prices.onlineRuleIds} ruleById={ruleById} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
