import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarDays, Pencil, RefreshCw, X } from 'lucide-react';
import { fetchDashboard, fetchStoreHoursForDay } from '../../services/dashboard';
import type { BreakdownRow, DashboardData, DashboardMode } from '../../types/dashboard';
import { todayISO } from '../../utils/date';
import SalesChart from './SalesChart';
import {
  LabeledBarList,
  QtyBarList,
  ShareBarList,
  StockList,
  WidgetCard,
} from './DashboardWidgets';
import { ListModal, TargetModal } from './DashboardModals';
import { buildPeriod, chartBadge, previousLabel, rangeLabel, targetLabel } from './dashboardPeriod';
import icInfo from '../../assets/ui/info.svg';

/** Muat ulang otomatis tiap 5 menit */
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const rp = (n: number) =>
  `Rp ${n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rp0 = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function compactRp(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return `Rp ${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Jt`;
  if (Math.abs(n) >= 1_000)
    return `Rp ${(n / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb`;
  return rp0(n);
}

/** "↗ 12.5%" / "↘ 3.2%" terhadap periode pembanding */
function changeText(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? '↗ baru' : '—';
  const pct = ((cur - prev) / prev) * 100;
  return `${pct >= 0 ? '↗' : '↘'} ${Math.abs(pct).toFixed(2)}%`;
}

function ChangeBadge({ cur, prev }: { cur: number; prev: number }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-[#cbd5e1] bg-[#f1f5f9] px-[9px] py-[3px] text-xs font-semibold leading-4 text-[#334155]">
      {changeText(cur, prev)}
    </span>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded border border-[#e2e8f0] bg-[#f1f5f9] px-[7px] py-[3px] text-[10px] font-semibold leading-[15px] text-[#334155]">
      {children}
    </span>
  );
}

function Metric({
  label,
  cur,
  prev,
  value,
  chips,
}: {
  label: string;
  cur: number;
  prev: number;
  value: string;
  chips?: [string, string];
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-1.5">
        <span className="text-xs font-medium text-[#64748b]">{label}</span>
        <span className="text-[11px] font-bold text-[#475569]">{changeText(cur, prev)}</span>
      </div>
      <span className="text-xl font-bold leading-7 text-[#0f172a]">{value}</span>
      {chips && (
        <div className="flex gap-1.5 pt-0.5">
          <Chip>{chips[0]}</Chip>
          <Chip>{chips[1]}</Chip>
        </div>
      )}
    </div>
  );
}

type ListKey = 'cashier' | 'orderType' | 'category' | 'product' | 'payment';

const MODES: [DashboardMode, string][] = [
  ['day', 'Hari Ini'],
  ['week', 'Mingguan'],
  ['month', 'Bulan'],
];

export default function DashboardScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<DashboardMode>('day');
  const [anchor, setAnchor] = useState(todayISO);
  // "Sekarang" dibaca saat memuat data (bukan tiap render)
  const [now, setNow] = useState(() => new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [storeHours, setStoreHours] = useState({ open: 8, close: 23 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const [list, setList] = useState<ListKey | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const period = buildPeriod(mode, anchor, now);
  const startISO = period.start.toISOString();
  const endISO = period.end.toISOString();
  const prevStartISO = period.prevStart.toISOString();
  const prevEndISO = period.prevEnd.toISOString();
  const dow = period.start.getDay();

  // Naikkan untuk memuat ulang data (mis. setelah target disimpan)
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [d, hours] = await Promise.all([
          fetchDashboard({
            start: startISO,
            end: endISO,
            prevStart: prevStartISO,
            prevEnd: prevEndISO,
            granularity: mode === 'day' ? 'hour' : 'day',
          }),
          mode === 'day' ? fetchStoreHoursForDay(dow) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setData(d);
        if (hours) {
          const open = Number(hours.open.slice(0, 2));
          setStoreHours({ open, close: Math.max(open + 1, Number(hours.close.slice(0, 2))) });
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Gagal memuat dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [startISO, endISO, prevStartISO, prevEndISO, mode, dow, reloadKey]);

  // Muat ulang berkala: perbarui "sekarang" → periode & data ikut dihitung ulang
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const cur = data?.current;
  const prev = data?.previous;
  const target = !data
    ? 0
    : mode === 'day'
      ? data.targets.daily
      : mode === 'week'
        ? data.targets.daily * 7
        : data.targets.monthly;
  const targetPct = target > 0 && cur ? (cur.sales / target) * 100 : 0;
  const perTx = (s: typeof cur) => (s && s.transactions ? s.sales / s.transactions : 0);
  const itemsPerTx = (s: typeof cur) => (s && s.transactions ? s.productsSold / s.transactions : 0);
  const seriesTotal = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);

  const listConfig: Record<
    ListKey,
    {
      title: string;
      columns: [string, string, string?];
      rows: BreakdownRow[];
      third?: (r: BreakdownRow) => string;
    }
  > | null = data
    ? {
        cashier: {
          title: 'Penjualan per Kasir',
          columns: ['Kasir', 'Penjualan', 'Transaksi'],
          rows: data.byCashier,
          third: (r) => `${r.count}`,
        },
        orderType: {
          title: 'Jenis Order',
          columns: ['Jenis', 'Penjualan', 'Transaksi'],
          rows: data.byOrderType,
          third: (r) => `${r.count}`,
        },
        category: {
          title: 'Penjualan per Kategori',
          columns: ['Kategori', 'Penjualan', 'Qty'],
          rows: data.byCategory,
          third: (r) => `${r.count}`,
        },
        product: {
          title: 'Produk Terlaris',
          columns: ['Produk', 'Terjual', 'Penjualan'],
          rows: data.topProducts,
        },
        payment: {
          title: 'Metode Pembayaran',
          columns: ['Metode', 'Penjualan', 'Transaksi'],
          rows: data.byPayment,
          third: (r) => `${r.count}`,
        },
      }
    : null;

  const inputValue = mode === 'month' ? anchor.slice(0, 7) : anchor;

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      {/* 1. Header */}
      <section className="rounded-2xl border border-[#e2e8f0] bg-white p-[25px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold leading-[30px] tracking-[-0.6px] text-[#0f172a]">
                Dashboard
              </h1>
              <span
                title="Penjualan = total dibayar pelanggan (setelah diskon), tanpa transaksi refund penuh/batal. Persentase membandingkan dengan periode sebelumnya sampai titik waktu yang sama. Pesanan online termasuk; Terbayar = kasir + online yang sudah settlement."
                className="flex size-5 items-center justify-center rounded-full border border-[#e2e8f0] bg-[#f1f5f9]"
              >
                <img src={icInfo} alt="Info perhitungan" className="size-3" />
              </span>
            </div>
            <p className="flex items-center gap-2 text-xs text-[#64748b]">
              {data
                ? `Diperbarui ${new Date(data.generatedAt).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}`
                : 'Memuat...'}
              <button
                onClick={() => setNow(new Date())}
                disabled={loading}
                aria-label="Muat ulang"
                className="rounded p-0.5 text-[#94a3b8] hover:text-[#0f172a] disabled:opacity-40"
              >
                <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </p>
          </div>

          <div className="flex items-center rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] p-[5px]">
            {MODES.map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs leading-4 ${
                  mode === m
                    ? 'bg-white font-semibold text-[#0f172a] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]'
                    : 'font-medium text-[#475569] hover:text-[#0f172a]'
                }`}
              >
                {label}
              </button>
            ))}
            {/* Tombol tanggal: membuka pemilih tanggal/bulan bawaan browser (showPicker) */}
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => {
                  const el = dateInputRef.current;
                  if (!el) return;
                  try {
                    el.showPicker();
                  } catch {
                    // Browser lama tanpa showPicker: fokus ke input supaya tetap bisa diketik
                    el.focus();
                  }
                }}
                className="flex items-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-[13px] py-[7px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#f8fafc]"
              >
                <CalendarDays className="size-4 text-[#475569]" />
                <span className="text-xs font-medium text-[#1e293b]">{rangeLabel(period)}</span>
              </button>
              <input
                ref={dateInputRef}
                type={mode === 'month' ? 'month' : 'date'}
                value={inputValue}
                max={mode === 'month' ? todayISO().slice(0, 7) : todayISO()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setAnchor(mode === 'month' ? `${v}-01` : v);
                }}
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
              />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* 2. KPI */}
      <section className="grid grid-cols-1 gap-8 rounded-2xl border border-[#e2e8f0] bg-white p-[25px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-8 self-center md:grid-cols-2 lg:col-span-7">
          <div className="flex flex-col justify-between p-1">
            <div className="flex flex-col gap-2 pb-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[#64748b]">Total Penjualan</span>
                {cur && prev && <ChangeBadge cur={cur.sales} prev={prev.sales} />}
              </div>
              <span className="truncate text-[30px] font-extrabold leading-9 tracking-[-0.75px] text-[#0f172a]">
                {cur ? rp(cur.sales) : '—'}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-1.5 border-t border-[#f1f5f9] pt-[13px]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#64748b]">{targetLabel(period)}</span>
                <button
                  onClick={() => setTargetOpen(true)}
                  className="flex items-center gap-1 font-semibold text-[#1e293b] hover:underline"
                >
                  {target > 0 ? rp(target) : 'Atur target'}
                  <Pencil className="size-3 text-[#94a3b8]" />
                </button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#f1f5f9]">
                <div
                  className="h-full rounded-full bg-[#0f172a]"
                  style={{ width: `${Math.min(100, targetPct)}%` }}
                />
              </div>
              <span className="text-right text-[10px] font-medium text-[#64748b]">
                {target > 0 ? `${targetPct.toFixed(1)}% tercapai` : 'Target belum diatur'}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between border-[#f1f5f9] p-1 md:border-l md:pl-[33px]">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[#64748b]">Penjualan Terbayar</span>
                {cur && prev && <ChangeBadge cur={cur.paidSales} prev={prev.paidSales} />}
              </div>
              <span className="truncate text-2xl font-extrabold leading-8 tracking-[-0.6px] text-[#0f172a]">
                {cur ? rp(cur.paidSales) : '—'}
              </span>
            </div>
            <div className="mt-5 flex flex-col gap-1.5 border-t border-[#f1f5f9] pt-[13px]">
              <span className="text-sm font-medium text-[#64748b]">Biaya Promosi</span>
              <span className="text-2xl font-extrabold leading-8 tracking-[-0.6px] text-[#0f172a]">
                {cur ? rp0(cur.promoCost) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 self-center rounded-2xl border border-[rgba(226,232,240,0.9)] bg-white p-[21px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] lg:col-span-5">
          <Metric
            label="Transaksi"
            cur={cur?.transactions ?? 0}
            prev={prev?.transactions ?? 0}
            value={cur ? cur.transactions.toLocaleString('id-ID') : '—'}
            chips={
              cur
                ? [`Offline: ${cur.transactionsOffline}`, `Online: ${cur.transactionsOnline}`]
                : undefined
            }
          />
          <Metric
            label="Penjualan per Transaksi"
            cur={perTx(cur)}
            prev={perTx(prev)}
            value={cur ? rp(perTx(cur)) : '—'}
          />
          <Metric
            label="Produk Terjual"
            cur={cur?.productsSold ?? 0}
            prev={prev?.productsSold ?? 0}
            value={cur ? cur.productsSold.toLocaleString('id-ID') : '—'}
            chips={
              cur ? [`Offline: ${cur.productsOffline}`, `Online: ${cur.productsOnline}`] : undefined
            }
          />
          <Metric
            label="Produk per Transaksi"
            cur={itemsPerTx(cur)}
            prev={itemsPerTx(prev)}
            value={
              cur ? itemsPerTx(cur).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : '—'
            }
          />
        </div>
      </section>

      {/* 3. Grafik */}
      <section className="flex flex-col gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-[25px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-[17px]">
          <h3 className="text-base font-bold leading-6 text-[#0f172a]">Penjualan</h3>
          <span className="rounded border border-[#cbd5e1] bg-[#f1f5f9] px-[9px] py-[3px] text-[10px] font-bold leading-[15px] text-[#1e293b]">
            {chartBadge(period)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-5 pt-1 text-xs">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-3.5 rounded-full bg-[#0f172a]" />
            <span className="font-bold text-[#1e293b]">
              Periode Ini{' '}
              <span className="font-normal text-[#64748b]">
                ({compactRp(data ? seriesTotal(data.series) : 0)})
              </span>
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1 w-3.5 rounded-full bg-[#94a3b8]" />
            <span className="font-medium text-[#475569]">
              {previousLabel(mode)}{' '}
              <span className="font-normal text-[#94a3b8]">
                ({compactRp(data ? seriesTotal(data.previousSeries) : 0)})
              </span>
            </span>
          </span>
        </div>
        {data && (
          <SalesChart
            period={period}
            series={data.series}
            previousSeries={data.previousSeries}
            storeHours={storeHours}
            now={now}
          />
        )}
        {!data && <div className="h-[300px]" />}
      </section>

      {/* 4. Rincian */}
      {data && (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <WidgetCard
            title="Ketersediaan Stok"
            accent="orange"
            empty={data.lowStock.length === 0}
            onViewAll={() => navigate('/inventory/manage-stock')}
          >
            <StockList rows={data.lowStock} limit={4} />
          </WidgetCard>
          <WidgetCard
            title="Penjualan per Kasir"
            empty={data.byCashier.length === 0}
            onViewAll={() => setList('cashier')}
          >
            <LabeledBarList rows={data.byCashier} limit={3} />
          </WidgetCard>
          <WidgetCard
            title="Jenis Order"
            empty={data.byOrderType.length === 0}
            onViewAll={() => setList('orderType')}
          >
            <LabeledBarList rows={data.byOrderType} limit={3} />
          </WidgetCard>
          <WidgetCard
            title="Penjualan per Kategori"
            empty={data.byCategory.length === 0}
            onViewAll={() => setList('category')}
          >
            <ShareBarList rows={data.byCategory} limit={4} />
          </WidgetCard>
          <WidgetCard
            title="Produk Terlaris"
            empty={data.topProducts.length === 0}
            onViewAll={() => setList('product')}
          >
            <QtyBarList rows={data.topProducts} limit={5} />
          </WidgetCard>
          <WidgetCard
            title="Metode Pembayaran"
            accent="orange"
            empty={data.byPayment.length === 0}
            onViewAll={() => setList('payment')}
          >
            <LabeledBarList rows={data.byPayment} limit={2} />
          </WidgetCard>
        </section>
      )}

      {targetOpen && data && (
        <TargetModal
          daily={data.targets.daily}
          monthly={data.targets.monthly}
          onClose={() => setTargetOpen(false)}
          onSaved={() => {
            setTargetOpen(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {list && listConfig && (
        <ListModal
          title={listConfig[list].title}
          subtitle={rangeLabel(period)}
          columns={listConfig[list].columns}
          rows={listConfig[list].rows.map((r) => ({
            key: r.key,
            cells:
              list === 'product'
                ? [r.label, r.count.toLocaleString('id-ID'), rp0(r.amount)]
                : [r.label, rp0(r.amount), listConfig[list].third?.(r)],
          }))}
          onClose={() => setList(null)}
        />
      )}
    </div>
  );
}
