import { useState, type ReactNode } from 'react';
import { AlertTriangle, Info, Wallet } from 'lucide-react';
import type {
  CashFlowEntry,
  FinanceSettings,
  HppMonth,
  NetProfitMonth,
  OnlineBalanceRow,
} from '../../types/finance';
import { formatRupiah } from '../../utils/format';

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  format = 'rupiah',
  children,
}: {
  label: string;
  value: number;
  hint?: ReactNode;
  tone?: 'default' | 'dark';
  /** 'number' untuk jumlah (transaksi, produk) */
  format?: 'rupiah' | 'number';
  children?: ReactNode;
}) {
  const dark = tone === 'dark';
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl border p-4 ${
        dark ? 'border-[#0f172a] bg-[#0f172a]' : 'border-[#e2e8f0] bg-white'
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-[0.55px] ${dark ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}
      >
        {label}
      </p>
      <p
        className={`font-mono text-lg font-bold ${
          dark ? 'text-white' : value < 0 ? 'text-[#e11d48]' : 'text-[#0f172a]'
        }`}
      >
        {format === 'number' ? value.toLocaleString('id-ID') : formatRupiah(value)}
      </p>
      {hint && (
        <p className={`text-xs leading-4 ${dark ? 'text-[#cbd5e1]' : 'text-[#94a3b8]'}`}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

/* ---------- HPP: batas belanja 80% & Saldo Mengendap ---------- */
export function HppPanel({
  month,
  settings,
  label,
  reserveTotalAll,
}: {
  month: HppMonth | null;
  settings: FinanceSettings;
  label: string;
  /** Saldo Mengendap terkumpul sejak awal (akumulasi semua bulan) */
  reserveTotalAll: number;
}) {
  if (!month) return null;
  const used = month.budget > 0 ? Math.min(100, (month.spent / month.budget) * 100) : 0;
  const over = month.remaining < 0;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-4 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.55px] text-[#64748b]">
              Batas Belanja Bahan Baku · {label}
            </p>
            <p className="text-xs text-[#94a3b8]">
              {settings.hppBudgetPct}% dari alokasi HPP {label} ({formatRupiah(month.allocation)})
            </p>
          </div>
          <p className="font-mono text-lg font-bold text-[#0f172a]">{formatRupiah(month.budget)}</p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f5f9]">
          <div
            className={`h-full rounded-full ${over ? 'bg-[#e11d48]' : used > 85 ? 'bg-[#f59e0b]' : 'bg-[#0f172a]'}`}
            style={{ width: `${over ? 100 : used}%` }}
          />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <span className="text-[#475569]">
            Terpakai <span className="font-mono font-semibold">{formatRupiah(month.spent)}</span>
          </span>
          <span className={over ? 'font-semibold text-[#e11d48]' : 'text-[#475569]'}>
            {over ? 'Melebihi batas ' : 'Sisa '}
            <span className="font-mono font-semibold">
              {formatRupiah(Math.abs(month.remaining))}
            </span>
          </span>
        </div>
        {over && (
          <p className="flex items-start gap-1.5 rounded-lg bg-[#fff1f2] px-3 py-2 text-xs leading-4 text-[#be123c]">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            Belanja bahan sudah melewati batas {settings.hppBudgetPct}%. Tetap tercatat — ini hanya
            peringatan.
          </p>
        )}
        {!month.isClosed && month.remaining > 0 && (
          <p className="text-xs text-[#94a3b8]">
            Sisa batas belanja yang tidak terpakai otomatis masuk Saldo Mengendap saat bulan
            berganti.
          </p>
        )}
      </div>
      <StatCard
        label="Saldo Mengendap"
        value={month.reserveShare}
        tone="dark"
        hint={`${100 - settings.hppBudgetPct}% alokasi HPP ${label}. Total terkumpul sejak awal (termasuk sisa batas belanja bulan lalu): ${formatRupiah(reserveTotalAll)}`}
      />
    </div>
  );
}

/* ---------- Fixed Cost: rincian per jenis ---------- */
export function FixedCostBreakdown({ entries }: { entries: CashFlowEntry[] }) {
  const sum = (types: string[]) =>
    entries.filter((e) => types.includes(e.entryType)).reduce((s, e) => s + e.amount, 0);
  const items = [
    { label: 'Gaji', value: -sum(['gaji']) },
    { label: 'Kasbon (bersih)', value: -sum(['kasbon', 'pelunasan_kasbon']) },
    { label: 'Pengeluaran Lain', value: -sum(['pengeluaran_lain']) },
    { label: 'Try & Error', value: -sum(['try_error']) },
    { label: 'Reversal Refund', value: -sum(['reversal_refund']) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748b]">{i.label}</p>
          <p className="font-mono text-sm font-bold text-[#0f172a]">{formatRupiah(i.value)}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Net Profit: BEP / Owner / Manager untuk periode terpilih ---------- */
export function NetProfitPanel({
  month,
  settings,
  label,
}: {
  month: NetProfitMonth | null;
  settings: FinanceSettings;
  label: string;
}) {
  const [showOwner, setShowOwner] = useState(false);
  if (!month) return null;
  const bepEffect = month.bepBalance;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-[0.55px] text-[#64748b]">
        Pembagian Net Profit · {label}
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Net Profit"
          value={month.netProfit}
          tone="dark"
          hint={`${settings.bepPct}% BEP · ${settings.ownerPct}% Owner · ${settings.managerPct}% Manager`}
        />
        <StatCard
          label="BEP"
          value={month.bepBalance}
          hint={`Jatah ${formatRupiah(month.bepShare)} − aset ${formatRupiah(month.assetSpent)}`}
        >
          {bepEffect < 0 && (
            <p className="text-xs font-semibold text-[#e11d48]">Kekurangan ditanggung Owner</p>
          )}
          {bepEffect > 0 && (
            <p className="text-xs text-[#047857]">Sisa BEP ikut masuk ke Owner</p>
          )}
        </StatCard>
        <div
          className="relative"
          onMouseEnter={() => setShowOwner(true)}
          onMouseLeave={() => setShowOwner(false)}
        >
          <button className="w-full text-left" onClick={() => setShowOwner((v) => !v)}>
            <StatCard
              label="Owner"
              value={month.ownerBalance}
              hint={
                <span className="flex items-center gap-1">
                  <Info className="size-3" />
                  Sudah termasuk efek BEP — sorot untuk rincian
                </span>
              }
            />
          </button>
          {showOwner && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 flex flex-col gap-1 rounded-xl border border-[#e2e8f0] bg-white p-3 text-xs shadow-lg">
              <div className="flex justify-between">
                <span className="text-[#64748b]">Jatah {settings.ownerPct}% murni</span>
                <span className="font-mono">{formatRupiah(month.ownerShare)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">
                  {bepEffect < 0 ? 'Menanggung kekurangan BEP' : 'Sisa BEP'}
                </span>
                <span
                  className={`font-mono ${bepEffect < 0 ? 'text-[#e11d48]' : 'text-[#047857]'}`}
                >
                  {bepEffect < 0 ? '−' : '+'}
                  {formatRupiah(Math.abs(bepEffect))}
                </span>
              </div>
              <div className="flex justify-between border-t border-[#e2e8f0] pt-1 font-bold">
                <span>Saldo Owner</span>
                <span className="font-mono">{formatRupiah(month.ownerBalance)}</span>
              </div>
            </div>
          )}
        </div>
        <StatCard
          label="Manager"
          value={month.managerBalance}
          hint={`Jatah ${settings.managerPct}% — tidak terpengaruh BEP`}
        />
      </div>
    </div>
  );
}

/* ---------- Saldo Online (Midtrans) ---------- */
export function OnlineBalanceStrip({
  rows,
  periodLabel,
  onOpen,
  onDisburse,
}: {
  rows: OnlineBalanceRow[];
  periodLabel: string;
  onOpen: () => void;
  onDisburse: () => void;
}) {
  const total = (status: string) =>
    rows.filter((r) => r.status === status).reduce((s, r) => s + r.netAmount, 0);
  const tersedia = total('tersedia');
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-5 lg:flex-row lg:items-center">
      <div className="flex items-center gap-3 lg:w-64">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#f1f5f9]">
          <Wallet className="size-5 text-[#334155]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#0f172a]">Saldo Online</p>
          <p className="text-xs leading-4 text-[#64748b]">
            Pesanan online {periodLabel} via Midtrans (bersih setelah MDR), status saat ini
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-3">
        {[
          { label: 'Tertahan', value: total('tertahan'), hint: 'Belum 3 hari kerja' },
          { label: 'Tersedia', value: tersedia, hint: 'Bisa ditarik di Midtrans' },
          { label: 'Sudah Dicairkan', value: total('dicairkan'), hint: 'Sudah masuk rekening' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-[#f8fafc] px-3 py-2">
            <p className="text-xs text-[#64748b]">{c.label}</p>
            <p className="font-mono text-sm font-bold text-[#0f172a]">{formatRupiah(c.value)}</p>
            <p className="text-xs text-[#94a3b8]">{c.hint}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onOpen}
          className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
        >
          Rincian
        </button>
        <button
          onClick={onDisburse}
          disabled={tersedia <= 0}
          className="rounded-lg bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-40"
        >
          Catat Pencairan
        </button>
      </div>
    </div>
  );
}
