import { useEffect, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchCashierIncome } from '../../services/storeReports';
import type { CashierIncomeRow } from '../../types/storeReport';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import { formatDateTime } from './salesReportFormat';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function duration(from: string, to: string | null): string {
  if (!to) return 'masih login';
  const min = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  return `${Math.floor(min / 60)}j ${min % 60}m`;
}

export default function CashierIncomeReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [search, setSearch] = useState('');
  const [cashierId, setCashierId] = useState('');

  const [rows, setRows] = useState<CashierIncomeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCashierIncome(range.start, range.end)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  // Pilihan kasir = yang punya sesi di periode ini
  const cashiers = [...new Map(rows.map((r) => [r.employeeId, r.cashierName])).entries()].sort(
    (a, b) => a[1].localeCompare(b[1])
  );
  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (!cashierId || r.employeeId === cashierId) &&
      (!q ||
        r.cashierName.toLowerCase().includes(q) ||
        formatDateTime(r.loginAt).toLowerCase().includes(q))
  );
  const sum = (f: (r: CashierIncomeRow) => number) => filtered.reduce((s, r) => s + f(r), 0);
  const totals = {
    transactions: sum((r) => r.transactions),
    cash: sum((r) => r.cashAmount),
    nonCash: sum((r) => r.nonCashAmount),
    online: sum((r) => r.onlineAmount),
    total: sum((r) => r.totalAmount),
    refund: sum((r) => r.refundAmount),
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<CashierIncomeRow>({
        fileName: `Laporan Pendapatan Kasir ${range.start} sd ${range.end}`,
        title: 'Laporan Pendapatan Kasir',
        subtitle: `Periode ${rangeText(range)}${cashierId ? ` · ${cashiers.find((c) => c[0] === cashierId)?.[1]}` : ''}`,
        summary: [
          ['Total Sesi', String(filtered.length)],
          ['Total Transaksi', String(totals.transactions)],
          ['Total Penerimaan', totals.total],
          ['Tunai', totals.cash],
          ['Non-tunai', totals.nonCash],
          ['Online', totals.online],
          ['Refund', totals.refund],
        ],
        sheets: [
          {
            name: 'Per Shift',
            rows: filtered,
            columns: [
              { header: 'Nama Kasir', width: 20, value: (r) => r.cashierName },
              { header: 'Login', width: 18, value: (r) => formatDateTime(r.loginAt) },
              { header: 'Logout', width: 18, value: (r) => formatDateTime(r.logoutAt) },
              {
                header: 'Total Transaksi',
                width: 14,
                type: 'number',
                value: (r) => r.transactions,
              },
              { header: 'Tunai', width: 14, type: 'currency', value: (r) => r.cashAmount },
              { header: 'Non-tunai', width: 14, type: 'currency', value: (r) => r.nonCashAmount },
              { header: 'Online', width: 14, type: 'currency', value: (r) => r.onlineAmount },
              {
                header: 'Total Penerimaan',
                width: 16,
                type: 'currency',
                value: (r) => r.totalAmount,
              },
              {
                header: 'Kas Keluar (info)',
                width: 16,
                type: 'currency',
                value: (r) => r.cashOutAmount,
              },
              { header: 'Refund', width: 14, type: 'currency', value: (r) => r.refundAmount },
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
        breadcrumb={['Laporan', 'Laporan Toko', 'Laporan Pendapatan Kasir']}
        title="Laporan Pendapatan Kasir"
        info="Rekap per sesi login–logout kasir di Kasir App. Penerimaan = yang dibayar pelanggan (termasuk ongkir & biaya layanan untuk online). Kas Keluar = kasbon yang dibuat Admin selama sesi, hanya informasi (tidak dipakai menghitung selisih)."
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari kasir / tanggal..."
              className={`${filterClass} w-52 pl-8`}
              aria-label="Cari"
            />
          </div>
          <select
            value={cashierId}
            onChange={(e) => {
              setCashierId(e.target.value);
              setPage(1);
            }}
            className={filterClass}
            aria-label="Kasir"
          >
            <option value="">Semua Kasir</option>
            {cashiers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
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
        <StatCard
          label="Total Penerimaan"
          value={totals.total}
          hint={`${filtered.length} sesi · ${totals.transactions.toLocaleString('id-ID')} transaksi`}
        />
        <StatCard label="Tunai" value={totals.cash} />
        <StatCard label="Non-tunai" value={totals.nonCash} />
        <StatCard label="Online" value={totals.online} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Login – Logout</th>
                <th className={`${thClass} text-left`}>Nama Kasir</th>
                <th className={`${thClass} text-right`}>Transaksi</th>
                <th className={`${thClass} text-right`}>Tunai</th>
                <th className={`${thClass} text-right`}>Non-tunai</th>
                <th className={`${thClass} text-right`}>Online</th>
                <th className={`${thClass} text-right`}>Total Penerimaan</th>
                <th className={`${thClass} text-right`}>Kas Keluar (info)</th>
                <th className={`${thClass} pr-6 text-right`}>Refund</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-[#94a3b8]">
                    {rows.length ? 'Sesi tidak ditemukan.' : 'Belum ada sesi kasir di periode ini.'}
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => (
                  <tr
                    key={r.sessionId}
                    className="border-t border-[#f1f5f9] first:border-t-0 text-xs"
                  >
                    <td className="py-3 pl-6 pr-3">
                      <p className="font-semibold text-[#0f172a]">
                        {new Date(r.loginAt).toLocaleDateString('id-ID', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="font-mono text-[11px] text-[#64748b]">
                        {formatTime(r.loginAt)} – {formatTime(r.logoutAt)}
                        <span className="ml-1.5 font-sans text-[#94a3b8]">
                          ({duration(r.loginAt, r.logoutAt)})
                        </span>
                      </p>
                    </td>
                    <td className="py-3 pr-3 text-[#0f172a]">{r.cashierName}</td>
                    <td className="py-3 pr-3 text-right font-mono">{r.transactions}</td>
                    <td className="py-3 pr-3 text-right font-mono">{formatRupiah(r.cashAmount)}</td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {formatRupiah(r.nonCashAmount)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {formatRupiah(r.onlineAmount)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold text-[#0f172a]">
                      {formatRupiah(r.totalAmount)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-[#64748b]">
                      {r.cashOutCount ? (
                        <>
                          {formatRupiah(r.cashOutAmount)}
                          <span className="ml-1 font-sans text-[11px] text-[#94a3b8]">
                            ({r.cashOutCount} kasbon)
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 pr-6 text-right font-mono text-[#be123c]">
                      {r.refundCount ? formatRupiah(r.refundAmount) : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
          itemLabel="sesi"
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
