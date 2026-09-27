import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  fetchCustomerPurchases,
  fetchPointHistory,
  fetchStatusHistory,
} from '../../services/customers';
import { formatRupiah } from '../../utils/format';
import type {
  Customer,
  CustomerPurchase,
  PointHistory,
  PointType,
  StatusHistory,
} from '../../types/customer';

type Tab = 'pembelian' | 'poin' | 'status';

const ORDER_LABELS: Record<CustomerPurchase['orderType'], string> = {
  dine_in: 'Dine In',
  take_away: 'Take Away',
  online: 'Online',
};

const POINT_LABELS: Record<PointType, string> = {
  earn: 'Dari Transaksi',
  redeem: 'Redeem Reward',
  redeem_cancel: 'Pembatalan Redeem',
  adjust: 'Penyesuaian Manual',
  refund_reversal: 'Penyesuaian akibat Refund',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PurchaseStatus({ status }: { status: CustomerPurchase['status'] }) {
  if (status === 'selesai') return null;
  const label =
    status === 'refund_sebagian'
      ? 'Direfund Sebagian'
      : status === 'refund_penuh'
        ? 'Direfund'
        : 'Dibatalkan';
  return (
    <span className="rounded-full border border-dashed border-[#f43f5e] px-2 py-0.5 text-[10px] font-bold text-[#e11d48]">
      {label}
    </span>
  );
}

type Props = { customer: Customer; onClose: () => void };

export default function CustomerDetailModal({ customer, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('pembelian');
  const [purchases, setPurchases] = useState<CustomerPurchase[]>([]);
  const [points, setPoints] = useState<PointHistory[]>([]);
  const [statuses, setStatuses] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchCustomerPurchases(customer.id),
      fetchPointHistory(customer.id),
      fetchStatusHistory(customer.id),
    ])
      .then(([p, pt, st]) => {
        setPurchases(p);
        setPoints(pt);
        setStatuses(st);
      })
      .catch((err) => setError(err?.message ?? 'Gagal memuat riwayat.'))
      .finally(() => setLoading(false));
  }, [customer.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pembelian', label: `Riwayat Pembelian (${purchases.length})` },
    { id: 'poin', label: `Riwayat Poin (${points.length})` },
    { id: 'status', label: `Riwayat Status (${statuses.length})` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-4 pt-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold leading-6 text-[#0f172a]">{customer.name}</h2>
              {!customer.isActive && (
                <span className="rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#475569]">
                  Nonaktif
                </span>
              )}
            </div>
            <p className="font-mono text-xs leading-4 text-[#64748b]">{customer.phoneNumber}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-4 gap-3 border-b border-[#e2e8f0] px-6 py-4">
          {[
            { label: 'Poin Saat Ini', value: `${customer.pointsBalance}` },
            { label: 'Total Transaksi', value: `${customer.totalTransactions}` },
            { label: 'Total Belanja', value: formatRupiah(customer.totalSpent) },
            {
              label: 'Terdaftar',
              value: new Date(customer.registeredAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#94a3b8]">
                {s.label}
              </p>
              <p className="font-mono text-sm font-bold text-[#0f172a]">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 gap-1.5 px-6 pt-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
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
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}
          {loading && <p className="py-6 text-center text-xs text-[#94a3b8]">Memuat riwayat...</p>}

          {!loading && tab === 'pembelian' && (
            <div className="flex flex-col gap-2">
              {purchases.length === 0 && (
                <p className="py-6 text-center text-xs text-[#94a3b8]">Belum ada transaksi.</p>
              )}
              {purchases.map((p) => {
                const refunded = p.status === 'refund_penuh' || p.status === 'dibatalkan';
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border border-[#e2e8f0] px-4 py-3 ${refunded ? 'bg-[#fcfcfd]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#0f172a]">
                          {p.transactionNumber}
                        </span>
                        <span className="text-[11px] text-[#64748b]">
                          {formatDateTime(p.date)} · {ORDER_LABELS[p.orderType]}
                        </span>
                        <PurchaseStatus status={p.status} />
                      </div>
                      <span
                        className={`font-mono text-xs font-bold ${refunded ? 'text-[#94a3b8] line-through' : 'text-[#0f172a]'}`}
                      >
                        {formatRupiah(p.amount)}
                      </span>
                    </div>
                    <p className="pt-1 text-[11px] leading-4 text-[#64748b]">
                      {p.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                    </p>
                    {p.refundedAmount > 0 && p.status === 'refund_sebagian' && (
                      <p className="pt-1 text-[11px] font-semibold text-[#e11d48]">
                        Refund {formatRupiah(p.refundedAmount)} · dihitung{' '}
                        {formatRupiah(p.amount - p.refundedAmount)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && tab === 'poin' && (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#64748b]">
                  <th className="pb-2 text-left">Tanggal</th>
                  <th className="pb-2 text-left">Sumber</th>
                  <th className="pb-2 text-left">Keterangan</th>
                  <th className="pb-2 text-right">Poin</th>
                  <th className="pb-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {points.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-[#94a3b8]">
                      Belum ada riwayat poin.
                    </td>
                  </tr>
                )}
                {points.map((p) => (
                  <tr key={p.id} className="border-t border-[#f1f5f9] align-top">
                    <td className="py-2.5 pr-3 text-[11px] text-[#475569]">
                      {formatDateTime(p.date)}
                    </td>
                    <td className="py-2.5 pr-3 text-[11px] font-semibold text-[#0f172a]">
                      {POINT_LABELS[p.type]}
                    </td>
                    <td className="py-2.5 pr-3 text-[11px] text-[#64748b]">
                      {p.notes ?? '—'}
                      {p.transactionNumber && (
                        <span className="block font-mono text-[#94a3b8]">
                          {p.transactionNumber}
                        </span>
                      )}
                      {p.createdByName && (
                        <span className="block text-[#94a3b8]">oleh {p.createdByName}</span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono text-xs font-bold ${p.change > 0 ? 'text-[#059669]' : 'text-[#e11d48]'}`}
                    >
                      {p.change > 0 ? `+${p.change}` : p.change}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-[#475569]">
                      {p.balanceAfter ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && tab === 'status' && (
            <div className="flex flex-col gap-2">
              {statuses.length === 0 && (
                <p className="py-6 text-center text-xs text-[#94a3b8]">
                  Status belum pernah diubah (aktif sejak terdaftar).
                </p>
              )}
              {statuses.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#e2e8f0] px-4 py-3"
                >
                  <div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.isActive
                          ? 'bg-[#0f172a] text-white'
                          : 'border border-dashed border-[#94a3b8] bg-[#f1f5f9] text-[#475569]'
                      }`}
                    >
                      {s.isActive ? 'Diaktifkan' : 'Dinonaktifkan'}
                    </span>
                    <p className="pt-1.5 text-xs text-[#334155]">"{s.reason}"</p>
                  </div>
                  <p className="shrink-0 text-right text-[11px] text-[#64748b]">
                    {formatDateTime(s.date)}
                    {s.changedByName && <span className="block">oleh {s.changedByName}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
