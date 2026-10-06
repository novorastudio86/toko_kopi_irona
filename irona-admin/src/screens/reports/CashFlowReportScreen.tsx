import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, X } from 'lucide-react';
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
import {
  fetchCashFlowEntries,
  fetchCashFlowSummary,
  fetchFinanceSettings,
  fetchHppMonths,
} from '../../services/finance';
import type { Bucket, CashFlowEntry, EntryType, FinanceSettings } from '../../types/finance';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate, toLocalISO, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import CashFlowEntryDetail from '../finance/CashFlowEntryDetail';
import { HppPanel, NetProfitPanel, StatCard } from '../finance/CashFlowPanels';
import { computeHppPanel, computeProfitPanel } from '../finance/cashFlowCalc';
import {
  BUCKET_LABELS,
  ENTRY_TYPE_CLASSES,
  ENTRY_TYPE_LABELS,
  formatDate,
} from '../finance/cashFlowFormat';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';

type LedgerRow = CashFlowEntry & { balance: number };

/** Info per bucket (judul, penjelasan) */
const BUCKET_INFO: Record<Bucket, string> = {
  hpp: 'Alokasi otomatis dari penjualan bersih dikurangi belanja bahan baku (Stok Masuk) dan pembalikan refund. Termasuk pembagian batas belanja 80% dan Saldo Mengendap 20%.',
  fixed_cost:
    'Alokasi otomatis dari penjualan bersih dikurangi gaji, kasbon, pengeluaran lain, biaya Try & Error, dan pembalikan refund.',
  net_profit:
    'Alokasi otomatis dari penjualan bersih dikurangi pembelian aset dan pembalikan refund, lalu dibagi BEP / Owner / Manager.',
};

/** Jenis pengeluaran/pemasukan (selain alokasi) yang ditampilkan di rincian mini per bucket */
const BREAKDOWN_TYPES: Record<Bucket, EntryType[]> = {
  hpp: ['bahan_baku', 'reversal_refund'],
  fixed_cost: [
    'gaji',
    'kasbon',
    'pelunasan_kasbon',
    'pengeluaran_lain',
    'try_error',
    'reversal_refund',
  ],
  net_profit: ['pembelian_aset', 'reversal_refund'],
};

const compact = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
    : Math.abs(n) >= 1_000
      ? `${(n / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
      : String(Math.round(n));

export default function CashFlowReportScreen({ bucket }: { bucket: Bucket }) {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));

  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [closingAll, setClosingAll] = useState(0);
  const [reserveTotalAll, setReserveTotalAll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [s, ent, sum, hpp] = await Promise.all([
          fetchFinanceSettings(),
          fetchCashFlowEntries(bucket, range.start, range.end),
          fetchCashFlowSummary(range.start, range.end),
          bucket === 'hpp' ? fetchHppMonths() : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setSettings(s);
        setEntries(ent);
        setClosingAll(sum.find((x) => x.bucket === bucket)?.closing ?? 0);
        setReserveTotalAll(hpp.length ? hpp[hpp.length - 1].reserveTotal : 0);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Gagal memuat laporan.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bucket, range.start, range.end]);

  // Ringkasan periode
  const totalIn = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalOut = -entries.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
  const allocationIn = entries
    .filter((e) => e.entryType === 'alokasi')
    .reduce((s, e) => s + e.amount, 0);
  const breakdown = BREAKDOWN_TYPES[bucket].map((t) => ({
    type: t,
    total: entries.filter((e) => e.entryType === t).reduce((s, e) => s + e.amount, 0),
  }));

  // Grafik: per hari; kalau rentang > 62 hari per bulan
  const chartData = useMemo(() => {
    const days = Math.round(
      (parseLocalDate(range.end).getTime() - parseLocalDate(range.start).getTime()) / 86400000
    );
    const monthly = days > 62;
    const keys: string[] = [];
    const cursor = parseLocalDate(range.start);
    const endDate = parseLocalDate(range.end);
    while (cursor <= endDate) {
      const k = monthly ? toLocalISO(cursor).slice(0, 7) : toLocalISO(cursor);
      if (keys[keys.length - 1] !== k) keys.push(k);
      cursor.setDate(cursor.getDate() + 1);
    }
    const map = new Map(keys.map((k) => [k, { masuk: 0, keluar: 0 }]));
    entries.forEach((e) => {
      const k = monthly ? e.entryDate.slice(0, 7) : e.entryDate;
      const v = map.get(k);
      if (!v) return;
      if (e.amount > 0) v.masuk += e.amount;
      else v.keluar -= e.amount;
    });
    return keys.map((k) => ({
      label: monthly
        ? parseLocalDate(`${k}-01`).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
        : String(parseLocalDate(k).getDate()),
      fullLabel: monthly
        ? parseLocalDate(`${k}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        : formatDate(k),
      ...map.get(k)!,
    }));
  }, [entries, range.start, range.end]);

  // Saldo berjalan dimulai dari 0 di awal periode
  const ledger: LedgerRow[] = useMemo(
    () =>
      entries.reduce<LedgerRow[]>((acc, e) => {
        const prev = acc.length ? acc[acc.length - 1].balance : 0;
        acc.push({ ...e, balance: prev + e.amount });
        return acc;
      }, []),
    [entries]
  );
  const rows = [...ledger].reverse();
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const label = BUCKET_LABELS[bucket];
  const periodText = rangeText(range);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<LedgerRow>({
        fileName: `Laporan Cash Flow ${label} ${range.start} sd ${range.end}`,
        title: `Laporan Cash Flow — ${label}`,
        subtitle: `Periode ${periodText}`,
        summary: [
          ['Total Alokasi Masuk', allocationIn],
          ['Total Masuk', totalIn],
          ['Total Keluar', totalOut],
          ['Saldo Periode', totalIn - totalOut],
          ...breakdown.map((b) => [ENTRY_TYPE_LABELS[b.type], b.total] as [string, number]),
          [`Saldo keseluruhan s/d ${formatDate(range.end)}`, closingAll],
        ],
        sheets: [
          {
            name: `Rincian ${label}`,
            rows: ledger,
            columns: [
              {
                header: 'Tanggal',
                width: 12,
                type: 'date',
                value: (r) => parseLocalDate(r.entryDate),
              },
              { header: 'Jenis', width: 18, value: (r) => ENTRY_TYPE_LABELS[r.entryType] },
              { header: 'Keterangan', width: 48, value: (r) => r.description },
              {
                header: 'Masuk (+)',
                width: 16,
                type: 'currency',
                value: (r) => (r.amount > 0 ? r.amount : null),
              },
              {
                header: 'Keluar (−)',
                width: 16,
                type: 'currency',
                value: (r) => (r.amount < 0 ? -r.amount : null),
              },
              { header: 'Saldo Berjalan', width: 18, type: 'currency', value: (r) => r.balance },
            ],
          },
        ],
      });
    } catch (err: any) {
      setError(err?.message ?? 'Gagal mengekspor laporan.');
    } finally {
      setExporting(false);
    }
  }

  const thClass =
    'py-[14px] text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title={`Laporan Cash Flow — ${label}`}
        info={BUCKET_INFO[bucket]}
        badge={periodText}
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
          setOpen(new Set());
        }}
      />

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Alokasi Masuk"
          value={allocationIn}
          hint={`${label} dari penjualan`}
        />
        <StatCard
          label="Total Pengeluaran"
          value={totalOut}
          hint={
            totalIn - allocationIn > 0
              ? `Masuk lainnya ${formatRupiah(totalIn - allocationIn)}`
              : undefined
          }
        />
        <StatCard
          label="Saldo Periode"
          value={totalIn - totalOut}
          tone="dark"
          hint="Masuk − Keluar di periode ini"
        />
        <StatCard
          label="Saldo Keseluruhan"
          value={closingAll}
          hint={`Akumulasi sejak awal s/d ${formatDate(range.end)} (boleh minus)`}
        />
      </div>

      {/* Rincian mini per jenis */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {breakdown.map((b) => (
          <div key={b.type} className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3">
            <p className="text-[11px] text-[#64748b]">{ENTRY_TYPE_LABELS[b.type]}</p>
            <p
              className={`font-mono text-sm font-bold ${b.total < 0 ? 'text-[#be123c]' : b.total > 0 ? 'text-[#047857]' : 'text-[#0f172a]'}`}
            >
              {formatRupiah(Math.abs(b.total))}
            </p>
          </div>
        ))}
      </div>

      {settings && bucket === 'hpp' && (
        <HppPanel
          month={computeHppPanel(entries, settings, range.end, today)}
          settings={settings}
          label={periodText}
          reserveTotalAll={reserveTotalAll}
        />
      )}
      {settings && bucket === 'net_profit' && (
        <NetProfitPanel
          month={computeProfitPanel(entries, settings, range.end)}
          settings={settings}
          label={periodText}
        />
      )}

      {/* Grafik tren */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-[25px]">
        <h3 className="text-base font-bold text-[#0f172a]">Tren {label}: Masuk vs Keluar</h3>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                width={64}
                tickFormatter={compact}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
              />
              <Tooltip
                formatter={(v: any, name: any) => [formatRupiah(Number(v)), name]}
                labelFormatter={(_: any, p: any) => p?.[0]?.payload?.fullLabel ?? ''}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="masuk"
                name="Masuk"
                stroke="#047857"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="keluar"
                name="Keluar"
                stroke="#be123c"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabel rincian */}
      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Tanggal</th>
                <th className={`${thClass} text-left`}>Jenis</th>
                <th className={`${thClass} text-left`}>Keterangan</th>
                <th className={`${thClass} text-right`}>Masuk (+)</th>
                <th className={`${thClass} text-right`}>Keluar (−)</th>
                <th className={`${thClass} pr-6 text-right`}>Saldo Berjalan</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat laporan...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#94a3b8]">
                    Belum ada catatan di periode ini.
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((e) => {
                  const isOpen = open.has(e.key);
                  return (
                    <Fragment key={e.key}>
                      <tr
                        className={`border-t border-[#f1f5f9] first:border-t-0 ${isOpen ? 'bg-[rgba(248,250,252,0.7)]' : ''}`}
                      >
                        <td className="py-3.5 pl-4 pr-3 text-sm text-[#475569]">
                          <button
                            onClick={() =>
                              setOpen((prev) => {
                                const next = new Set(prev);
                                if (next.has(e.key)) next.delete(e.key);
                                else next.add(e.key);
                                return next;
                              })
                            }
                            className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-[#f1f5f9]"
                            aria-label={isOpen ? 'Tutup rincian' : 'Lihat rincian'}
                          >
                            {isOpen ? (
                              <ChevronDown className="size-3.5 text-[#64748b]" />
                            ) : (
                              <ChevronRight className="size-3.5 text-[#64748b]" />
                            )}
                            {formatDate(e.entryDate)}
                          </button>
                        </td>
                        <td className="py-3.5 pr-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${ENTRY_TYPE_CLASSES[e.entryType]}`}
                          >
                            {ENTRY_TYPE_LABELS[e.entryType]}
                          </span>
                        </td>
                        <td className="max-w-[380px] py-3.5 pr-3 text-sm text-[#334155]">
                          {e.description}
                        </td>
                        <td className="py-3.5 pr-3 text-right font-mono text-sm font-semibold text-[#047857]">
                          {e.amount > 0 ? formatRupiah(e.amount) : ''}
                        </td>
                        <td className="py-3.5 pr-3 text-right font-mono text-sm font-semibold text-[#be123c]">
                          {e.amount < 0 ? formatRupiah(-e.amount) : ''}
                        </td>
                        <td
                          className={`py-3.5 pr-6 text-right font-mono text-sm font-bold ${e.balance < 0 ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}
                        >
                          {formatRupiah(e.balance)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-[rgba(248,250,252,0.7)]">
                          <td colSpan={6} className="px-6 pb-4 pt-1">
                            <CashFlowEntryDetail entry={e} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={rows.length}
          itemLabel="catatan"
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
