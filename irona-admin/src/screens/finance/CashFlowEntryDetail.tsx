import { useEffect, useState, type ReactNode } from 'react';
import {
  fetchAssetDetail,
  fetchExpense,
  fetchSalesOfDay,
  fetchStockInDetail,
} from '../../services/finance';
import { fetchTryErrorDetail } from '../../services/adjustments';
import type { CashFlowEntry } from '../../types/finance';
import { formatRupiah, formatRupiahDetail } from '../../utils/format';
import { formatMonthLabel } from '../../utils/date';
import { BUCKET_LABELS, formatDate, formatDateTime } from './cashFlowFormat';

type Props = { entry: CashFlowEntry };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs">
      <span className="text-[#64748b]">{label}</span>
      <span className="text-right font-medium text-[#0f172a]">{children}</span>
    </div>
  );
}

const ORDER_LABELS: Record<string, string> = {
  dine_in: 'Dine In',
  take_away: 'Take Away',
  online: 'Online',
};

/** Keterangan di mana data asal bisa dilihat/dikoreksi */
const SOURCE_HINTS: Partial<Record<CashFlowEntry['entryType'], string>> = {
  reversal_refund: 'Rincian refund ada di Penjualan › Penyesuaian Transaksi.',
  kasbon:
    'Rincian kasbon ada di Karyawan › Kasbon. Gaji bulan itu dibayar bersih (sudah dipotong).',
  pelunasan_kasbon: 'Kasbon dilunasi tunai oleh karyawan, uangnya dicatat masuk kembali.',
  bahan_baku: 'Tercatat juga di Produk › Kelola Stok (Stok Masuk).',
  pembelian_aset: 'Data aset ada di Produk › Aset Barang. Pembelian aset memotong saldo BEP.',
  try_error: 'Rincian ada di Penjualan › Penyesuaian Transaksi.',
};

/** Rincian 1 baris cash flow, tampil langsung di bawah barisnya (dropdown) */
export default function CashFlowEntryDetail({ entry: e }: Props) {
  const [content, setContent] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const show = (node: ReactNode) => !cancelled && setContent(node);

    async function load() {
      if (e.entryType === 'alokasi') {
        const sales = await fetchSalesOfDay(e.entryDate);
        const totalNet = sales.reduce((s, t) => s + t.net, 0);
        const ratio = totalNet ? e.amount / totalNet : 0;
        show(
          <div className="flex flex-col gap-1">
            <div className="flex justify-between pb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-[#64748b]">
              <span>{sales.length} transaksi</span>
              <span>Bersih → Jatah {BUCKET_LABELS[e.bucket]}</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {sales.map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between gap-3 border-b border-[#f1f5f9] py-1.5 text-xs last:border-b-0"
                >
                  <span className="text-[#334155]">
                    <span className="font-mono">{t.number}</span>
                    <span className="block text-[10px] text-[#94a3b8]">
                      {new Date(t.time).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {ORDER_LABELS[t.orderType] ?? t.orderType} ·{' '}
                      {t.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}
                      {t.fee > 0 && ` · MDR −${formatRupiahDetail(t.fee)}`}
                      {t.status !== 'selesai' && ' · direfund'}
                    </span>
                  </span>
                  <span className="text-right font-mono">
                    {formatRupiahDetail(t.net)}
                    <span className="block text-[10px] text-[#047857]">
                      +{formatRupiahDetail(Math.round(t.net * ratio * 100) / 100)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold text-[#0f172a]">
              <span>Penjualan Bersih {formatRupiah(totalNet)}</span>
              <span className="font-mono">+{formatRupiah(e.amount)}</span>
            </div>
          </div>
        );
      } else if (e.entryType === 'bahan_baku' && e.refId) {
        const d = await fetchStockInDetail(e.refId);
        show(
          <div className="divide-y divide-[#f1f5f9]">
            <Row label="Bahan">{d.materialName}</Row>
            <Row label="Pembelian">
              {d.purchaseQty.toLocaleString('id-ID')} {d.purchaseUnitName} ×{' '}
              {d.qtyPerPackage.toLocaleString('id-ID')} {d.unitName}
            </Row>
            <Row label="Stok bertambah">
              {d.quantity.toLocaleString('id-ID')} {d.unitName}
            </Row>
            <Row label="Harga per satuan">{formatRupiahDetail(d.unitPrice)}</Row>
            <Row label="Total Harga">{formatRupiah(d.totalPrice)}</Row>
            {d.notes && <Row label="Catatan">{d.notes}</Row>}
          </div>
        );
      } else if ((e.entryType === 'gaji' || e.entryType === 'pengeluaran_lain') && e.refId) {
        const x = await fetchExpense(e.refId);
        show(
          <div className="divide-y divide-[#f1f5f9]">
            <Row label="Nama">{x.name}</Row>
            {x.salaryMonth && <Row label="Bulan Gaji">{formatMonthLabel(x.salaryMonth)}</Row>}
            <Row label="Nominal">{formatRupiah(x.amount)}</Row>
            <Row label="Tanggal">{formatDate(x.expenseDate)}</Row>
            <Row label="Keterangan">{x.notes || '—'}</Row>
          </div>
        );
      } else if (e.entryType === 'try_error' && e.refId) {
        const t = await fetchTryErrorDetail(e.refId);
        show(
          <div className="flex flex-col gap-1">
            {t.lines.map((l, i) => (
              <div key={i} className="flex justify-between text-xs text-[#334155]">
                <span>
                  {l.itemName}{' '}
                  <span className="font-mono text-[#64748b]">
                    {l.quantity.toLocaleString('id-ID')} {l.unitName}
                  </span>
                </span>
                <span className="font-mono">{formatRupiahDetail(l.subtotal)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold">
              <span>Total Cost (+{t.addCostPercentage}%)</span>
              <span className="font-mono">{formatRupiahDetail(t.totalCost)}</span>
            </div>
          </div>
        );
      } else if (e.entryType === 'pembelian_aset' && e.refId) {
        const a = await fetchAssetDetail(e.refId);
        show(
          <div className="divide-y divide-[#f1f5f9]">
            <Row label="Aset">{a.name}</Row>
            <Row label="Harga × Jumlah">
              {formatRupiah(a.price)} × {a.quantity}
            </Row>
            <Row label="Tanggal Beli">{formatDate(a.purchaseDate)}</Row>
            <Row label="Status">{a.status}</Row>
            {a.notes && <Row label="Catatan">{a.notes}</Row>}
          </div>
        );
      }
    }

    load()
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat detail.'))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [e]);

  return (
    <div className="flex flex-col gap-3">
      {!loaded && <p className="text-xs text-[#94a3b8]">Memuat rincian...</p>}

      {content && (
        <div className="max-w-2xl rounded-xl border border-[#e2e8f0] bg-white p-4">{content}</div>
      )}

      {error && (
        <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          {error}
        </p>
      )}

      <p className="text-[11px] leading-4 text-[#94a3b8]">
        {e.entryType !== 'alokasi' &&
          `Dicatat ${formatDateTime(e.sortAt)} · tanggal ${formatDate(e.entryDate)}. `}
        {SOURCE_HINTS[e.entryType] ?? ''}
      </p>
    </div>
  );
}
