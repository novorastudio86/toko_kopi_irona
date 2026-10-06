import { useEffect, useState } from 'react';
import { AlertTriangle, Download, Search, X } from 'lucide-react';
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
import { fetchCategorySales } from '../../services/productReports';
import type { CategorySalesReport, CategorySalesRow } from '../../types/productReport';
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

const MISSING_COST_HINT =
  'Sebagian item terjual saat resep produk belum lengkap, jadi HPP-nya belum tercatat (dihitung 0).';

export default function CategorySalesReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [channel, setChannel] = useState<'' | 'offline' | 'online'>('');
  const [search, setSearch] = useState('');
  const [showChart, setShowChart] = useState(true);

  const [data, setData] = useState<CategorySalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const group = trendGroup(range);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCategorySales({ start: range.start, end: range.end, channel: channel || null }, group)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, channel, group]);

  const all = data?.categories ?? [];
  // Kartu & persentase selalu dari seluruh kategori; pencarian hanya menyaring tabel & grafik
  const totals = all.reduce(
    (acc, r) => ({
      sales: acc.sales + r.sales,
      quantity: acc.quantity + r.quantity,
      hpp: acc.hpp + r.hpp,
    }),
    { sales: 0, quantity: 0, hpp: 0 }
  );
  const q = search.trim().toLowerCase();
  const rows = q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  const colorOf = (id: string) =>
    SERIES_COLORS[all.findIndex((c) => c.categoryId === id) % SERIES_COLORS.length];

  const chartData = buildTrendData(
    (data?.series ?? []).map((s) => ({ period: s.period, key: s.categoryId, value: s.sales })),
    rows.map((c) => c.categoryId),
    range,
    group
  );

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<CategorySalesRow>({
        fileName: `Penjualan Kategori ${range.start} sd ${range.end}`,
        title: 'Laporan Penjualan Kategori',
        subtitle: `Periode ${rangeText(range)}${channel ? ` · ${channel === 'online' ? 'Online' : 'Offline'}` : ''}`,
        summary: [
          ['Total Kategori', String(all.length)],
          ['Total Penjualan Kategori', totals.sales],
          ['Total Produk Terjual (unit)', totals.quantity.toLocaleString('id-ID')],
          ['Total HPP', totals.hpp],
        ],
        sheets: [
          {
            name: 'Penjualan Kategori',
            rows,
            columns: [
              { header: 'Nama Kategori', width: 24, value: (r) => r.name },
              {
                header: 'Jumlah Produk Terjual',
                width: 20,
                type: 'number',
                value: (r) => r.quantity,
              },
              {
                header: '% Produk',
                width: 10,
                type: 'number',
                value: (r) => Math.round(pct(r.quantity, totals.quantity) * 10) / 10,
              },
              { header: 'Nilai Penjualan', width: 18, type: 'currency', value: (r) => r.sales },
              {
                header: '% Penjualan',
                width: 12,
                type: 'number',
                value: (r) => Math.round(pct(r.sales, totals.sales) * 10) / 10,
              },
              { header: 'HPP', width: 16, type: 'currency', value: (r) => r.hpp },
              { header: 'Laba Kotor', width: 16, type: 'currency', value: (r) => r.sales - r.hpp },
              {
                header: 'Catatan',
                width: 22,
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

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Penjualan Kategori"
        info="Penjualan dikelompokkan per kategori produk (setelah diskon, tanpa transaksi yang dibatalkan/direfund). HPP = Total Cost produk saat transaksi terjadi."
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
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kategori..."
              className={`${filterClass} w-48 pl-8`}
              aria-label="Cari kategori"
            />
          </div>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as typeof channel)}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Kategori"
          value={all.length}
          format="number"
          hint="Kategori yang punya penjualan di periode ini"
        />
        <StatCard
          label="Total Penjualan Kategori"
          value={totals.sales}
          hint={`${totals.quantity.toLocaleString('id-ID')} produk terjual`}
        />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-[25px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#0f172a]">Tren Penjualan Kategori</h3>
            <p className="text-xs text-[#64748b]">{group === 'month' ? 'Per bulan' : 'Per hari'}</p>
          </div>
          <button
            onClick={() => setShowChart((v) => !v)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
          >
            {showChart ? 'Sembunyikan' : 'Tampilkan'}
          </button>
        </div>
        {showChart &&
          (rows.length === 0 ? (
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
                    width={64}
                    tickFormatter={compactRupiah}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v: any, name: any) => [formatRupiah(Number(v)), name]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {rows.map((c) => (
                    <Line
                      key={c.categoryId}
                      type="monotone"
                      dataKey={c.categoryId}
                      name={c.name}
                      stroke={colorOf(c.categoryId)}
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
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Nama Kategori</th>
                <th className={`${thClass} text-right`}>Jumlah Produk Terjual</th>
                <th className={`${thClass} text-right`}>Nilai Penjualan</th>
                <th className={`${thClass} text-right`}>HPP</th>
                <th className={`${thClass} pr-6 text-right`}>Laba Kotor</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[#94a3b8]">
                    {q ? 'Kategori tidak ditemukan.' : 'Tidak ada penjualan di periode ini.'}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr
                    key={r.categoryId}
                    className="border-t border-[#f1f5f9] first:border-t-0 text-sm"
                  >
                    <td className="py-3 pl-6 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: colorOf(r.categoryId) }}
                        />
                        <div>
                          <p className="font-semibold text-[#0f172a]">{r.name}</p>
                          <p className="text-xs text-[#94a3b8]">{r.productCount} produk</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {r.quantity.toLocaleString('id-ID')}
                      <span className="ml-1.5 text-[#94a3b8]">
                        ({pctText(r.quantity, totals.quantity)})
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {formatRupiah(r.sales)}
                      <span className="ml-1.5 text-[#94a3b8]">
                        ({pctText(r.sales, totals.sales)})
                      </span>
                    </td>
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
                      className={`py-3 pr-6 text-right font-mono ${r.sales - r.hpp < 0 ? 'text-[#e11d48]' : ''}`}
                    >
                      {formatRupiah(r.sales - r.hpp)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
