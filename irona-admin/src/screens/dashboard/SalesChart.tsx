import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint } from '../../types/dashboard';
import { WEEKDAYS_SHORT, bucketDate, shortDate, type Period } from './dashboardPeriod';

type Props = {
  period: Period;
  series: SeriesPoint[];
  previousSeries: SeriesPoint[];
  /** Jam buka & tutup toko hari itu (jam bulat), untuk sumbu X mode harian */
  storeHours: { open: number; close: number };
  now: Date;
};

type Row = {
  bucket: number;
  label: string;
  /** Kumulatif (garis) */
  current: number | null;
  previous: number | null;
  /** Nilai titik itu saja (tooltip) */
  currentValue: number;
  previousValue: number;
};

/** Jumlah nilai periode ini pada titik-titik yang sudah dihitung */
const cumCur = (rows: Row[]) => rows.reduce((sum, r) => sum + r.currentValue, 0);

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function axisRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function ChartTooltip({
  active,
  payload,
  period,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  period: Period;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const change =
    row.previousValue > 0
      ? ((row.currentValue - row.previousValue) / row.previousValue) * 100
      : null;

  const when = (base: Date) => {
    if (period.mode === 'day') {
      return `${String(row.bucket).padStart(2, '0')}:00, ${shortDate(base)}`;
    }
    const d = bucketDate(base, row.bucket);
    return `${WEEKDAYS_SHORT[d.getDay()]}, ${shortDate(d)}`;
  };

  return (
    <div className="flex min-w-[280px] flex-col gap-2 rounded-xl border border-[#334155] bg-[#0f172a] p-[15px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
      <div className="flex items-center border-b border-white/10 pb-[9px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/15 px-[11px] py-[3px] text-xs font-bold text-[#e2e8f0]">
          {change === null ? '—' : `${change >= 0 ? '↗' : '↘'} ${Math.abs(change).toFixed(2)}%`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6 text-xs">
        <span className="flex items-center gap-2 font-medium text-[#e2e8f0]">
          <span className="size-2 rounded-full bg-white" />
          {when(period.start)}
        </span>
        <span className="font-bold tracking-[-0.3px] text-white">{rp(row.currentValue)}</span>
      </div>
      <div className="flex items-center justify-between gap-6 text-xs">
        <span className="flex items-center gap-2 font-medium text-[#e2e8f0]">
          <span className="size-2 rounded-full bg-[#64748b]" />
          {when(period.prevStart)}
        </span>
        <span className="font-bold tracking-[-0.3px] text-white">{rp(row.previousValue)}</span>
      </div>
    </div>
  );
}

/** Grafik penjualan kumulatif: periode ini (hitam) vs periode pembanding (abu-abu) */
export default function SalesChart({ period, series, previousSeries, storeHours, now }: Props) {
  const rows: Row[] = useMemo(() => {
    const cur = new Map(series.map((p) => [p.bucket, p.amount]));
    const prev = new Map(previousSeries.map((p) => [p.bucket, p.amount]));

    let buckets: number[];
    if (period.mode === 'day') {
      // Jam operasional; diperlebar kalau ada transaksi di luar jam itu
      const hours = [...cur.keys(), ...prev.keys()];
      const from = Math.min(storeHours.open, ...hours);
      const to = Math.max(storeHours.close - 1, ...hours);
      buckets = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    } else {
      buckets = Array.from({ length: period.days }, (_, i) => i);
    }

    // Titik terakhir periode ini yang sudah terjadi (garis berhenti di "sekarang")
    const lastBucket = !period.isOngoing
      ? Infinity
      : period.mode === 'day'
        ? now.getHours()
        : Math.floor((now.getTime() - period.start.getTime()) / 86400000);

    const labelOf = (b: number, i: number) => {
      if (period.mode === 'day') {
        return `${String(b).padStart(2, '0')}:00${i === buckets.length - 1 ? ' (Close)' : ''}`;
      }
      const d = bucketDate(period.start, b);
      return period.mode === 'week'
        ? `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`
        : String(d.getDate());
    };

    // Kumulatif: tiap titik = total sampai titik itu
    return buckets.reduce<Row[]>((acc, b, i) => {
      const cv = cur.get(b) ?? 0;
      const pv = prev.get(b) ?? 0;
      const before = acc[acc.length - 1];
      const runCur = cumCur(acc) + cv;
      const runPrev = (before ? (before.previous ?? 0) : 0) + pv;
      acc.push({
        bucket: b,
        label: labelOf(b, i),
        current: b <= lastBucket ? runCur : null,
        previous: runPrev,
        currentValue: cv,
        previousValue: pv,
      });
      return acc;
    }, []);
  }, [series, previousSeries, period, storeHours, now]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tickLine={{ stroke: '#cbd5e1' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}
            interval="preserveStartEnd"
            minTickGap={24}
            tickMargin={8}
          />
          <YAxis
            width={104}
            tickFormatter={axisRp}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
            tickCount={6}
          />
          <Tooltip
            cursor={{ stroke: '#1e293b', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={(props: any) => <ChartTooltip {...props} period={period} />}
          />
          <Line
            type="monotone"
            dataKey="previous"
            stroke="#94a3b8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#64748b', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke="#0f172a"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, fill: '#0f172a', stroke: '#fff', strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
