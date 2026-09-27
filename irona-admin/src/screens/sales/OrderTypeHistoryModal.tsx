import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchOrderTypeHistory } from '../../services/orderTypes';
import { formatRupiah } from '../../utils/format';
import type { RuleHistoryEntry, RuleSnapshot } from '../../types/orderType';
import { SCOPE_LABELS, formatQty } from './orderTypeFormat';

const ACTION_LABELS: Record<RuleHistoryEntry['action'], string> = {
  dibuat: 'Aturan Dibuat',
  diubah: 'Aturan Diubah',
  dihapus: 'Aturan Dihapus',
};

function describe(s: RuleSnapshot) {
  return {
    scope: SCOPE_LABELS[s.scope],
    products: s.applies_to_all_products ? 'Semua Produk' : s.product_names.join(', ') || '—',
    items:
      s.items.map((i) => `${i.name} (${formatQty(Number(i.quantity))} ${i.unit})`).join(', ') ||
      '—',
    total: formatRupiah(Number(s.total_cost ?? 0)),
  };
}

const LABELS = {
  scope: 'Berlaku untuk',
  products: 'Cakupan',
  items: 'Bahan',
  total: 'Total Biaya',
} as const;

type Props = { onClose: () => void };

export default function OrderTypeHistoryModal({ onClose }: Props) {
  const [history, setHistory] = useState<RuleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrderTypeHistory()
      .then(setHistory)
      .catch((err) => setError(err?.message ?? 'Gagal memuat riwayat.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              Riwayat Perubahan Aturan
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Tambah, ubah, dan hapus aturan Take Away / Online.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto p-6">
          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}
          {loading && <p className="py-6 text-center text-xs text-[#94a3b8]">Memuat riwayat...</p>}
          {!loading && history.length === 0 && (
            <p className="py-6 text-center text-xs text-[#94a3b8]">Belum ada perubahan aturan.</p>
          )}
          {history.map((h) => {
            const before = h.before ? describe(h.before) : null;
            const after = h.after ? describe(h.after) : null;
            const keys = Object.keys(LABELS) as (keyof typeof LABELS)[];
            return (
              <div key={h.id} className="rounded-xl border border-[#e2e8f0] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      h.action === 'dihapus'
                        ? 'bg-[#fff1f2] text-[#e11d48]'
                        : 'bg-[#0f172a] text-white'
                    }`}
                  >
                    {ACTION_LABELS[h.action]}
                  </span>
                  <span className="text-[11px] text-[#64748b]">
                    {new Date(h.createdAt).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {h.changedByName && ` · oleh ${h.changedByName}`}
                  </span>
                </div>
                <ul className="flex flex-col gap-1 pt-2">
                  {keys.map((k) => {
                    if (h.action === 'diubah') {
                      if (!before || !after || before[k] === after[k]) return null;
                      return (
                        <li key={k} className="text-[11px] text-[#334155]">
                          <span className="font-semibold">{LABELS[k]}:</span>{' '}
                          <span className="text-[#94a3b8] line-through">{before[k]}</span> →{' '}
                          {after[k]}
                        </li>
                      );
                    }
                    const snap = after ?? before;
                    return snap ? (
                      <li key={k} className="text-[11px] text-[#334155]">
                        <span className="font-semibold">{LABELS[k]}:</span> {snap[k]}
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
