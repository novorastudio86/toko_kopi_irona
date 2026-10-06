import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchPeakTransactions } from '../../services/trendReports';
import type { PeakCell } from '../../types/trendReport';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from '../reports/ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from '../reports/reportRange';
import PeakHeatmap from './PeakHeatmap';
import { DAY_NAMES, aggregatePeak, hourLabel } from './peakData';

type Metric = 'transactions' | 'sales';

const METRIC_VALUE: Record<Metric, (c: PeakCell) => number> = {
  transactions: (c) => c.transactions,
  sales: (c) => c.sales,
};

const METRIC_FORMAT: Record<Metric, (n: number) => string> = {
  transactions: (n) => `${n.toLocaleString('id-ID')} transaksi`,
  sales: formatRupiah,
};

export default function PeakTransactionScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [metric, setMetric] = useState<Metric>('transactions');
  const [orderType, setOrderType] = useState<'' | 'dine_in' | 'take_away' | 'online'>('');
  const [channel, setChannel] = useState<'' | 'offline' | 'online'>('');

  const [cells, setCells] = useState<PeakCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPeakTransactions({
      start: range.start,
      end: range.end,
      channel: channel || null,
      orderType: orderType || null,
    })
      .then((c) => !cancelled && setCells(c))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat analisa.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, channel, orderType]);

  const valueOf = METRIC_VALUE[metric];
  const { total, peakHour, peakDow } = aggregatePeak(cells, valueOf);
  const tx = aggregatePeak(cells, METRIC_VALUE.transactions);
  const sales = aggregatePeak(cells, METRIC_VALUE.sales);
  const hourRows = tx.byHour
    .map((t, hour) => ({ hour, transactions: t, sales: sales.byHour[hour] }))
    .sort((a, b) => b[metric] - a[metric] || a.hour - b.hour);

  const totalPages = Math.max(1, Math.ceil(hourRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = hourRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const filterClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';
  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Waktu Teramai Penjualan"
        info="Jumlah transaksi & nilai penjualan (setelah diskon dan refund) per jam & hari (WIB), berdasarkan waktu order. Transaksi dibatalkan/direfund penuh tidak dihitung."
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
        <div className="flex flex-col gap-1 rounded-2xl border border-[#0f172a] bg-[#0f172a] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.55px] text-[#94a3b8]">
            Jam Teramai
          </p>
          <p className="font-mono text-lg font-bold text-white">
            {peakHour === null ? '—' : hourLabel(peakHour)}
          </p>
          <p className="text-xs text-[#94a3b8]">
            berdasarkan {metric === 'sales' ? 'nilai penjualan' : 'jumlah transaksi'}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.55px] text-[#64748b]">
            Hari Teramai
          </p>
          <p className="text-lg font-bold text-[#0f172a]">
            {peakDow === null ? '—' : DAY_NAMES[peakDow]}
          </p>
        </div>
        <StatCard label="Total Transaksi" value={tx.total} format="number" />
        <StatCard label="Total Nilai Penjualan" value={sales.total} />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-[25px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#0f172a]">Heatmap Jam × Hari</h3>
            <p className="text-xs text-[#64748b]">
              Intensitas = {metric === 'sales' ? 'nilai penjualan' : 'jumlah transaksi'}
            </p>
          </div>
          <div className="flex rounded-lg border border-[#e2e8f0] p-0.5">
            {(
              [
                ['transactions', 'Jumlah Transaksi'],
                ['sales', 'Nilai Penjualan (Rp)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setMetric(key);
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${metric === key ? 'bg-[#0f172a] text-white' : 'text-[#475569] hover:bg-[#f1f5f9]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="py-16 text-center text-xs text-[#94a3b8]">Memuat...</p>
        ) : total === 0 ? (
          <p className="py-16 text-center text-xs text-[#94a3b8]">
            Tidak ada penjualan di periode ini.
          </p>
        ) : (
          <PeakHeatmap cells={cells} valueOf={valueOf} format={METRIC_FORMAT[metric]} />
        )}
      </section>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Jam</th>
                <th className={`${thClass} text-right`}>Jumlah Transaksi</th>
                <th className={`${thClass} text-right`}>Nilai Penjualan</th>
                <th className={`${thClass} pr-6 text-right`}>% dari Total Periode</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
                const pct = total ? (r[metric] / total) * 100 : 0;
                return (
                  <tr key={r.hour} className="border-t border-[#f1f5f9] text-sm first:border-t-0">
                    <td className="py-3 pl-6 pr-3 font-mono font-semibold text-[#0f172a]">
                      {hourLabel(r.hour)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {r.transactions ? r.transactions.toLocaleString('id-ID') : '—'}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {r.sales ? formatRupiah(r.sales) : '—'}
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
        </div>
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
