import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { fetchTransactionItems } from '../../services/salesReports';
import type { SalesRow, TransactionItem } from '../../types/salesReport';
import { formatRupiah } from '../../utils/format';
import {
  BALANCE_STATUS_CLASSES,
  BALANCE_STATUS_LABELS,
  formatDate,
} from '../finance/cashFlowFormat';
import {
  CHANNEL_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_LABELS,
  formatDateTime,
  rpDetail,
} from './salesReportFormat';

function Line({
  label,
  value,
  tone,
  bold,
}: {
  label: ReactNode;
  value: string;
  tone?: 'minus' | 'muted';
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 text-xs ${bold ? 'border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold text-[#0f172a]' : 'text-[#475569]'}`}
    >
      <span>{label}</span>
      <span
        className={`font-mono ${tone === 'minus' ? 'text-[#be123c]' : tone === 'muted' ? 'text-[#94a3b8]' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Detail lengkap 1 transaksi: item, rincian harga, ongkir/biaya layanan, potongan gateway */
export default function TransactionDetailModal({
  row,
  onClose,
}: {
  row: SalesRow;
  onClose: () => void;
}) {
  const [items, setItems] = useState<TransactionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactionItems(row.id)
      .then(setItems)
      .catch((err) => setError(err?.message ?? 'Gagal memuat item.'));
  }, [row.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const online = row.channel === 'online';
  const fee = row.gatewayMdr + row.gatewayTax;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="font-mono text-base font-bold leading-6 text-[#0f172a]">
              {row.transactionNumber}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              {CHANNEL_LABELS[row.channel]} · {ORDER_TYPE_LABELS[row.orderType]} ·{' '}
              {PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod}
              {row.status !== 'selesai' && ' · ada refund'}
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

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <span className="text-[#64748b]">Waktu Order</span>
            <span className="text-right text-[#0f172a]">{formatDateTime(row.orderTime)}</span>
            <span className="text-[#64748b]">Waktu Bayar</span>
            <span className="text-right text-[#0f172a]">{formatDateTime(row.payTime)}</span>
            <span className="text-[#64748b]">Pelanggan</span>
            <span className="text-right text-[#0f172a]">{row.customerName || '—'}</span>
            {online ? (
              <>
                <span className="text-[#64748b]">Driver</span>
                <span className="text-right text-[#0f172a]">{row.driverName ?? '—'}</span>
                <span className="text-[#64748b]">Alamat</span>
                <span className="text-right text-[#0f172a]">
                  {row.address ?? '—'}
                  {row.distanceKm !== null && ` (${row.distanceKm.toLocaleString('id-ID')} km)`}
                </span>
              </>
            ) : (
              <>
                <span className="text-[#64748b]">Kasir</span>
                <span className="text-right text-[#0f172a]">{row.cashierName ?? '—'}</span>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <p className="pb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-[#64748b]">
              Item
            </p>
            {!items && !error && <p className="text-xs text-[#94a3b8]">Memuat item...</p>}
            {error && <p className="text-xs text-[#e11d48]">{error}</p>}
            {items?.map((i, idx) => (
              <div key={idx} className="flex justify-between gap-3 text-xs text-[#334155]">
                <span>
                  {i.quantity}× {i.productName}
                  <span className="pl-1.5 font-mono text-[#94a3b8]">
                    @{formatRupiah(i.unitPrice)}
                  </span>
                </span>
                <span className="font-mono">{formatRupiah(i.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-[#e2e8f0] p-4">
            <Line label="Subtotal produk" value={formatRupiah(row.subtotal)} />
            {row.discount > 0 && (
              <Line label="Diskon" value={`−${formatRupiah(row.discount)}`} tone="minus" />
            )}
            {online && row.priceAdjustment !== 0 && (
              <Line
                label="Termasuk penyesuaian harga online"
                value={formatRupiah(row.priceAdjustment)}
                tone="muted"
              />
            )}
            {online && <Line label="Ongkir" value={formatRupiah(row.deliveryFee)} />}
            {online && <Line label="Biaya layanan" value={formatRupiah(row.serviceFee)} />}
            <Line label="Total dibayar pelanggan" value={formatRupiah(row.totalPaid)} bold />
            {row.refund > 0 && (
              <Line label="Refund" value={`−${formatRupiah(row.refund)}`} tone="minus" />
            )}
            {fee > 0 && (
              <>
                <Line label="MDR gateway" value={`−${rpDetail(row.gatewayMdr)}`} tone="minus" />
                <Line label="PPN atas MDR" value={`−${rpDetail(row.gatewayTax)}`} tone="minus" />
                <Line label="Diterima dari Midtrans" value={rpDetail(row.totalPaid - fee)} bold />
              </>
            )}
          </div>

          {online && row.balanceStatus && (
            <p className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748b]">
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${BALANCE_STATUS_CLASSES[row.balanceStatus]}`}
              >
                {BALANCE_STATUS_LABELS[row.balanceStatus]}
              </span>
              {row.disbursedDate
                ? `Dicairkan ${formatDate(row.disbursedDate)}`
                : row.availableDate
                  ? `Bisa ditarik mulai ${formatDate(row.availableDate)}`
                  : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
