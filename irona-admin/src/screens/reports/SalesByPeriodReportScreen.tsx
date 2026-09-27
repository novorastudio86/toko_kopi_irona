import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchSalesByPeriod } from '../../services/salesReports';
import type { PeriodRow } from '../../types/salesReport';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';

type Group = 'day' | 'week' | 'month';
type Metric = 'sales' | 'transactions' | 'grossProfit' | 'products';

const METRICS: { key: Metric; label: string; color: string; money: boolean }[] = [
  { key: 'sales', label: 'Penjualan', color: '#0f172a', money: true },
  { key: 'grossProfit', label: 'Laba Kotor', color: '#05e298', money: true },
  { key: 'transactions', label: 'Transaksi', color: '#de9a35', money: false },
  { key: 'products', label: 'Produk', color: '#6d28d9', money: false },
];

const compact = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
    : Math.abs(n) >= 1_000
      ? `${(n / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
      : String(Math.round(n));

/** Label periode, dipotong ke rentang filter (minggu pertama/terakhir bisa tidak penuh) */
function periodLabel(start: string, group: Group, range: DateRange): string {
  const d = parseLocalDate(start);
  const fmt = (x: Date, withYear = true) =>
    x.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  if (group === 'day') return fmt(d);
  if (group === 'month') return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const from = new Date(Math.max(d.getTime(), parseLocalDate(range.start).getTime()));
  const endOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6);
  const to = new Date(Math.min(endOfWeek.getTime(), parseLocalDate(range.end).getTime()));
  return `${fmt(from, false)} – ${fmt(to)}`;
}

export default function SalesByPeriodReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [group, setGroup] = useState<Group>('day');
  const [orderType, setOrderType] = useState<'' | 'dine_in' | 'take_away' | 'online'>('');
  const [channel, setChannel] = useState<'' | 'offline' | 'online'>('');
  const [metrics, setMetrics] = useState<Set<Metric>>(new Set(['sales', 'grossProfit']));
  const [showChart, setShowChart] = useState(true);

  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSalesByPeriod(
      {
        start: range.start,
        end: range.end,
        channel: channel || null,
        orderType: orderType || null,
      },
      group
    )
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, group, channel, orderType]);

  const totals = rows.reduce(
    (acc, r) => ({
      sales: acc.sales + r.sales,
      grossProfit: acc.grossProfit + r.grossProfit,
      transactions: acc.transactions + r.transactions,
      products: acc.products + r.products,
      refund: acc.refund + r.refund,
    }),
    { sales: 0, grossProfit: 0, transactions: 0, products: 0, refund: 0 }
  );

  const chartData = rows.map((r) => ({
    ...r,
    label: periodLabel(r.periodStart, group, range),
  }));
  const hasMoney = METRICS.some((m) => m.money && metrics.has(m.key));
  const hasCount = METRICS.some((m) => !m.money && metrics.has(m.key));

  const tableRows = [...rows].reverse();
  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = tableRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const avg = (a: number, b: number) => (b ? a / b : 0);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<PeriodRow>({
        fileName: `Detail Per Periode ${range.start} sd ${range.end}`,
        title: 'Detail Per Periode',
        subtitle: `Periode ${rangeText(range)} · per ${group === 'day' ? 'hari' : group === 'week' ? 'minggu' : 'bulan'}`,
        summary: [
          ['Total Penjualan', totals.sales],
          ['Total Laba Kotor', totals.grossProfit],
          ['Total Transaksi', totals.transactions],
          ['Total Produk Terjual', totals.products],
        ],
        sheets: [
          {
            name: 'Per Periode',
            rows,
            columns: [
              {
                header: 'Periode',
                width: 22,
                value: (r) => periodLabel(r.periodStart, group, range),
              },
              { header: 'Penjualan', width: 16, type: 'currency', value: (r) => r.sales },
              { header: 'Laba Kotor', width: 16, type: 'currency', value: (r) => r.grossProfit },
              { header: 'Total Produk', width: 12, type: 'number', value: (r) => r.products },
              {
                header: 'Total Transaksi',
                width: 14,
                type: 'number',
                value: (r) => r.transactions,
              },
              { header: 'Refund', width: 14, type: 'currency', value: (r) => r.refund },
              {
                header: 'Rata-rata Order/Transaksi',
                width: 22,
                type: 'currency',
                value: (r) => avg(r.sales, r.transactions),
              },
              {
                header: 'Rata-rata Produk/Transaksi',
                width: 22,
                type: 'number',
                value: (r) => avg(r.products, r.transactions),
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
    'whitespace-nowrap py-[14px] pr-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        breadcrumb={['Laporan', 'Laporan Penjualan', 'Detail Per Periode']}
        title="Detail Per Periode"
        info="Penjualan dikelompokkan per hari, minggu (Senin–Minggu), atau bulan. Laba Kotor = Penjualan − refund − biaya gateway (porsi produk)."
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
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value as Group);
              setPage(1);
            }}
            className={filterClass}
            aria-label="Pengelompokan"
          >
            <option value="day">Per Hari</option>
            <option value="week">Per Minggu</option>
            <option value="month">Per Bulan</option>
          </select>
          <select
            value={orderType}
            onChange={(e) => {
              setOrderType(e.target.value as typeof orderType);
              setPage(1);
            }}
            className={filterClass}
            aria-label="Tipe order"
          >
            <option value="">Semua Tipe Order</option>
            <option value="dine_in">Dine In</option>
            <option value="take_away">Take Away</option>
            <option value="online">Online</option>
          </select>
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as typeof channel);
              setPage(1);
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Penjualan" value={totals.sales} />
        <StatCard label="Total Laba Kotor" value={totals.grossProfit} />
        <StatCard label="Total Transaksi" value={totals.transactions} format="number" />
        <StatCard label="Total Produk Terjual" value={totals.products} format="number" />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-[25px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[#0f172a]">Grafik</h3>
          <div className="flex flex-wrap items-center gap-2">
            {METRICS.map((m) => (
              <label
                key={m.key}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${metrics.has(m.key) ? 'border-[#0f172a] text-[#0f172a]' : 'border-[#e2e8f0] text-[#94a3b8]'}`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={metrics.has(m.key)}
                  onChange={() =>
                    setMetrics((prev) => {
                      const next = new Set(prev);
                      if (next.has(m.key)) next.delete(m.key);
                      else next.add(m.key);
                      return next;
                    })
                  }
                />
                <span className="size-2 rounded-full" style={{ background: m.color }} />
                {m.label}
              </label>
            ))}
            <button
              onClick={() => setShowChart((v) => !v)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
            >
              {showChart ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
        </div>
        {showChart && (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                {hasMoney && (
                  <YAxis
                    yAxisId="money"
                    width={64}
                    tickFormatter={compact}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                )}
                {hasCount && (
                  <YAxis
                    yAxisId="count"
                    orientation="right"
                    width={40}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                )}
                <Tooltip
                  formatter={(v: any, name: any) => {
                    const m = METRICS.find((x) => x.label === name);
                    return [
                      m?.money ? formatRupiah(Number(v)) : Number(v).toLocaleString('id-ID'),
                      name,
                    ];
                  }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {METRICS.filter((m) => metrics.has(m.key)).map((m) =>
                  m.money ? (
                    <Bar
                      key={m.key}
                      yAxisId="money"
                      dataKey={m.key}
                      name={m.label}
                      fill={m.color}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Line
                      key={m.key}
                      yAxisId="count"
                      type="monotone"
                      dataKey={m.key}
                      name={m.label}
                      stroke={m.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Periode</th>
                <th className={`${thClass} text-right`}>Penjualan</th>
                <th className={`${thClass} text-right`}>Laba Kotor</th>
                <th className={`${thClass} text-right`}>Total Produk</th>
                <th className={`${thClass} text-right`}>Total Transaksi</th>
                <th className={`${thClass} text-right`}>Refund</th>
                <th className={`${thClass} text-right`}>Rata-rata Order/Trx</th>
                <th className={`${thClass} pr-6 text-right`}>Rata-rata Produk/Trx</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-[#94a3b8]">
                    Tidak ada penjualan di periode ini.
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => (
                  <tr
                    key={r.periodStart}
                    className="border-t border-[#f1f5f9] first:border-t-0 text-xs"
                  >
                    <td className="py-3 pl-6 pr-3 font-semibold text-[#0f172a]">
                      {periodLabel(r.periodStart, group, range)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">{formatRupiah(r.sales)}</td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {formatRupiah(r.grossProfit)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {r.products.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {r.transactions.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-[#be123c]">
                      {r.refund ? formatRupiah(r.refund) : '—'}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {formatRupiah(avg(r.sales, r.transactions))}
                    </td>
                    <td className="py-3 pr-6 text-right font-mono">
                      {avg(r.products, r.transactions).toLocaleString('id-ID', {
                        maximumFractionDigits: 1,
                      })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={tableRows.length}
          itemLabel="periode"
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
