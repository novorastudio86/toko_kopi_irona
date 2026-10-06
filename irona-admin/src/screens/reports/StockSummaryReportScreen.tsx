import { useEffect, useState } from 'react';
import { AlertTriangle, Download, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchStockSummary } from '../../services/inventoryReports';
import type { MaterialType, StockItemType, StockSummaryRow } from '../../types/inventoryReport';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import {
  ITEM_TYPE_CLASSES,
  ITEM_TYPE_LABELS,
  MATERIAL_TYPE_LABELS,
  formatDay,
  formatQty,
  formatUnitPrice,
} from './inventoryReportFormat';

export default function StockSummaryReportScreen() {
  const [today] = useState(todayISO);
  const [date, setDate] = useState(todayISO);
  const [search, setSearch] = useState('');
  const [itemType, setItemType] = useState<'' | StockItemType>('');
  const [materialType, setMaterialType] = useState<'' | MaterialType>('');

  const [rows, setRows] = useState<StockSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStockSummary(date)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const q = search.trim().toLowerCase();
  const filtered = rows
    .filter(
      (r) =>
        (!itemType || r.itemType === itemType) &&
        (!materialType || r.materialType === materialType) &&
        (!q || r.name.toLowerCase().includes(q))
    )
    .sort((a, b) => b.totalValue - a.totalValue);
  const valueOf = (t: StockItemType) =>
    filtered.filter((r) => r.itemType === t).reduce((s, r) => s + r.totalValue, 0);
  const rawValue = valueOf('bahan_baku');
  const racikanValue = valueOf('racikan');
  const negativeCount = filtered.filter((r) => r.quantity < 0).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const categoryText = (r: StockSummaryRow) =>
    r.materialType ? MATERIAL_TYPE_LABELS[r.materialType] : 'Racikan';

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<StockSummaryRow>({
        fileName: `Laporan Ringkasan Persediaan ${date}`,
        title: 'Laporan Ringkasan Persediaan',
        subtitle: `Per akhir ${formatDay(date)}`,
        summary: [
          ['Total Nilai Persediaan', rawValue + racikanValue],
          ['Nilai Bahan Baku', rawValue],
          ['Nilai Racikan', racikanValue],
        ],
        sheets: [
          {
            name: 'Persediaan',
            rows: filtered,
            columns: [
              { header: 'Nama Item', width: 30, value: (r) => r.name },
              { header: 'Jenis', width: 12, value: (r) => ITEM_TYPE_LABELS[r.itemType] },
              { header: 'Kategori', width: 16, value: categoryText },
              { header: 'Kuantitas', width: 14, type: 'number', value: (r) => r.quantity },
              { header: 'Satuan', width: 10, value: (r) => r.unitName },
              {
                header: 'Harga Modal / Satuan',
                width: 18,
                type: 'number',
                value: (r) => r.unitPrice,
              },
              { header: 'Total Nilai', width: 18, type: 'currency', value: (r) => r.totalValue },
              { header: 'Status', width: 10, value: (r) => (r.isActive ? 'Aktif' : 'Nonaktif') },
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
  const resetPage = () => setPage(1);

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Laporan Ringkasan Persediaan"
        info="Posisi stok pada akhir tanggal yang dipilih (stok sekarang dikurangi semua pergerakan setelah tanggal itu). Harga modal bahan baku = harga stok masuk terakhir s.d. tanggal itu; racikan = biaya per satuan dari harga bahan terkini. Jenis Racikan = bahan setengah jadi (mis. sirup) hasil produksi."
        badge={`Per ${formatDay(date)}`}
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b]">Tanggal snapshot</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                resetPage();
              }
            }}
            className={filterClass}
            aria-label="Tanggal snapshot"
          />
          {date !== today && (
            <button
              onClick={() => setDate(today)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
            >
              Hari ini
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              placeholder="Cari nama item..."
              className={`${filterClass} w-48 pl-8`}
              aria-label="Cari nama item"
            />
          </div>
          <select
            value={materialType}
            onChange={(e) => {
              setMaterialType(e.target.value as typeof materialType);
              resetPage();
            }}
            className={filterClass}
            aria-label="Kategori"
          >
            <option value="">Semua Kategori</option>
            <option value="tetap">Barang Tetap</option>
            <option value="menyusut">Bahan Menyusut</option>
          </select>
          <select
            value={itemType}
            onChange={(e) => {
              setItemType(e.target.value as typeof itemType);
              resetPage();
            }}
            className={filterClass}
            aria-label="Jenis"
          >
            <option value="">Semua Jenis</option>
            <option value="bahan_baku">Bahan Baku</option>
            <option value="racikan">Racikan</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Nilai Persediaan"
          value={rawValue + racikanValue}
          tone="dark"
          hint={`${filtered.length} item`}
        />
        <StatCard label="Nilai Bahan Baku" value={rawValue} />
        <StatCard label="Nilai Racikan" value={racikanValue} />
      </div>

      {negativeCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-xs text-[#92400e]">
          <AlertTriangle className="size-4 shrink-0" />
          {negativeCount} item stoknya minus pada tanggal ini (pemakaian tercatat sebelum stok
          masuk). Nilainya dihitung 0.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Nama Item</th>
                <th className={`${thClass} text-left`}>Jenis</th>
                <th className={`${thClass} text-left`}>Kategori</th>
                <th className={`${thClass} text-right`}>Kuantitas</th>
                <th className={`${thClass} text-left`}>Satuan</th>
                <th className={`${thClass} text-right`}>Harga Modal / Satuan</th>
                <th className={`${thClass} pr-6 text-right`}>Total Nilai</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#94a3b8]">
                    {rows.length ? 'Item tidak ditemukan.' : 'Belum ada persediaan.'}
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => (
                  <tr
                    key={`${r.itemType}-${r.itemId}`}
                    className="border-t border-[#f1f5f9] text-sm first:border-t-0"
                  >
                    <td className="py-3 pl-6 pr-3">
                      <span className="font-semibold text-[#0f172a]">{r.name}</span>
                      {!r.isActive && (
                        <span className="ml-1.5 rounded-full border border-dashed border-[#94a3b8] px-1.5 py-0.5 text-xs font-bold text-[#64748b]">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ITEM_TYPE_CLASSES[r.itemType]}`}
                      >
                        {ITEM_TYPE_LABELS[r.itemType]}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-[#475569]">{categoryText(r)}</td>
                    <td
                      className={`py-3 pr-3 text-right font-mono ${r.quantity < 0 ? 'text-[#be123c]' : ''}`}
                    >
                      {formatQty(r.quantity)}
                    </td>
                    <td className="py-3 pr-3 text-[#475569]">{r.unitName}</td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {formatUnitPrice(r.unitPrice)}
                    </td>
                    <td className="py-3 pr-6 text-right font-mono font-semibold text-[#0f172a]">
                      {formatRupiah(r.totalValue)}
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
          itemLabel="item"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            resetPage();
          }}
        />
      </div>
    </div>
  );
}
