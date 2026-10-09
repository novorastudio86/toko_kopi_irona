import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { fetchPromotionClaims, fetchPromotionHistory } from '../../services/promotions';
import type { Promotion, PromotionClaim, PromotionHistoryEntry } from '../../types/promotion';
import { PromotionStatusBadge } from './PromotionStatusBadge';
import {
  CHANNEL_LABELS,
  PROMOTION_HISTORY_FIELDS,
  TYPE_LABELS,
  formatCriteria,
  formatDate,
  formatDays,
  formatHours,
  formatTargetValue,
  typeMeaning,
} from './discountFormat';

const ACTION_LABELS: Record<PromotionHistoryEntry['action'], string> = {
  dibuat: 'Dibuat',
  diubah: 'Diubah',
  diaktifkan: 'Diaktifkan',
  dinonaktifkan: 'Dinonaktifkan',
  dihapus: 'Dihapus',
};

const yesNo = (v: any) => (v ? 'Ya' : 'Tidak');

function diff(before: Record<string, any> | null, after: Record<string, any> | null) {
  if (!before || !after) return [];
  const fmt = (v: unknown) => (Array.isArray(v) ? v.join(', ') || '—' : v == null ? '—' : String(v));
  return Object.entries(PROMOTION_HISTORY_FIELDS)
    .filter(([k]) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map(([k, f]) => ({
      label: f.label,
      from: (f.format ?? fmt)(before[k]),
      to: (f.format ?? fmt)(after[k]),
    }));
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#f1f5f9] py-2 last:border-b-0">
      <span className="shrink-0 text-xs text-[#64748b]">{label}</span>
      <span className="text-right text-xs font-semibold text-[#0f172a]">{children}</span>
    </div>
  );
}

type Tab = 'info' | 'riwayat' | 'klaim';
type Props = { promotion: Promotion; onClose: () => void };

export default function DiscountDetailModal({ promotion: p, onClose }: Props) {
  // Riwayat Klaim hanya untuk voucher (Online + Manual)
  const isVoucher = p.channel === 'online' && p.promoType === 'manual';

  const [tab, setTab] = useState<Tab>('info');
  const [history, setHistory] = useState<PromotionHistoryEntry[]>([]);
  const [claims, setClaims] = useState<PromotionClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchPromotionHistory(p.id),
      isVoucher ? fetchPromotionClaims(p.id) : Promise.resolve([]),
    ])
      .then(([h, c]) => {
        setHistory(h);
        setClaims(c);
      })
      .catch((err) => setError(err?.message ?? 'Gagal memuat riwayat.'))
      .finally(() => setLoading(false));
  }, [p.id, isVoucher]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'riwayat', label: `Riwayat Perubahan (${history.length})` },
    ...(isVoucher ? [{ id: 'klaim' as Tab, label: `Riwayat Klaim (${claims.length})` }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-4 pt-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold leading-6 text-[#0f172a]">{p.name}</h2>
              <PromotionStatusBadge status={p.status} isUpcoming={p.isUpcoming} />
            </div>
            {p.description && <p className="text-xs leading-4 text-[#64748b]">{p.description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1.5 px-6 pt-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                tab === t.id
                  ? 'bg-[#0f172a] text-white'
                  : 'border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <p className="mb-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}

          {tab === 'info' && (
            <div className="flex flex-col">
              <Row label="Channel">{CHANNEL_LABELS[p.channel]}</Row>
              <Row label="Sasaran & Nilai">{formatTargetValue(p)}</Row>
              {p.discountTarget === 'produk' ? (
                <Row label="Cakupan Produk">
                  {p.appliesToAllProducts ? 'Semua Produk' : p.productNames.join(', ') || '—'}
                </Row>
              ) : (
                <Row label="Jarak Maksimal">
                  {p.maxDistanceKm ? `${p.maxDistanceKm} km` : 'Semua jarak'}
                </Row>
              )}
              <Row label="Tipe">
                {TYPE_LABELS[p.promoType]}
                <span className="block font-normal text-[#64748b]">
                  {typeMeaning(p.promoType, p.channel)}
                </span>
              </Row>
              <Row label="Target Pelanggan">
                {p.targetCustomer === 'member' ? 'Member' : 'Semua'}
              </Row>
              <Row label="Syarat">{formatCriteria(p)}</Row>
              {p.channel === 'online' && (
                <Row label="Maks 1× Klaim per Pelanggan">{yesNo(p.maxOneClaimPerCustomer)}</Row>
              )}
              {p.channel === 'offline' && (
                <Row label="Berlaku untuk Take Away">{yesNo(p.appliesToTakeAway)}</Row>
              )}
              <Row label="Periode">
                {formatDate(p.startDate)} – {formatDate(p.endDate)}
              </Row>
              <Row label="Hari & Jam">
                {formatDays(p.validDays)} · {formatHours(p.validStartTime, p.validEndTime)}
              </Row>
              <Row label="Dipakai di Transaksi">{p.usedCount}×</Row>
            </div>
          )}

          {tab === 'riwayat' && (
            <div className="flex flex-col gap-2">
              {loading && <p className="text-xs text-[#94a3b8]">Memuat riwayat...</p>}
              {!loading && history.length === 0 && (
                <p className="text-xs text-[#94a3b8]">Belum ada riwayat.</p>
              )}
              {history.map((h) => {
                const changes = diff(h.before, h.after);
                return (
                  <div key={h.id} className="rounded-xl border border-[#e2e8f0] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-xs font-bold text-white">
                        {ACTION_LABELS[h.action]}
                      </span>
                      <span className="text-xs text-[#64748b]">
                        {formatDateTime(h.createdAt)}
                      </span>
                    </div>
                    {h.action === 'diubah' && (
                      <ul className="flex flex-col gap-1 pt-2">
                        {changes.length === 0 && (
                          <li className="text-xs text-[#94a3b8]">Disimpan tanpa perubahan.</li>
                        )}
                        {changes.map((c) => (
                          <li key={c.label} className="text-xs text-[#334155]">
                            <span className="font-semibold">{c.label}:</span>{' '}
                            <span className="text-[#94a3b8] line-through">{c.from}</span> → {c.to}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'klaim' && (
            <>
              {loading && <p className="text-xs text-[#94a3b8]">Memuat klaim...</p>}
              {!loading && claims.length === 0 && (
                <p className="text-xs text-[#94a3b8]">
                  Belum ada pelanggan yang mengklaim voucher ini dari Web Customer.
                </p>
              )}
              {claims.length > 0 && (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-xs font-bold uppercase tracking-[0.4px] text-[#64748b]">
                      <th className="pb-2 text-left">Tanggal Klaim</th>
                      <th className="pb-2 text-left">Pelanggan</th>
                      <th className="pb-2 text-left">Status Pemakaian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((c) => (
                      <tr key={c.id} className="border-t border-[#f1f5f9]">
                        <td className="py-2 text-sm text-[#475569]">
                          {formatDateTime(c.claimedAt)}
                        </td>
                        <td className="py-2 text-sm font-semibold text-[#0f172a]">
                          {c.customerName}
                          <span className="block font-mono font-normal text-[#94a3b8]">
                            {c.phoneNumber}
                          </span>
                        </td>
                        <td className="py-2 text-sm">
                          {c.usedAt ? (
                            <span className="font-semibold text-[#059669]">Sudah dipakai</span>
                          ) : (
                            <span className="text-[#b45309]">Belum dipakai</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
