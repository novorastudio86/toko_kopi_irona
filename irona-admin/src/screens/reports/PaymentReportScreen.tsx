import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { fetchPaymentReport } from '../../services/salesReports';
import type { PaymentReport } from '../../types/salesReport';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import { PAYMENT_LABELS } from './salesReportFormat';

const METHOD_COLORS: Record<string, string> = { qris: '#0f172a', tunai: '#05e298' };
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export default function PaymentReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [channel, setChannel] = useState<'' | 'offline' | 'online'>('');
  const [data, setData] = useState<PaymentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Rentang > 62 hari: grafik per bulan
  const days = Math.round(
    (parseLocalDate(range.end).getTime() - parseLocalDate(range.start).getTime()) / 86400000
  );
  const group: 'day' | 'month' = days > 62 ? 'month' : 'day';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPaymentReport({ start: range.start, end: range.end, channel: channel || null }, group)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, channel, group]);

  const methods = data?.methods ?? [];
  const totalTx = methods.reduce((s, m) => s + m.transactions, 0);
  const totalAmount = methods.reduce((s, m) => s + m.amount, 0);
  const methodKeys = [...new Set(methods.map((m) => m.method))];

  // Pivot: satu baris per periode, kolom per metode (jumlah transaksi)
  const chartData = (() => {
    const map = new Map<string, Record<string, number | string>>();
    (data?.series ?? []).forEach((s) => {
      const row = map.get(s.period) ?? {
        period: s.period,
        label:
          group === 'month'
            ? parseLocalDate(s.period).toLocaleDateString('id-ID', {
                month: 'short',
                year: '2-digit',
              })
            : String(parseLocalDate(s.period).getDate()),
      };
      row[s.method] = s.transactions;
      map.set(s.period, row);
    });
    return [...map.values()];
  })();

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<PaymentReport['methods'][number]>({
        fileName: `Laporan Jenis Bayar ${range.start} sd ${range.end}`,
        title: 'Laporan Jenis Bayar',
        subtitle: `Periode ${rangeText(range)}${channel ? ` · ${channel === 'online' ? 'Online' : 'Offline'}` : ''}`,
        summary: [
          ['Total Transaksi', totalTx],
          ['Total Nominal', totalAmount],
        ],
        sheets: [
          {
            name: 'Jenis Bayar',
            rows: methods,
            columns: [
              {
                header: 'Metode Pembayaran',
                width: 20,
                value: (m) => PAYMENT_LABELS[m.method] ?? m.method,
              },
              {
                header: 'Jumlah Transaksi',
                width: 16,
                type: 'number',
                value: (m) => m.transactions,
              },
              {
                header: '% Transaksi',
                width: 12,
                type: 'number',
                value: (m) => Math.round(pct(m.transactions, totalTx) * 10) / 10,
              },
              { header: 'Nominal', width: 18, type: 'currency', value: (m) => m.amount },
              {
                header: '% Nominal',
                width: 12,
                type: 'number',
                value: (m) => Math.round(pct(m.amount, totalAmount) * 10) / 10,
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

  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        breadcrumb={['Laporan', 'Laporan Penjualan', 'Laporan Jenis Bayar']}
        title="Laporan Jenis Bayar"
        info="Komposisi metode pembayaran. Nominal = total yang dibayar pelanggan (termasuk ongkir & biaya layanan untuk pesanan online). Pesanan online selalu QRIS lewat payment gateway."
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
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as typeof channel)}
          className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs outline-none"
          aria-label="Channel"
        >
          <option value="">Semua Channel</option>
          <option value="offline">Offline</option>
          <option value="online">Online</option>
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

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Transaksi" value={totalTx} format="number" hint="Seluruh metode" />
        <StatCard label="Total Nominal" value={totalAmount} hint="Seluruh metode" />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-[25px]">
        <h3 className="text-base font-bold text-[#0f172a]">
          Proporsi transaksi per metode ({group === 'month' ? 'per bulan' : 'per hari'})
        </h3>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              stackOffset="expand"
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                width={44}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <Tooltip
                formatter={(v: any, name: any) => [`${v} transaksi`, name]}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {methodKeys.map((m) => (
                <Bar
                  key={m}
                  dataKey={m}
                  name={PAYMENT_LABELS[m] ?? m}
                  stackId="a"
                  fill={METHOD_COLORS[m] ?? '#94a3b8'}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <table className="w-full border-collapse">
          <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
            <tr>
              <th className={`${thClass} pl-6 text-left`}>Metode Pembayaran</th>
              <th className={`${thClass} text-right`}>Jumlah Transaksi</th>
              <th className={`${thClass} text-right`}>%</th>
              <th className={`${thClass} text-right`}>Nominal</th>
              <th className={`${thClass} pr-6 text-right`}>%</th>
            </tr>
          </thead>
          <tbody>
            {!loading && methods.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-xs text-[#94a3b8]">
                  Tidak ada transaksi di periode ini.
                </td>
              </tr>
            )}
            {methods.map((m) => (
              <tr key={m.method} className="border-t border-[#f1f5f9] first:border-t-0 text-xs">
                <td className="py-3.5 pl-6 pr-3">
                  <span className="flex items-center gap-2 font-semibold text-[#0f172a]">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: METHOD_COLORS[m.method] ?? '#94a3b8' }}
                    />
                    {PAYMENT_LABELS[m.method] ?? m.method}
                  </span>
                </td>
                <td className="py-3.5 pr-3 text-right font-mono">
                  {m.transactions.toLocaleString('id-ID')}
                </td>
                <td className="py-3.5 pr-3 text-right font-mono text-[#64748b]">
                  {pct(m.transactions, totalTx).toFixed(1)}%
                </td>
                <td className="py-3.5 pr-3 text-right font-mono font-semibold">
                  {formatRupiah(m.amount)}
                </td>
                <td className="py-3.5 pr-6 text-right font-mono text-[#64748b]">
                  {pct(m.amount, totalAmount).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
