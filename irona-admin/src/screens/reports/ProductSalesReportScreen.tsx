import { useEffect, useState } from 'react';
import { AlertTriangle, Download, X } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchCategories } from '../../services/categories';
import { fetchProductSales } from '../../services/productReports';
import type { Category } from '../../types/category';
import type { ProductSalesReport, ProductSalesRow } from '../../types/productReport';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import {
  SERIES_COLORS,
  buildTrendData,
  compactRupiah,
  pct,
  pctText,
  trendGroup,
} from './productReportChart';

type Metric = 'sales' | 'quantity';

const MISSING_COST_HINT =
  'Sebagian item terjual saat resep produk belum lengkap, jadi HPP-nya belum tercatat (dihitung 0).';

export default function ProductSalesReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [categoryId, setCategoryId] = useState('');
  const [orderType, setOrderType] = useState<'' | 'dine_in' | 'take_away' | 'online'>('');
  const [channel, setChannel] = useState<'' | 'offline' | 'online'>('');
  const [metric, setMetric] = useState<Metric>('sales');
  const [showChart, setShowChart] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<ProductSalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProductSales({
      start: range.start,
      end: range.end,
      categoryId: categoryId || null,
      channel: channel || null,
      orderType: orderType || null,
    })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, categoryId, channel, orderType]);

  const rows = data?.products ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      sales: acc.sales + r.sales,
      quantity: acc.quantity + r.quantity,
      hpp: acc.hpp + r.hpp,
      grossProfit: acc.grossProfit + r.grossProfit,
    }),
    { sales: 0, quantity: 0, hpp: 0, grossProfit: 0 }
  );
  const anyMissingCost = rows.some((r) => r.missingCost);

  // Grafik: 5 produk terlaris (urutan dari RPC = penjualan tertinggi dulu)
  const group = trendGroup(range);
  const top5 = rows.slice(0, 5);
  const chartData = buildTrendData(
    (data?.series ?? []).map((s) => ({
      period: s.date,
      key: s.productId,
      value: metric === 'sales' ? s.sales : s.quantity,
    })),
    top5.map((p) => p.productId),
    range,
    group
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const filterText = [
    categoryId && categories.find((c) => c.id === categoryId)?.name,
    orderType &&
      { dine_in: 'Dine In', take_away: 'Take Away', online: 'Delivery (Online)' }[orderType],
    channel && (channel === 'online' ? 'Online' : 'Offline'),
  ]
    .filter(Boolean)
    .join(' · ');

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<ProductSalesRow>({
        fileName: `Penjualan Produk ${range.start} sd ${range.end}`,
        title: 'Laporan Penjualan Produk',
        subtitle: `Periode ${rangeText(range)}${filterText ? ` · ${filterText}` : ''}`,
        summary: [
          ['Total Penjualan', totals.sales],
          ['Total Produk Terjual (unit)', totals.quantity.toLocaleString('id-ID')],
          ['Total HPP', totals.hpp],
          ['Total Laba Kotor', totals.grossProfit],
        ],
        sheets: [
          {
            name: 'Penjualan Produk',
            rows,
            columns: [
              { header: 'Nama Produk', width: 28, value: (r) => r.name },
              { header: 'Kategori', width: 20, value: (r) => r.categoryName },
              { header: 'Jumlah Terjual', width: 14, type: 'number', value: (r) => r.quantity },
              { header: 'Penjualan', width: 16, type: 'currency', value: (r) => r.sales },
              { header: 'HPP', width: 16, type: 'currency', value: (r) => r.hpp },
              { header: 'Laba Kotor', width: 16, type: 'currency', value: (r) => r.grossProfit },
              {
                header: '% Kontribusi',
                width: 12,
                type: 'number',
                value: (r) => Math.round(pct(r.sales, totals.sales) * 10) / 10,
              },
              {
                header: 'Catatan',
                width: 28,
                value: (r) => (r.missingCost ? 'HPP belum lengkap' : ''),
              },
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
        title="Penjualan Produk"
        info="Penjualan per produk setelah diskon, tanpa transaksi yang dibatalkan/direfund. HPP = Total Cost produk saat transaksi terjadi. Laba Kotor = Penjualan − HPP (belum dikurangi biaya gateway)."
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
          resetPage();
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              resetPage();
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
          <select
            value={orderType}
            onChange={(e) => {
              setOrderType(e.target.value as typeof orderType);
              resetPage();
            }}
            className={filterClass}
            aria-label="Jenis order"
          >
            <option value="">Semua Jenis Order</option>
            <option value="dine_in">Dine In</option>
            <option value="take_away">Take Away</option>
            <option value="online">Delivery (Online)</option>
          </select>
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as typeof channel);
              resetPage();
            }}
            className={filterClass}
            aria-label="Channel"
          >
            <option value="">Semua Channel</option>
            <option value="offline">Offline</option>
            <option value="online">Online</option>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Penjualan" value={totals.sales} />
        <StatCard label="Total Produk Terjual" value={totals.quantity} format="number" />
        <StatCard
          label="Total Laba Kotor"
          value={totals.grossProfit}
          hint={
            anyMissingCost
              ? MISSING_COST_HINT
              : `HPP ${formatRupiah(totals.hpp)} · margin ${pctText(totals.grossProfit, totals.sales)}`
          }
        />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-[25px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#0f172a]">Tren 5 Produk Terlaris</h3>
            <p className="text-xs text-[#64748b]">
              {group === 'month' ? 'Per bulan' : 'Per hari'} · berdasarkan penjualan tertinggi
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[#e2e8f0] p-0.5">
              {(
                [
                  ['sales', 'Penjualan'],
                  ['quantity', 'Unit'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${metric === key ? 'bg-[#0f172a] text-white' : 'text-[#475569] hover:bg-[#f1f5f9]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowChart((v) => !v)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
            >
              {showChart ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
        </div>
        {showChart &&
          (top5.length === 0 ? (
            <p className="py-16 text-center text-xs text-[#94a3b8]">
              {loading ? 'Memuat...' : 'Tidak ada penjualan di periode ini.'}
            </p>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    width={metric === 'sales' ? 64 : 40}
                    tickFormatter={metric === 'sales' ? compactRupiah : undefined}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v: any, name: any) => [
                      metric === 'sales'
                        ? formatRupiah(Number(v))
                        : `${Number(v).toLocaleString('id-ID')} unit`,
                      name,
                    ]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {top5.map((p, i) => (
                    <Line
                      key={p.productId}
                      type="monotone"
                      dataKey={p.productId}
                      name={p.name}
                      stroke={SERIES_COLORS[i]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
      </section>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Nama Produk</th>
                <th className={`${thClass} text-left`}>Kategori</th>
                <th className={`${thClass} text-right`}>Jumlah Terjual</th>
                <th className={`${thClass} text-right`}>Penjualan</th>
                <th className={`${thClass} text-right`}>HPP</th>
                <th className={`${thClass} text-right`}>Laba Kotor</th>
                <th className={`${thClass} pr-6 text-right`}>Kontribusi</th>
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
                    Tidak ada produk terjual di periode ini.
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => (
                  <tr
                    key={r.productId}
                    className="border-t border-[#f1f5f9] first:border-t-0 text-sm"
                  >
                    <td className="py-3 pl-6 pr-3 font-semibold text-[#0f172a]">{r.name}</td>
                    <td className="py-3 pr-3 text-[#475569]">{r.categoryName}</td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {r.quantity.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">{formatRupiah(r.sales)}</td>
                    <td className="py-3 pr-3 text-right font-mono">
                      <span className="inline-flex items-center justify-end gap-1">
                        {r.missingCost && (
                          <span title={MISSING_COST_HINT}>
                            <AlertTriangle className="size-3.5 text-[#de9a35]" />
                          </span>
                        )}
                        {formatRupiah(r.hpp)}
                      </span>
                    </td>
                    <td
                      className={`py-3 pr-3 text-right font-mono ${r.grossProfit < 0 ? 'text-[#e11d48]' : ''}`}
                    >
                      {formatRupiah(r.grossProfit)}
                    </td>
                    <td className="py-3 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#f1f5f9]">
                          <div
                            className="h-full rounded-full bg-[#0f172a]"
                            style={{ width: `${Math.min(100, pct(r.sales, totals.sales))}%` }}
                          />
                        </div>
                        <span className="w-12 font-mono">{pctText(r.sales, totals.sales)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={rows.length}
          itemLabel="produk"
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
