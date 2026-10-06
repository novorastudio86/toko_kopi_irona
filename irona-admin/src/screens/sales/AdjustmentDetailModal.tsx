import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchRefundDetail, fetchTryErrorDetail } from '../../services/adjustments';
import type { Adjustment, RefundableTransaction, TryErrorDetail } from '../../types/adjustment';
import { formatRupiah, formatRupiahDetail } from '../../utils/format';
import { AdjustmentTypeBadge, ProductStatusBadge } from './AdjustmentBadges';
import {
  ORDER_TYPE_LABELS,
  TNE_TYPE_LABELS,
  formatDateTime,
  formatNumber,
} from './adjustmentFormat';

type Props = {
  adjustment: Adjustment;
  onClose: () => void;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs">
      <span className="text-[#64748b]">{label}</span>
      <span className="text-right font-medium text-[#0f172a]">{children}</span>
    </div>
  );
}

export default function AdjustmentDetailModal({ adjustment: a, onClose }: Props) {
  const [refund, setRefund] = useState<{
    transaction: RefundableTransaction | null;
    pointsReversed: number;
  } | null>(null);
  const [tne, setTne] = useState<TryErrorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load =
      a.adjustmentType === 'refund' && a.transactionId
        ? fetchRefundDetail(a.transactionId).then(setRefund)
        : fetchTryErrorDetail(a.id).then(setTne);
    load.catch((err) => setError(err?.message ?? 'Gagal memuat detail.'));
  }, [a]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tx = refund?.transaction;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Detail Penyesuaian</h2>
            <AdjustmentTypeBadge type={a.adjustmentType} />
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          <div className="divide-y divide-[#f1f5f9]">
            <Row label="Tanggal Dicatat">{formatDateTime(a.createdAt)}</Row>
            <Row label="Dicatat Oleh">{a.recordedByName ?? '—'}</Row>
            {a.adjustmentType === 'refund' ? (
              <>
                <Row label={a.channel === 'online' ? 'ID Pesanan' : 'No Transaksi'}>
                  <span className="font-mono">{a.reference}</span>
                </Row>
                <Row label="Channel">{a.channel === 'online' ? 'Online' : 'Offline'}</Row>
                {tx && (
                  <Row label="Waktu Transaksi">
                    {formatDateTime(tx.transactionDate)} · {ORDER_TYPE_LABELS[tx.orderType]} ·{' '}
                    {tx.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}
                  </Row>
                )}
                <Row label="Pelanggan">
                  {a.customerName || '—'}
                  {a.customerId ? ' (Member)' : ''}
                </Row>
                <Row label="Status Produk">
                  {a.productStatus && <ProductStatusBadge status={a.productStatus} />}
                </Row>
                <Row label="Stok">
                  {a.productStatus === 'belum_dibuat' ? 'Dikembalikan' : 'Tidak dikembalikan'}
                </Row>
                {a.customerId && refund && (
                  <Row label="Poin Ditarik">{refund.pointsReversed} poin</Row>
                )}
              </>
            ) : (
              <>
                <Row label="Tipe">{a.tneType ? TNE_TYPE_LABELS[a.tneType] : '—'}</Row>
                {a.tneType !== 'racikan_baru' && <Row label="Resep">{a.reference}</Row>}
                {tne && a.tneType !== 'racikan_baru' && (
                  <Row label="Jumlah Porsi">{formatNumber(tne.quantity)}</Row>
                )}
              </>
            )}
            <Row label={a.adjustmentType === 'refund' ? 'Alasan' : 'Catatan'}>{a.notes || '—'}</Row>
          </div>

          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}

          {a.adjustmentType === 'refund' && tx && (
            <div className="flex flex-col gap-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <p className="pb-1 text-xs font-bold uppercase tracking-[0.5px] text-[#64748b]">
                Produk Transaksi
              </p>
              {tx.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs text-[#334155]">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span className="font-mono">{formatRupiah(item.lineTotal)}</span>
                </div>
              ))}
              {tx.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-[#64748b]">
                  <span>Diskon</span>
                  <span className="font-mono">-{formatRupiah(tx.discountAmount)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold text-[#0f172a]">
                <span>Nominal Refund</span>
                <span className="font-mono">{formatRupiah(a.amount)}</span>
              </div>
            </div>
          )}

          {a.adjustmentType === 'try_error' && tne && (
            <div className="flex flex-col gap-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <p className="pb-1 text-xs font-bold uppercase tracking-[0.5px] text-[#64748b]">
                Bahan Terpotong
              </p>
              {tne.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-3 text-xs text-[#334155]">
                  <span>
                    {l.itemName}
                    <span className="pl-1.5 font-mono text-[#64748b]">
                      {formatNumber(l.quantity)} {l.unitName}
                    </span>
                  </span>
                  <span className="font-mono">{formatRupiahDetail(l.subtotal)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-[#e2e8f0] pt-2 text-xs text-[#64748b]">
                <span>Cost</span>
                <span className="font-mono">{formatRupiahDetail(tne.cost)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Add Cost</span>
                <span className="font-mono">{formatNumber(tne.addCostPercentage)}%</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold text-[#0f172a]">
                <span>Total Cost</span>
                <span className="font-mono">{formatRupiahDetail(tne.totalCost)}</span>
              </div>
            </div>
          )}

          <p className="text-xs leading-4 text-[#94a3b8]">
            Catatan penyesuaian bersifat final dan tidak bisa diubah atau dihapus.
          </p>
        </div>
      </div>
    </div>
  );
}
