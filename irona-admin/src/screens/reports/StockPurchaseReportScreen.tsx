import { useEffect, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchStockPurchases } from '../../services/inventoryReports';
import type { StockPurchaseRow } from '../../types/inventoryReport';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import { formatDay, formatQty, formatUnitPrice } from './inventoryReportFormat';

/** "2 pack × 1.000 gr" kalau dibeli per kemasan, selain itu "2.000 gr" */
function qtyText(r: StockPurchaseRow): string {
  if (r.purchaseQty && r.purchaseUnit && r.purchaseUnit !== r.baseUnit) {
    return `${formatQty(r.purchaseQty)} ${r.purchaseUnit}${r.qtyPerPackage ? ` × ${formatQty(r.qtyPerPackage)} ${r.baseUnit}` : ''}`;
  }
  return `${formatQty(r.quantity)} ${r.baseUnit}`;
}

export default function StockPurchaseReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [search, setSearch] = useState('');

  const [rows, setRows] = useState<StockPurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStockPurchases(range.start, range.end)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) => !q || r.name.toLowerCase().includes(q) || (r.notes ?? '').toLowerCase().includes(q)
  );
  const totalValue = filtered.reduce((s, r) => s + r.totalPrice, 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<StockPurchaseRow>({
        fileName: `Laporan Pembelian ${range.start} sd ${range.end}`,
        title: 'Laporan Pembelian',
        subtitle: `Periode ${rangeText(range)}`,
        summary: [
          ['Total Nilai Pembelian', totalValue],
          ['Total Transaksi Pembelian', String(filtered.length)],
        ],
        sheets: [
          {
            name: 'Pembelian',
            rows: filtered,
            columns: [
              {
                header: 'Tanggal Beli',
                width: 14,
                type: 'date',
                value: (r) => parseLocalDate(r.movementDate),
              },
              { header: 'Nama Bahan', width: 30, value: (r) => r.name },
              { header: 'Jumlah', width: 22, value: qtyText },
              {
                header: 'Jumlah (satuan dasar)',
                width: 18,
                type: 'number',
                value: (r) => r.quantity,
              },
              { header: 'Satuan Dasar', width: 12, value: (r) => r.baseUnit },
              {
                header: 'Harga Beli (Total)',
                width: 18,
                type: 'currency',
                value: (r) => r.totalPrice,
              },
              {
                header: 'Harga / Satuan',
                width: 14,
                type: 'number',
                value: (r) => r.unitPrice,
              },
              { header: 'Supplier / Catatan', width: 28, value: (r) => r.notes ?? '' },
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
        title="Laporan Pembelian"
        info="Semua Stok Masuk bahan baku dari Kelola Stok. Supplier/toko diambil dari catatan yang diisi saat input stok masuk."
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari bahan / supplier..."
            className={`${filterClass} w-56 pl-8`}
            aria-label="Cari bahan atau supplier"
          />
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total Nilai Pembelian" value={totalValue} />
        <StatCard
          label="Total Transaksi Pembelian"
          value={filtered.length}
          format="number"
          hint="Berapa kali stok masuk dicatat"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Tanggal Beli</th>
                <th className={`${thClass} text-left`}>Nama Bahan</th>
                <th className={`${thClass} text-right`}>Jumlah</th>
                <th className={`${thClass} text-right`}>Harga Beli (Total)</th>
                <th className={`${thClass} text-left`}>Supplier / Catatan</th>
                <th className={`${thClass} pr-6 text-left`}>Dicatat Oleh</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#94a3b8]">
                    {rows.length
                      ? 'Pembelian tidak ditemukan.'
                      : 'Belum ada pembelian di periode ini.'}
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
                    <td className="py-3 pr-3 font-semibold text-[#0f172a]">{r.name}</td>
                    <td className="py-3 pr-3 text-right">
                      <p className="font-mono">{qtyText(r)}</p>
                      {r.unitPrice !== null && (
                        <p className="text-xs text-[#94a3b8]">
                          {formatUnitPrice(r.unitPrice)}/{r.baseUnit}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold text-[#0f172a]">
                      {formatRupiah(r.totalPrice)}
                    </td>
                    <td className="max-w-[260px] py-3 pr-3 text-[#475569]">{r.notes || '—'}</td>
                    <td className="py-3 pr-6 text-[#475569]">{r.createdByName ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
          itemLabel="pembelian"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
