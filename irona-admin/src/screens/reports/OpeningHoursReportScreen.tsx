import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchOpeningHours } from '../../services/storeReports';
import type { OpeningHourRow } from '../../types/storeReport';
import { formatClock, parseLocalDate, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function shiftText(login: string | null, logout: string | null): string {
  if (!login) return '—';
  return `${formatTime(login)} – ${logout ? formatTime(logout) : 'belum logout'}`;
}

function minutesText(min: number): string {
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  return h > 0 ? `${h}j ${abs % 60}m` : `${abs}m`;
}

/** Teks selisih buka/tutup vs jadwal. Buka telat & tutup cepat = kurang baik */
function diffText(kind: 'open' | 'close', min: number | null): string {
  if (min === null) return '—';
  if (min === 0) return 'Tepat';
  const late = min > 0;
  if (kind === 'open') return `${late ? 'Telat' : 'Lebih awal'} ${minutesText(min)}`;
  return `${late ? 'Lebih lambat' : 'Lebih cepat'} ${minutesText(min)}`;
}

function DiffBadge({ kind, min }: { kind: 'open' | 'close'; min: number | null }) {
  const bad = min !== null && (kind === 'open' ? min > 0 : min < 0);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        min === null
          ? 'text-[#94a3b8]'
          : bad
            ? 'bg-[#fff1f2] text-[#be123c]'
            : 'bg-[#f1f5f9] text-[#475569]'
      }`}
    >
      {kind === 'open' ? 'Buka' : 'Tutup'}: {diffText(kind, min)}
    </span>
  );
}

export default function OpeningHoursReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));

  const [rows, setRows] = useState<OpeningHourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOpeningHours(range.start, range.end)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const gapDays = rows.filter((r) => (r.gapMinutes ?? 0) > 0).length;
  const lateOpen = rows.filter((r) => (r.openDiffMinutes ?? 0) > 0).length;
  const earlyClose = rows.filter((r) => (r.closeDiffMinutes ?? 0) < 0).length;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<OpeningHourRow>({
        fileName: `Laporan Jam Operasional ${range.start} sd ${range.end}`,
        title: 'Laporan Jam Operasional',
        subtitle: `Periode ${rangeText(range)}`,
        summary: [
          ['Hari Beroperasi', String(rows.length)],
          ['Hari dengan Gap Antar Shift', String(gapDays)],
          ['Buka Terlambat', `${lateOpen} hari`],
          ['Tutup Lebih Cepat', `${earlyClose} hari`],
        ],
        sheets: [
          {
            name: 'Jam Operasional',
            rows,
            columns: [
              { header: 'Tanggal', width: 14, type: 'date', value: (r) => parseLocalDate(r.day) },
              {
                header: 'Jadwal',
                width: 14,
                value: (r) =>
                  r.storeOpen
                    ? `${formatClock(r.scheduledOpen)}–${formatClock(r.scheduledClose)}`
                    : 'Tutup',
              },
              { header: 'Kasir Shift 1', width: 16, value: (r) => r.shift1Cashier ?? '—' },
              {
                header: 'Shift 1',
                width: 16,
                value: (r) => shiftText(r.shift1Login, r.shift1Logout),
              },
              { header: 'Kasir Shift 2', width: 16, value: (r) => r.shift2Cashier ?? '—' },
              {
                header: 'Shift 2',
                width: 16,
                value: (r) => shiftText(r.shift2Login, r.shift2Logout),
              },
              {
                header: 'Gap Antar Shift (menit)',
                width: 20,
                type: 'number',
                value: (r) => r.gapMinutes,
              },
              {
                header: 'Selisih Buka',
                width: 16,
                value: (r) => diffText('open', r.openDiffMinutes),
              },
              {
                header: 'Selisih Tutup',
                width: 18,
                value: (r) => diffText('close', r.closeDiffMinutes),
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
    'whitespace-nowrap py-[14px] pr-3 text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Laporan Jam Operasional"
        info="Jam buka–tutup toko nyata dari sesi login kasir. Shift 1 = sesi pertama hari itu, Shift 2 = sesi kedua. Gap = waktu kosong antara logout Shift 1 dan login Shift 2. Selisih dibandingkan jam buka/tutup Offline di Jam Layanan."
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
      />

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Hari Beroperasi" value={rows.length} format="number" />
        <StatCard
          label="Hari dengan Gap"
          value={gapDays}
          format="number"
          hint="Ada waktu kosong antar shift"
        />
        <StatCard label="Buka Terlambat" value={lateOpen} format="number" hint="hari" />
        <StatCard label="Tutup Lebih Cepat" value={earlyClose} format="number" hint="hari" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Tanggal</th>
                <th className={`${thClass} text-left`}>Shift 1</th>
                <th className={`${thClass} text-left`}>Shift 2</th>
                <th className={`${thClass} text-left`}>Gap Antar Shift</th>
                <th className={`${thClass} pr-6 text-left`}>Selisih vs Jadwal</th>
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
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[#94a3b8]">
                    Belum ada sesi kasir di periode ini.
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => (
                  <tr key={r.day} className="border-t border-[#f1f5f9] first:border-t-0 text-sm">
                    <td className="py-3 pl-6 pr-3">
                      <p className="font-semibold text-[#0f172a]">{formatDay(r.day)}</p>
                      <p className="text-xs text-[#94a3b8]">
                        {r.storeOpen
                          ? `Jadwal ${formatClock(r.scheduledOpen)}–${formatClock(r.scheduledClose)}`
                          : 'Jadwal: tutup'}
                        {r.sessionCount > 2 && ` · ${r.sessionCount} sesi`}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-mono text-[#0f172a]">
                        {shiftText(r.shift1Login, r.shift1Logout)}
                      </p>
                      <p className="text-xs text-[#94a3b8]">{r.shift1Cashier}</p>
                    </td>
                    <td className="py-3 pr-3">
                      {r.shift2Login ? (
                        <>
                          <p className="font-mono text-[#0f172a]">
                            {shiftText(r.shift2Login, r.shift2Logout)}
                          </p>
                          <p className="text-xs text-[#94a3b8]">{r.shift2Cashier}</p>
                        </>
                      ) : (
                        <span className="text-[#94a3b8]">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {r.gapMinutes === null ? (
                        <span className="text-[#94a3b8]">—</span>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.gapMinutes === 0
                              ? 'bg-[#ecfdf5] text-[#047857]'
                              : 'bg-[#fef3c7] text-[#92400e]'
                          }`}
                        >
                          {r.gapMinutes === 0 ? 'Tanpa gap' : `Gap ${minutesText(r.gapMinutes)}`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-6">
                      {r.storeOpen ? (
                        <div className="flex flex-wrap gap-1.5">
                          <DiffBadge kind="open" min={r.openDiffMinutes} />
                          <DiffBadge kind="close" min={r.closeDiffMinutes} />
                        </div>
                      ) : (
                        <span className="text-xs text-[#92400e]">Buka di luar jadwal</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={rows.length}
          itemLabel="hari"
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
