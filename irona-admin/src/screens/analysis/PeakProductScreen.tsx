import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchCategories } from '../../services/categories';
import { fetchProductList } from '../../services/products';
import { fetchPeakProducts } from '../../services/trendReports';
import type { Category } from '../../types/category';
import type { ProductListItem } from '../../types/product';
import type { PeakCell } from '../../types/trendReport';
import { todayISO } from '../../utils/date';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from '../reports/ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from '../reports/reportRange';
import PeakHeatmap from './PeakHeatmap';
import { DAY_NAMES, aggregatePeak, hourLabel } from './peakData';

const unitText = (n: number) => `${n.toLocaleString('id-ID')} terjual`;

export default function PeakProductScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [categoryId, setCategoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [productQuery, setProductQuery] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [cells, setCells] = useState<PeakCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchProductList()])
      .then(([c, p]) => {
        setCategories(c);
        setProducts(p.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPeakProducts({
      start: range.start,
      end: range.end,
      productId: productId || null,
      categoryId: categoryId || null,
    })
      .then((c) => !cancelled && setCells(c))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat analisa.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, productId, categoryId]);

  // Kategori mempersempit pilihan produk
  const productOptions = products.filter((p) => !categoryId || p.categoryId === categoryId);
  const selected = products.find((p) => p.id === productId);
  const { byHour, total, peakHour, peakDow } = aggregatePeak(cells, (c) => c.quantity);
  const hourRows = byHour
    .map((qty, hour) => ({ hour, qty }))
    .sort((a, b) => b.qty - a.qty || a.hour - b.hour);

  const totalPages = Math.max(1, Math.ceil(hourRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = hourRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function pickProduct(name: string) {
    setProductQuery(name);
    const match = productOptions.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
    if (match) {
      setProductId(match.id);
      setPage(1);
    } else if (!name.trim()) {
      setProductId('');
      setPage(1);
    }
  }

  const filterClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';
  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        breadcrumb={['Analisa Tren & Margin', 'Waktu Teramai Produk']}
        title="Waktu Teramai Produk"
        info="Jumlah unit terjual per jam & hari (WIB) dari transaksi yang dibayar (tanpa yang dibatalkan/direfund penuh). Pilih satu produk untuk melihat pola khusus produk itu, atau biarkan Semua Produk untuk total."
        badge={rangeText(range)}
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
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              // Produk terpilih di luar kategori baru → kembali ke Semua Produk
              if (selected && e.target.value && selected.categoryId !== e.target.value) {
                setProductId('');
                setProductQuery('');
              }
              setPage(1);
            }}
            className={filterClass}
            aria-label="Kategori"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <input
              list="peak-product-options"
              value={productQuery}
              onChange={(e) => pickProduct(e.target.value)}
              placeholder="Semua Produk (ketik untuk cari)"
              className={`${filterClass} w-60 pr-8 ${productId ? 'border-[#0f172a] font-semibold' : ''}`}
              aria-label="Pilih produk"
            />
            <datalist id="peak-product-options">
              {productOptions.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            {productQuery && (
              <button
                onClick={() => pickProduct('')}
                aria-label="Semua produk"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#94a3b8] hover:text-[#0f172a]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-[#0f172a] bg-[#0f172a] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#94a3b8]">
            Jam Teramai
          </p>
          <p className="font-mono text-lg font-bold text-white">
            {peakHour === null ? '—' : hourLabel(peakHour)}
          </p>
          {peakHour !== null && (
            <p className="text-[11px] text-[#94a3b8]">{unitText(byHour[peakHour])}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">
            Hari Teramai
          </p>
          <p className="text-lg font-bold text-[#0f172a]">
            {peakDow === null ? '—' : DAY_NAMES[peakDow]}
          </p>
        </div>
        <StatCard
          label="Total Terjual"
          value={total}
          format="number"
          hint={selected ? selected.name : 'Semua produk'}
        />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-[25px]">
        <div>
          <h3 className="text-base font-bold text-[#0f172a]">Heatmap Jam × Hari</h3>
          <p className="text-xs text-[#64748b]">
            {selected ? `Khusus ${selected.name}` : 'Total seluruh produk'} · makin gelap makin
            laris
          </p>
        </div>
        {loading ? (
          <p className="py-16 text-center text-xs text-[#94a3b8]">Memuat...</p>
        ) : total === 0 ? (
          <p className="py-16 text-center text-xs text-[#94a3b8]">
            Tidak ada penjualan di periode ini.
          </p>
        ) : (
          <PeakHeatmap cells={cells} valueOf={(c) => c.quantity} format={unitText} />
        )}
      </section>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <table className="w-full border-collapse">
          <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
            <tr>
              <th className={`${thClass} pl-6 text-left`}>Jam</th>
              <th className={`${thClass} text-right`}>Jumlah Terjual</th>
              <th className={`${thClass} pr-6 text-right`}>% dari Total Periode</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => {
              const pct = total ? (r.qty / total) * 100 : 0;
              return (
                <tr key={r.hour} className="border-t border-[#f1f5f9] text-xs first:border-t-0">
                  <td className="py-3 pl-6 pr-3 font-mono font-semibold text-[#0f172a]">
                    {hourLabel(r.hour)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono">
                    {r.qty ? r.qty.toLocaleString('id-ID') : '—'}
                  </td>
                  <td className="py-3 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div
                          className="h-full rounded-full bg-[#0f172a]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 font-mono">
                        {pct.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={hourRows.length}
          itemLabel="jam"
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
