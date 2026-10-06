import { useEffect, useState } from 'react';
import { Download, Eye, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchAdjustments } from '../../services/adjustments';
import type { Adjustment, AdjustmentType } from '../../types/adjustment';
import { formatRupiah } from '../../utils/format';
import { toLocalISO, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import AdjustmentDetailModal from '../sales/AdjustmentDetailModal';
import { AdjustmentTypeBadge } from '../sales/AdjustmentBadges';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import { formatDateTime } from './salesReportFormat';

const TYPE_LABELS: Record<AdjustmentType, string> = {
  refund: 'Refund Transaksi',
  try_error: 'Try & Error Produk',
};

export default function AdjustmentReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [type, setType] = useState<'' | AdjustmentType>('');
  const [items, setItems] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detail, setDetail] = useState<Adjustment | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdjustments()
      .then((list) => !cancelled && setItems(list))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat penyesuaian.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const inRange = items.filter((a) => {
    const d = toLocalISO(new Date(a.createdAt));
    return d >= range.start && d <= range.end;
  });
  const filtered = type ? inRange.filter((a) => a.adjustmentType === type) : inRange;
  const stat = (t: AdjustmentType) => {
    const list = inRange.filter((a) => a.adjustmentType === t);
    return { count: list.length, amount: list.reduce((s, a) => s + a.amount, 0) };
  };
  const refund = stat('refund');
  const tne = stat('try_error');

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<Adjustment>({
        fileName: `Laporan Penyesuaian ${range.start} sd ${range.end}`,
        title: 'Laporan Penyesuaian',
        subtitle: `Periode ${rangeText(range)}${type ? ` · ${TYPE_LABELS[type]}` : ''}`,
        summary: [
          [`Refund Transaksi (${refund.count} kejadian)`, refund.amount],
          [`Try & Error Produk (${tne.count} kejadian)`, tne.amount],
        ],
        sheets: [
          {
            name: 'Penyesuaian',
            rows: filtered,
            columns: [
              { header: 'Tanggal', width: 18, value: (a) => formatDateTime(a.createdAt) },
              { header: 'Tipe', width: 18, value: (a) => TYPE_LABELS[a.adjustmentType] },
              { header: 'Referensi', width: 24, value: (a) => a.reference },
              { header: 'Keterangan', width: 36, value: (a) => a.notes },
              { header: 'Nominal', width: 16, type: 'currency', value: (a) => a.amount },
              { header: 'Dicatat Oleh', width: 18, value: (a) => a.recordedByName },
            ],
          },
        ],
      });
    } catch (err: any) {
      setError(err?.message ?? 'Gagal mengekspor.');
    } finally {
      setExporting(false);
    }
  }

  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Laporan Penyesuaian"
        info="Rekap refund transaksi dan try & error produk dari Penjualan › Penyesuaian Transaksi."
        badge={rangeText(range)}
        action={
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-50"
          >
            <Download className="size-4" />
            {exporting ? 'Mengekspor...' : 'Ekspor Laporan'}
          </button>
        }
      />

      <ReportDateFilter
        preset={preset}
        range={range}
        today={today}
        onChange={(p, r) => {
          setPreset(p);
          setRange(r);
          setPage(1);
        }}
      >
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as '' | AdjustmentType);
            setPage(1);
          }}
          className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs outline-none"
          aria-label="Tipe"
        >
          <option value="">Semua Tipe</option>
          <option value="refund">Refund Transaksi</option>
          <option value="try_error">Try & Error Produk</option>
        </select>
      </ReportDateFilter>

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          { label: 'Total Refund Transaksi', s: refund },
          { label: 'Total Try & Error Produk', s: tne },
        ].map(({ label, s }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-white p-5"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">
                {label}
              </p>
              <p className="pt-1 font-mono text-xl font-bold text-[#0f172a]">
                {formatRupiah(s.amount)}
              </p>
            </div>
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-semibold text-[#334155]">
              {s.count} kejadian
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Tanggal</th>
                <th className={`${thClass} text-left`}>Tipe</th>
                <th className={`${thClass} text-left`}>Referensi</th>
                <th className={`${thClass} text-left`}>Keterangan</th>
                <th className={`${thClass} text-right`}>Nominal</th>
                <th className={`${thClass} text-left`}>Dicatat Oleh</th>
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#94a3b8]">
                    Tidak ada penyesuaian di periode ini.
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-[#f1f5f9] first:border-t-0 text-xs text-[#475569]"
                  >
                    <td className="whitespace-nowrap py-3 pl-6 pr-3">
                      {formatDateTime(a.createdAt)}
                    </td>
                    <td className="py-3 pr-3">
                      <AdjustmentTypeBadge type={a.adjustmentType} />
                    </td>
                    <td className="py-3 pr-3 font-semibold text-[#0f172a]">{a.reference}</td>
                    <td className="max-w-[280px] py-3 pr-3">
                      <span className="line-clamp-2">{a.notes || '—'}</span>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold text-[#0f172a]">
                      {formatRupiah(a.amount)}
                    </td>
                    <td className="py-3 pr-3">{a.recordedByName ?? '—'}</td>
                    <td className="py-3 pr-6 text-right">
                      <button
                        onClick={() => setDetail(a)}
                        aria-label="Detail"
                        className="rounded-lg p-1.5 text-[#475569] hover:bg-[#f1f5f9]"
                      >
                        <Eye className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
          itemLabel="catatan"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {detail && <AdjustmentDetailModal adjustment={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
