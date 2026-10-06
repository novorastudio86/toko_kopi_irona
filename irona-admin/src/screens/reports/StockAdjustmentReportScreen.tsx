import { useEffect, useState } from 'react';
import { Download, Eye, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchStockAdjustments } from '../../services/inventoryReports';
import type { AdjustmentReason, StockAdjustmentRow } from '../../types/inventoryReport';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import { formatDateTime } from './salesReportFormat';
import {
  ADJUSTMENT_CLASSES,
  ADJUSTMENT_LABELS,
  ITEM_TYPE_LABELS,
  formatDay,
  formatQty,
  formatUnitPrice,
} from './inventoryReportFormat';

const REASONS = Object.keys(ADJUSTMENT_LABELS) as AdjustmentReason[];

function ReasonBadge({ reason }: { reason: AdjustmentReason }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ADJUSTMENT_CLASSES[reason]}`}
    >
      {ADJUSTMENT_LABELS[reason]}
    </span>
  );
}

const signedQty = (r: StockAdjustmentRow) =>
  `${r.quantity > 0 ? '+' : ''}${formatQty(r.quantity)} ${r.unitName}`;

export default function StockAdjustmentReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState<'' | AdjustmentReason>('');

  const [rows, setRows] = useState<StockAdjustmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detail, setDetail] = useState<StockAdjustmentRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStockAdjustments(range.start, range.end)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) => (!reason || r.reason === reason) && (!q || r.name.toLowerCase().includes(q))
  );
  const plus = filtered.filter((r) => r.value > 0).reduce((s, r) => s + r.value, 0);
  const minus = filtered.filter((r) => r.value < 0).reduce((s, r) => s + r.value, 0);
  // Breakdown per jenis selalu dari semua jenis (tidak ikut filter jenis)
  const searched = rows.filter((r) => !q || r.name.toLowerCase().includes(q));
  const countByReason = REASONS.map((k) => ({
    reason: k,
    count: searched.filter((r) => r.reason === k).length,
  }));

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<StockAdjustmentRow>({
        fileName: `Laporan Penyesuaian Stok ${range.start} sd ${range.end}`,
        title: 'Laporan Penyesuaian Stok',
        subtitle: `Periode ${rangeText(range)}${reason ? ` · ${ADJUSTMENT_LABELS[reason]}` : ''}`,
        summary: [
          ['Total Kejadian', String(filtered.length)],
          ['Nilai Penambahan (+)', plus],
          ['Nilai Pengurangan (−)', minus],
          ['Nilai Bersih', plus + minus],
          ...countByReason.map(
            (c) => [`${ADJUSTMENT_LABELS[c.reason]}`, `${c.count}x`] as [string, string]
          ),
        ],
        sheets: [
          {
            name: 'Penyesuaian Stok',
            rows: filtered,
            columns: [
              {
                header: 'Tanggal',
                width: 14,
                type: 'date',
                value: (r) => parseLocalDate(r.movementDate),
              },
              { header: 'Nama Bahan', width: 30, value: (r) => r.name },
              { header: 'Jenis Item', width: 12, value: (r) => ITEM_TYPE_LABELS[r.itemType] },
              { header: 'Jenis Penyesuaian', width: 16, value: (r) => ADJUSTMENT_LABELS[r.reason] },
              { header: 'Jumlah', width: 14, type: 'number', value: (r) => r.quantity },
              { header: 'Satuan', width: 10, value: (r) => r.unitName },
              { header: 'Harga / Satuan', width: 14, type: 'number', value: (r) => r.unitPrice },
              { header: 'Nilai', width: 16, type: 'currency', value: (r) => r.value },
              { header: 'Keterangan', width: 36, value: (r) => r.notes ?? '' },
              { header: 'Dicatat Oleh', width: 18, value: (r) => r.createdByName ?? '—' },
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

  const filterClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';
  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Laporan Penyesuaian Stok"
        info="Semua penyesuaian stok dari Kelola Stok. Nilai = jumlah penyesuaian × harga per satuan saat itu (harga stok masuk terakhir sebelum tanggal penyesuaian)."
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama bahan..."
              className={`${filterClass} w-48 pl-8`}
              aria-label="Cari nama bahan"
            />
          </div>
          <select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as typeof reason);
              setPage(1);
            }}
            className={filterClass}
            aria-label="Jenis penyesuaian"
          >
            <option value="">Semua Jenis</option>
            {REASONS.map((k) => (
              <option key={k} value={k}>
                {ADJUSTMENT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </ReportDateFilter>

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Kejadian Penyesuaian"
          value={filtered.length}
          format="number"
          hint={
            <span className="flex flex-wrap gap-1.5 pt-1">
              {countByReason.map((c) => (
                <span
                  key={c.reason}
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${ADJUSTMENT_CLASSES[c.reason]}`}
                >
                  {ADJUSTMENT_LABELS[c.reason]}: {c.count}x
                </span>
              ))}
            </span>
          }
        />
        <StatCard
          label="Total Nilai Penyesuaian"
          value={plus + minus}
          hint="Bersih (penambahan + pengurangan)"
        />
        <StatCard label="Penambahan (+)" value={plus} />
        <StatCard label="Pengurangan (−)" value={minus} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Tanggal</th>
                <th className={`${thClass} text-left`}>Nama Bahan</th>
                <th className={`${thClass} text-left`}>Jenis Penyesuaian</th>
                <th className={`${thClass} text-right`}>Jumlah</th>
                <th className={`${thClass} text-right`}>Nilai</th>
                <th className={`${thClass} text-left`}>Keterangan</th>
                <th className={`${thClass} text-left`}>Dicatat Oleh</th>
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    {rows.length
                      ? 'Penyesuaian tidak ditemukan.'
                      : 'Belum ada penyesuaian stok di periode ini.'}
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => (
                  <tr
                    key={r.movementId}
                    className="border-t border-[#f1f5f9] text-sm first:border-t-0"
                  >
                    <td className="py-3 pl-6 pr-3 text-[#0f172a]">{formatDay(r.movementDate)}</td>
                    <td className="py-3 pr-3">
                      <span className="font-semibold text-[#0f172a]">{r.name}</span>
                      {r.itemType === 'racikan' && (
                        <span className="ml-1.5 text-xs text-[#6d28d9]">Racikan</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <ReasonBadge reason={r.reason} />
                    </td>
                    <td
                      className={`py-3 pr-3 text-right font-mono ${r.quantity < 0 ? 'text-[#be123c]' : 'text-[#047857]'}`}
                    >
                      {signedQty(r)}
                    </td>
                    <td
                      className={`py-3 pr-3 text-right font-mono ${r.value < 0 ? 'text-[#be123c]' : 'text-[#047857]'}`}
                    >
                      {formatRupiah(r.value)}
                    </td>
                    <td
                      className="max-w-[240px] truncate py-3 pr-3 text-[#475569]"
                      title={r.notes ?? ''}
                    >
                      {r.notes || '—'}
                    </td>
                    <td className="py-3 pr-3 text-[#475569]">{r.createdByName ?? '—'}</td>
                    <td className="py-3 pr-6 text-right">
                      <button
                        onClick={() => setDetail(r)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
                      >
                        <Eye className="size-3.5" />
                        Detail
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
          itemLabel="penyesuaian"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {detail && <AdjustmentDetailModal row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function AdjustmentDetailModal({ row, onClose }: { row: StockAdjustmentRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lines: [string, string][] = [
    ['Tanggal Penyesuaian', formatDay(row.movementDate)],
    ['Dicatat', `${formatDateTime(row.createdAt)} · ${row.createdByName ?? '—'}`],
    ['Jenis Item', ITEM_TYPE_LABELS[row.itemType]],
    ['Jumlah', signedQty(row)],
    ['Harga / Satuan', `${formatUnitPrice(row.unitPrice)}/${row.unitName}`],
    ['Nilai', formatRupiah(row.value)],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">{row.name}</h2>
            <div className="mt-1">
              <ReasonBadge reason={row.reason} />
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {lines.map(([label, value]) => (
              <div key={label} className="contents">
                <span className="text-[#64748b]">{label}</span>
                <span className="text-right font-medium text-[#0f172a]">{value}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.55px] text-[#64748b]">
              Keterangan
            </p>
            <p className="whitespace-pre-wrap rounded-lg bg-[#f8fafc] p-3 text-xs text-[#0f172a]">
              {row.notes || 'Tidak ada keterangan.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
