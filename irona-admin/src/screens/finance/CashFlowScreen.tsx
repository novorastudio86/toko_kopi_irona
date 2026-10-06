import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Lock,
  LockOpen,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import {
  deleteExpense,
  fetchCashFlowEntries,
  fetchCashFlowSummary,
  fetchFinanceSettings,
  fetchHppMonths,
  fetchOnlineBalance,
  fetchFinancePeriods,
  fetchPayrollForMonth,
  isPeriodLocked,
  type FinancePeriod,
} from '../../services/finance';
import type {
  Bucket,
  BucketSummary,
  CashFlowEntry,
  ExpenseType,
  FinanceSettings,
  HppMonth,
  NetProfitMonth,
  OnlineBalanceRow,
} from '../../types/finance';
import { formatRupiah } from '../../utils/format';
import { formatMonthLabel, toLocalISO, todayISO } from '../../utils/date';
import StockInModal from '../inventory/StockInModal';
import AssetFormModal from '../inventory/AssetFormModal';
import ExpenseFormModal from './ExpenseFormModal';
import CashFlowEntryDetail from './CashFlowEntryDetail';
import OnlineBalanceModal from './OnlineBalanceModal';
import PeriodCloseModal from './PeriodCloseModal';
import { computeHppPanel, computeProfitPanel } from './cashFlowCalc';
import {
  FixedCostBreakdown,
  HppPanel,
  NetProfitPanel,
  OnlineBalanceStrip,
  StatCard,
} from './CashFlowPanels';
import {
  BUCKET_LABELS,
  ENTRY_TYPE_CLASSES,
  ENTRY_TYPE_LABELS,
  MONTH_NAMES,
  daysInMonth,
  formatDate,
} from './cashFlowFormat';
import icPlus from '../../assets/ui/plus.svg';

type ViewMode = 'rincian' | 'harian' | 'bulanan';
type LedgerRow = CashFlowEntry & { balance: number };
type RecapRow = { key: string; label: string; totalIn: number; totalOut: number; balance: number };

const BUCKETS: Bucket[] = ['hpp', 'fixed_cost', 'net_profit'];

export default function CashFlowScreen() {
  const [bucket, setBucket] = useState<Bucket>('hpp');
  const [viewMode, setViewMode] = useState<ViewMode>('rincian');

  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [summary, setSummary] = useState<BucketSummary[]>([]);
  // Semua bucket di periode terpilih
  const [allEntries, setAllEntries] = useState<CashFlowEntry[]>([]);
  // HPP dari tanggal 1 bulan itu s/d akhir periode (batas belanja dihitung akumulasi)
  const [hppWindowEntries, setHppWindowEntries] = useState<CashFlowEntry[]>([]);
  const [hppMonths, setHppMonths] = useState<HppMonth[]>([]);
  const [online, setOnline] = useState<OnlineBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [form, setForm] = useState<
    | { kind: 'bahan_baku' }
    | { kind: 'aset' }
    | { kind: 'expense'; type: ExpenseType; expenseId: string | null }
    | null
  >(null);
  // Baris yang dibuka/ditutup manual (kunci diawali periode supaya reset saat filter berubah)
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const [onlineModal, setOnlineModal] = useState<'rincian' | 'cairkan' | null>(null);
  const [periods, setPeriods] = useState<FinancePeriod[]>([]);
  const [periodModal, setPeriodModal] = useState<{ focus: string | null } | null>(null);
  // Pengingat: karyawan yang gaji bulan lalunya belum dicatat
  const [unpaidSalary, setUnpaidSalary] = useState<{ name: string; amount: number }[]>([]);
  const [pendingOvertimeMinutes, setPendingOvertimeMinutes] = useState(0);

  // Periode: bulan + rentang tanggal di bulan itu (default: bulan ini, tgl 1 s/d hari ini)
  // Tanggal hari ini dibaca sekali saat halaman dibuka (Date bukan nilai murni untuk React Compiler)
  const [today] = useState(todayISO);
  const [todayY, todayM, todayD] = today.split('-').map(Number);
  const [year, setYear] = useState(todayY);
  const [month, setMonth] = useState(todayM);
  const [dayFrom, setDayFrom] = useState(1);
  const [dayTo, setDayTo] = useState(todayD);
  const lastDayOf = (y: number, m: number) =>
    y === todayY && m === todayM ? todayD : daysInMonth(y, m);
  const pad = (n: number) => String(n).padStart(2, '0');

  // Rekap Bulanan menampilkan Januari–Desember tahun terpilih
  const rangeStart =
    viewMode === 'bulanan' ? `${year}-01-01` : `${year}-${pad(month)}-${pad(dayFrom)}`;
  const rangeEnd =
    viewMode === 'bulanan'
      ? year === todayY
        ? today
        : `${year}-12-31`
      : `${year}-${pad(month)}-${pad(dayTo)}`;
  const hppWindowStart = viewMode === 'bulanan' ? rangeStart : `${year}-${pad(month)}-01`;

  const monthName = MONTH_NAMES[month - 1];
  const isSingleDay = viewMode !== 'bulanan' && dayFrom === dayTo && lastDayOf(year, month) > 1;
  const periodLabel =
    viewMode === 'bulanan'
      ? `Tahun ${year}`
      : isSingleDay
        ? `${dayTo} ${monthName} ${year}`
        : `${monthName} ${year}`;
  const hppLabel = isSingleDay && dayTo > 1 ? `1–${dayTo} ${monthName} ${year}` : periodLabel;

  // Bulan lalu (untuk pengingat gaji) & status tutup buku bulan terpilih
  const prevMonth = toLocalISO(new Date(todayY, todayM - 2, 1));
  const selectedMonthISO = `${year}-${pad(month)}-01`;
  const selectedPeriod = periods.find((p) => p.month.slice(0, 7) === selectedMonthISO.slice(0, 7));
  const openMonths = new Set(
    periods.filter((p) => p.status === 'dibuka').map((p) => p.month.slice(0, 7))
  );

  function choosePeriod(y: number, m: number) {
    // Bulan di masa depan tidak bisa dipilih
    const safeM = y === todayY ? Math.min(m, todayM) : m;
    setYear(y);
    setMonth(safeM);
    setDayFrom(1);
    setDayTo(lastDayOf(y, safeM));
    setPage(1);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, sum, ent, hppWin, hpp, ob, per, pay] = await Promise.all([
        fetchFinanceSettings(),
        fetchCashFlowSummary(rangeStart, rangeEnd),
        fetchCashFlowEntries(null, rangeStart, rangeEnd),
        fetchCashFlowEntries('hpp', hppWindowStart, rangeEnd),
        fetchHppMonths(),
        fetchOnlineBalance(),
        fetchFinancePeriods(),
        fetchPayrollForMonth(prevMonth),
      ]);
      setSettings(s);
      setSummary(sum);
      setAllEntries(ent);
      setHppWindowEntries(hppWin);
      setHppMonths(hpp);
      setOnline(ob);
      setPeriods(per);
      setPendingOvertimeMinutes(pay.reduce((sum, p) => sum + p.pendingOvertimeMinutes, 0));
      setUnpaidSalary(
        pay
          .filter((p) => !p.paid && p.totalSalary > 0)
          .map((p) => ({ name: p.fullName, amount: p.totalSalary }))
      );
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat data cash flow.');
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd, hppWindowStart, prevMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const current = summary.find((s) => s.bucket === bucket);
  const entries = useMemo(
    () => allEntries.filter((e) => e.bucket === bucket),
    [allEntries, bucket]
  );
  const periodBalance = (b: Bucket) =>
    allEntries.filter((e) => e.bucket === b).reduce((sum, e) => sum + e.amount, 0);
  const periodTotal = BUCKETS.reduce((sum, b) => sum + periodBalance(b), 0);
  const allTotal = summary.reduce((sum, x) => sum + x.currentBalance, 0);

  // Panel HPP: batas belanja akumulasi dari tanggal 1 s/d akhir periode
  const hppPanel: HppMonth | null = settings
    ? computeHppPanel(hppWindowEntries, settings, rangeEnd, today)
    : null;
  const reserveTotalAll = hppMonths.length ? hppMonths[hppMonths.length - 1].reserveTotal : 0;

  // Panel Net Profit: dibagi dari net profit periode terpilih
  const profitPanel: NetProfitMonth | null = settings
    ? computeProfitPanel(
        allEntries.filter((e) => e.bucket === 'net_profit'),
        settings,
        rangeEnd
      )
    : null;

  // Saldo Online: pesanan online di periode terpilih, dengan status saat ini
  const periodOnline = online.filter((r) => {
    const d = toLocalISO(new Date(r.transactionDate));
    return d >= rangeStart && d <= rangeEnd;
  });

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

  const recap: RecapRow[] = useMemo(() => {
    if (viewMode === 'rincian') return [];
    const groups = new Map<string, RecapRow>();
    ledger.forEach((e) => {
      const key = viewMode === 'harian' ? e.entryDate : e.entryDate.slice(0, 7);
      const row = groups.get(key) ?? {
        key,
        label:
          viewMode === 'harian'
            ? formatDate(e.entryDate)
            : new Date(`${key}-01T00:00:00`).toLocaleDateString('id-ID', {
                month: 'long',
                year: 'numeric',
              }),
        totalIn: 0,
        totalOut: 0,
        balance: 0,
      };
      if (e.amount > 0) row.totalIn += e.amount;
      else row.totalOut -= e.amount;
      row.balance = e.balance;
      groups.set(key, row);
    });
    return [...groups.values()].reverse();
  }, [ledger, viewMode]);

  // Tampilkan terbaru di atas
  const rows = viewMode === 'rincian' ? [...ledger].reverse() : recap;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleDeleteExpense(e: CashFlowEntry) {
    if (!e.refId || !window.confirm(`Hapus pengeluaran "${e.description}"?`)) return;
    try {
      await deleteExpense(e.refId);
      setFlash('Pengeluaran berhasil dihapus.');
      loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menghapus pengeluaran.');
    }
  }

  const onSaved = (message: string) => {
    setForm(null);
    setFlash(message);
    loadData();
  };

  const thClass =
    'py-[14px] text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';
  const filterClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';
  const pct = settings
    ? { hpp: settings.hppPct, fixed_cost: settings.fixedCostPct, net_profit: settings.netProfitPct }
    : null;

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Cash Flow"
        info="Pencatatan & pelacakan pembagian uang toko (bukan pemindahan uang sungguhan). Setiap penjualan bersih otomatis dibagi ke HPP, Fixed Cost, dan Net Profit; setiap pengeluaran dicatat keluar dari bucket-nya. Saldo boleh minus."
        badge={
          settings
            ? `HPP ${settings.hppPct}% · Fixed Cost ${settings.fixedCostPct}% · Net Profit ${settings.netProfitPct}%`
            : undefined
        }
        action={
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white outline-none hover:bg-[#1e293b]">
              <img src={icPlus} alt="" className="size-4" />
              Tambah Pengeluaran
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>HPP</DropdownMenuLabel>
                <DropdownMenuItem className="pl-5" onClick={() => setForm({ kind: 'bahan_baku' })}>
                  Bahan Baku
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Fixed Cost</DropdownMenuLabel>
                <DropdownMenuItem
                  className="pl-5"
                  onClick={() => setForm({ kind: 'expense', type: 'gaji', expenseId: null })}
                >
                  Pembayaran Gaji
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="pl-5"
                  onClick={() => setForm({ kind: 'expense', type: 'lain', expenseId: null })}
                >
                  Pengeluaran Lain
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Net Profit</DropdownMenuLabel>
                <DropdownMenuItem className="pl-5" onClick={() => setForm({ kind: 'aset' })}>
                  Pembelian Aset
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-xs font-medium text-[#0f172a]">
          <CheckCircle2 className="size-4 text-[#059669]" />
          {flash}
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      {pendingOvertimeMinutes > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
          <p className="flex items-start gap-2 text-xs text-[#92400e]">
            <AlertTriangle className="mt-px size-4 shrink-0" />
            <span>
              <b>Lembur {formatMonthLabel(prevMonth)} belum diputuskan</b> ({pendingOvertimeMinutes}{' '}
              menit). Setujui atau tolak di Karyawan › Presensi sebelum membayar gaji — lembur yang
              belum disetujui tidak ikut dibayar.
            </span>
          </p>
          <Link
            to="/employee/presence"
            className="shrink-0 rounded-lg border border-[#fcd34d] bg-white px-3 py-1.5 text-xs font-semibold text-[#92400e] hover:bg-[#fef3c7]"
          >
            Buka Presensi
          </Link>
        </div>
      )}

      {unpaidSalary.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
          <p className="flex items-start gap-2 text-xs text-[#92400e]">
            <AlertTriangle className="mt-px size-4 shrink-0" />
            <span>
              <b>Gaji {formatMonthLabel(prevMonth)} belum dicatat</b> untuk{' '}
              {unpaidSalary.map((u) => `${u.name} (${formatRupiah(u.amount)})`).join(', ')}. Catat
              supaya Fixed Cost sesuai uang yang benar-benar keluar.
            </span>
          </p>
          <button
            onClick={() => setForm({ kind: 'expense', type: 'gaji', expenseId: null })}
            className="shrink-0 rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b]"
          >
            Catat Gaji
          </button>
        </div>
      )}

      <OnlineBalanceStrip
        rows={periodOnline}
        periodLabel={periodLabel}
        onOpen={() => setOnlineModal('rincian')}
        onDisburse={() => setOnlineModal('cairkan')}
      />

      {/* Periode & mode tampilan */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {viewMode !== 'bulanan' && (
            <select
              value={month}
              onChange={(e) => choosePeriod(year, Number(e.target.value))}
              className={`${filterClass} w-40`}
              aria-label="Bulan"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1} disabled={year === todayY && i + 1 > todayM}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <select
            value={year}
            onChange={(e) => choosePeriod(Number(e.target.value), month)}
            className={`${filterClass} w-24`}
            aria-label="Tahun"
          >
            {[todayY - 2, todayY - 1, todayY].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {viewMode === 'bulanan' ? (
            <span className="pl-1 text-xs text-[#64748b]">Rekap Januari – Desember {year}</span>
          ) : (
            <>
              <select
                value={
                  dayFrom === dayTo && !(dayFrom === 1 && lastDayOf(year, month) === 1)
                    ? dayFrom
                    : ''
                }
                onChange={(e) => {
                  const d = Number(e.target.value);
                  // Kosong = semua tanggal di bulan itu
                  setDayFrom(d || 1);
                  setDayTo(d || lastDayOf(year, month));
                  setPage(1);
                }}
                className={`${filterClass} w-40`}
                aria-label="Tanggal"
              >
                <option value="">Semua Tanggal</option>
                {Array.from({ length: lastDayOf(year, month) }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Tanggal {d}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="flex gap-1 rounded-xl bg-[#f1f5f9] p-1">
          {(
            [
              ['rincian', 'Rincian'],
              ['harian', 'Rekap Harian'],
              ['bulanan', 'Rekap Bulanan'],
            ] as [ViewMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                viewMode === mode
                  ? 'bg-white text-[#0f172a] shadow-sm'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Status tutup buku bulan terpilih */}
      {viewMode !== 'bulanan' && (
        <div
          className={`-mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs ${
            selectedPeriod?.status === 'tertutup'
              ? 'bg-[#f1f5f9] text-[#334155]'
              : selectedPeriod?.status === 'dibuka'
                ? 'bg-[#fffbeb] text-[#92400e]'
                : 'bg-[#ecfdf5] text-[#047857]'
          }`}
        >
          <span className="flex items-center gap-2">
            {selectedPeriod?.status === 'tertutup' ? (
              <Lock className="size-3.5" />
            ) : (
              <LockOpen className="size-3.5" />
            )}
            {selectedPeriod?.status === 'tertutup' && (
              <span>
                <b>
                  {monthName} {year} sudah tutup buku
                </b>{' '}
                — data hanya bisa dilihat.
              </span>
            )}
            {selectedPeriod?.status === 'dibuka' && (
              <span>
                <b>
                  {monthName} {year} sedang dibuka kembali
                </b>{' '}
                oleh {selectedPeriod.openedByName ?? '—'}: {selectedPeriod.reason}
              </span>
            )}
            {(!selectedPeriod || selectedPeriod.status === 'berjalan') && (
              <span>
                <b>Bulan berjalan</b> — otomatis tutup buku saat masuk bulan berikutnya.
              </span>
            )}
          </span>
          <button
            onClick={() =>
              setPeriodModal({
                focus: selectedPeriod?.status === 'tertutup' ? selectedMonthISO : null,
              })
            }
            className="rounded-lg border border-current/20 bg-white/70 px-3 py-1 text-[11px] font-semibold hover:bg-white"
          >
            {selectedPeriod?.status === 'tertutup'
              ? 'Buka Kembali'
              : selectedPeriod?.status === 'dibuka'
                ? 'Tutup Kembali'
                : 'Riwayat Tutup Buku'}
          </button>
        </div>
      )}

      {/* Tab bucket */}
      <div className="flex gap-2 border-b border-[#e2e8f0]">
        {BUCKETS.map((b) => {
          const saldo = periodBalance(b);
          return (
            <button
              key={b}
              onClick={() => {
                setBucket(b);
                setPage(1);
              }}
              className={`-mb-px flex flex-col items-start border-b-2 px-4 pb-2.5 pt-1 text-left ${
                bucket === b
                  ? 'border-[#0f172a] text-[#0f172a]'
                  : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <span className="text-sm font-bold">
                {BUCKET_LABELS[b]}
                {pct && <span className="pl-1.5 text-[11px] font-medium">{pct[b]}%</span>}
              </span>
              <span className={`font-mono text-[11px] ${saldo < 0 ? 'text-[#e11d48]' : ''}`}>
                {loading ? '—' : formatRupiah(saldo)}
              </span>
            </button>
          );
        })}
        {/* Total gabungan ketiga bucket (informasi, bukan tab) */}
        <div className="-mb-px ml-auto flex flex-col items-end border-b-2 border-transparent border-l border-l-[#e2e8f0] px-4 pb-2.5 pt-1 text-right">
          <span className="text-sm font-bold text-[#0f172a]">
            Total<span className="pl-1.5 text-[11px] font-medium text-[#64748b]">100%</span>
          </span>
          <span
            className={`font-mono text-[11px] font-semibold ${periodTotal < 0 ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}
          >
            {loading ? '—' : formatRupiah(periodTotal)}
          </span>
        </div>
      </div>
      {summary.length > 0 && (
        <p className="-mt-3 text-[11px] text-[#94a3b8]">
          Saldo keseluruhan sejak awal —{' '}
          {BUCKETS.map((b, i) => {
            const all = summary.find((x) => x.bucket === b)?.currentBalance ?? 0;
            return (
              <span key={b}>
                {i > 0 && ' · '}
                {BUCKET_LABELS[b]}{' '}
                <span className={`font-mono ${all < 0 ? 'text-[#e11d48]' : 'text-[#475569]'}`}>
                  {formatRupiah(all)}
                </span>
              </span>
            );
          })}
          {' · '}
          <span className="font-semibold text-[#64748b]">Total</span>{' '}
          <span
            className={`font-mono font-semibold ${allTotal < 0 ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}
          >
            {formatRupiah(allTotal)}
          </span>
        </p>
      )}

      {current && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label={`Masuk · ${periodLabel}`} value={current.totalIn} />
          <StatCard label={`Keluar · ${periodLabel}`} value={current.totalOut} />
          <StatCard
            label={`Saldo · ${periodLabel}`}
            value={current.totalIn - current.totalOut}
            tone="dark"
            hint="Masuk − Keluar di periode ini"
          />
        </div>
      )}

      {settings && bucket === 'hpp' && (
        <HppPanel
          month={hppPanel}
          settings={settings}
          label={hppLabel}
          reserveTotalAll={reserveTotalAll}
        />
      )}
      {bucket === 'fixed_cost' && <FixedCostBreakdown entries={entries} />}
      {settings && bucket === 'net_profit' && (
        <NetProfitPanel month={profitPanel} settings={settings} label={periodLabel} />
      )}

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          {viewMode === 'rincian' ? (
            <table className="w-full min-w-[1000px] border-collapse">
              <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
                <tr>
                  <th className={`${thClass} pl-6 text-left`}>Tanggal</th>
                  <th className={`${thClass} text-left`}>Jenis</th>
                  <th className={`${thClass} text-left`}>Keterangan</th>
                  <th className={`${thClass} text-right`}>Masuk (+)</th>
                  <th className={`${thClass} text-right`}>Keluar (−)</th>
                  <th className={`${thClass} text-right`}>Saldo Berjalan</th>
                  <th className={`${thClass} pr-6 text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-[#94a3b8]">
                      Memuat riwayat...
                    </td>
                  </tr>
                )}
                {!loading && paged.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-[#94a3b8]">
                      Belum ada catatan di periode ini.
                    </td>
                  </tr>
                )}
                {!loading &&
                  (paged as LedgerRow[]).map((e) => {
                    const editable =
                      e.refTable === 'finance_expenses' &&
                      !isPeriodLocked(e.entryDate, today, openMonths);
                    // Filter 1 tanggal: rincian alokasi langsung terbuka; selain itu lewat dropdown
                    const toggleKey = `${rangeStart}|${rangeEnd}|${e.key}`;
                    const defaultOpen = isSingleDay && e.entryType === 'alokasi';
                    const open = defaultOpen !== toggled.has(toggleKey);
                    const toggle = () =>
                      setToggled((prev) => {
                        const next = new Set(prev);
                        if (next.has(toggleKey)) next.delete(toggleKey);
                        else next.add(toggleKey);
                        return next;
                      });
                    return (
                      <Fragment key={e.key}>
                        <tr
                          className={`border-t border-[#f1f5f9] first:border-t-0 ${open ? 'bg-[rgba(248,250,252,0.7)]' : ''}`}
                        >
                          <td className="py-3.5 pl-4 pr-3 text-xs text-[#475569]">
                            <button
                              onClick={toggle}
                              className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-[#f1f5f9]"
                              aria-label={open ? 'Tutup rincian' : 'Lihat rincian'}
                            >
                              {open ? (
                                <ChevronDown className="size-3.5 text-[#64748b]" />
                              ) : (
                                <ChevronRight className="size-3.5 text-[#64748b]" />
                              )}
                              {formatDate(e.entryDate)}
                            </button>
                          </td>
                          <td className="py-3.5 pr-3">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold ${ENTRY_TYPE_CLASSES[e.entryType]}`}
                            >
                              {ENTRY_TYPE_LABELS[e.entryType]}
                            </span>
                          </td>
                          <td className="max-w-[360px] py-3.5 pr-3 text-xs text-[#334155]">
                            {e.description}
                          </td>
                          <td className="py-3.5 pr-3 text-right font-mono text-xs font-semibold text-[#047857]">
                            {e.amount > 0 ? formatRupiah(e.amount) : ''}
                          </td>
                          <td className="py-3.5 pr-3 text-right font-mono text-xs font-semibold text-[#be123c]">
                            {e.amount < 0 ? formatRupiah(-e.amount) : ''}
                          </td>
                          <td
                            className={`py-3.5 pr-3 text-right font-mono text-xs font-bold ${e.balance < 0 ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}
                          >
                            {formatRupiah(e.balance)}
                          </td>
                          <td className="py-3.5 pr-6">
                            <div className="flex items-center justify-end gap-1">
                              {!editable && <span className="text-[11px] text-[#cbd5e1]">—</span>}
                              {editable && e.refId && (
                                <>
                                  <button
                                    onClick={() =>
                                      setForm({
                                        kind: 'expense',
                                        type: e.entryType === 'gaji' ? 'gaji' : 'lain',
                                        expenseId: e.refId,
                                      })
                                    }
                                    aria-label="Ubah"
                                    className="rounded-lg p-1.5 text-[#475569] hover:bg-[#f1f5f9]"
                                  >
                                    <Pencil className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExpense(e)}
                                    aria-label="Hapus"
                                    className="rounded-lg p-1.5 text-[#475569] hover:bg-[#fff1f2] hover:text-[#e11d48]"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-[rgba(248,250,252,0.7)]">
                            <td colSpan={7} className="px-6 pb-4 pt-1">
                              <CashFlowEntryDetail entry={e} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[700px] border-collapse">
              <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
                <tr>
                  <th className={`${thClass} pl-6 text-left`}>
                    {viewMode === 'harian' ? 'Tanggal' : 'Bulan'}
                  </th>
                  <th className={`${thClass} text-right`}>Masuk (+)</th>
                  <th className={`${thClass} text-right`}>Keluar (−)</th>
                  <th className={`${thClass} text-right`}>Selisih</th>
                  <th className={`${thClass} pr-6 text-right`}>Saldo Akhir</th>
                </tr>
              </thead>
              <tbody>
                {!loading && paged.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-[#94a3b8]">
                      Belum ada catatan di periode ini.
                    </td>
                  </tr>
                )}
                {(paged as RecapRow[]).map((r) => {
                  const diff = r.totalIn - r.totalOut;
                  return (
                    <tr key={r.key} className="border-t border-[#f1f5f9] first:border-t-0">
                      <td className="py-3.5 pl-6 text-xs font-semibold text-[#0f172a]">
                        {r.label}
                      </td>
                      <td className="py-3.5 text-right font-mono text-xs text-[#047857]">
                        {formatRupiah(r.totalIn)}
                      </td>
                      <td className="py-3.5 text-right font-mono text-xs text-[#be123c]">
                        {formatRupiah(r.totalOut)}
                      </td>
                      <td
                        className={`py-3.5 text-right font-mono text-xs font-semibold ${diff < 0 ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}
                      >
                        {diff < 0 ? '−' : '+'}
                        {formatRupiah(Math.abs(diff))}
                      </td>
                      <td
                        className={`py-3.5 pr-6 text-right font-mono text-xs font-bold ${r.balance < 0 ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}
                      >
                        {formatRupiah(r.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={rows.length}
          itemLabel={viewMode === 'rincian' ? 'catatan' : viewMode === 'harian' ? 'hari' : 'bulan'}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <p className="text-[11px] leading-4 text-[#94a3b8]">
        Alokasi otomatis dihitung dari Penjualan Bersih (total setelah diskon; pesanan online
        dikurangi MDR Midtrans). Refund membalik alokasi di ketiga bucket. Pembayaran Gaji &
        Pengeluaran Lain bisa diubah/dihapus selama masih di bulan yang sama; catatan lain mengikuti
        modul asalnya (Kelola Stok, Kasbon, Aset Barang, Penyesuaian Transaksi).
      </p>

      {form?.kind === 'bahan_baku' && (
        <StockInModal
          onClose={() => setForm(null)}
          onSaved={(name) => onSaved(`Belanja bahan "${name}" tercatat di HPP & stok bertambah.`)}
        />
      )}
      {form?.kind === 'aset' && (
        <AssetFormModal
          asset={null}
          onClose={() => setForm(null)}
          onSaved={(name) => onSaved(`Pembelian aset "${name}" tercatat di Net Profit (BEP).`)}
        />
      )}
      {form?.kind === 'expense' && (
        <ExpenseFormModal
          type={form.type}
          expenseId={form.expenseId}
          onClose={() => setForm(null)}
          onSaved={onSaved}
        />
      )}
      {periodModal && (
        <PeriodCloseModal
          focusMonth={periodModal.focus}
          onClose={() => setPeriodModal(null)}
          onChanged={(message) => {
            setFlash(message);
            loadData();
          }}
        />
      )}
      {onlineModal && (
        <OnlineBalanceModal
          initialTab={onlineModal === 'cairkan' ? 'cairkan' : 'transaksi'}
          period={{ start: rangeStart, end: rangeEnd, label: periodLabel }}
          onClose={() => setOnlineModal(null)}
          onChanged={(message) => {
            setFlash(message);
            loadData();
          }}
        />
      )}
    </div>
  );
}
