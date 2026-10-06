import { useEffect, useState } from 'react';
import { Download, Eye, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchRoles } from '../../services/employees';
import { fetchAttendanceReport, fetchAttendanceReportDetail } from '../../services/employeeReports';
import type { RoleOption } from '../../types/employee';
import type {
  AttendanceDayStatus,
  AttendanceReportDay,
  AttendanceReportRow,
} from '../../types/employeeReport';
import { parseLocalDate, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';

const STATUS_LABELS: Record<AttendanceDayStatus, string> = {
  masuk: 'Masuk',
  telat: 'Telat',
  izin: 'Izin',
  tidak_masuk: 'Tidak Masuk',
};

const STATUS_CLASSES: Record<AttendanceDayStatus, string> = {
  masuk: 'bg-[#ecfdf5] text-[#047857]',
  telat: 'bg-[#fef3c7] text-[#92400e]',
  izin: 'bg-[#eff6ff] text-[#1d4ed8]',
  tidak_masuk: 'bg-[#fff1f2] text-[#be123c]',
};

const rate = (r: AttendanceReportRow) => (r.workDays ? (r.totalMasuk / r.workDays) * 100 : 0);
const pctText = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

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

function formatLate(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function StatusBadge({ status }: { status: AttendanceDayStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function AttendanceReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [search, setSearch] = useState('');
  const [roleName, setRoleName] = useState('');

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rows, setRows] = useState<AttendanceReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detail, setDetail] = useState<AttendanceReportRow | null>(null);

  useEffect(() => {
    fetchRoles()
      .then((r) => setRoles(r.filter((x) => x.type !== 'admin')))
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAttendanceReport(range.start, range.end)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) => (!roleName || r.roleName === roleName) && (!q || r.fullName.toLowerCase().includes(q))
  );
  const sum = (f: (r: AttendanceReportRow) => number) => filtered.reduce((s, r) => s + f(r), 0);
  const totalWorkDays = sum((r) => r.workDays);
  const avgRate = totalWorkDays ? (sum((r) => r.totalMasuk) / totalWorkDays) * 100 : 0;
  const totalLate = sum((r) => r.totalTelat);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleExport() {
    setExporting(true);
    try {
      // Rincian harian semua karyawan yang tampil, untuk sheet kedua
      const details = await Promise.all(
        filtered.map(async (r) => ({
          row: r,
          days: await fetchAttendanceReportDetail(r.employeeId, range.start, range.end),
        }))
      );
      const dayRows = details.flatMap(({ row, days }) => days.map((d) => ({ row, d })));
      await exportToExcel<any>({
        fileName: `Laporan Absensi ${range.start} sd ${range.end}`,
        title: 'Laporan Absensi',
        subtitle: `Periode ${rangeText(range)}${roleName ? ` · ${roleName}` : ''}`,
        summary: [
          ['Total Karyawan Aktif', String(filtered.length)],
          ['Rata-rata Kehadiran', pctText(avgRate)],
          ['Total Keterlambatan', `${totalLate} kali`],
        ],
        sheets: [
          {
            name: 'Rekap Karyawan',
            rows: filtered,
            columns: [
              { header: 'Nama Karyawan', width: 24, value: (r: AttendanceReportRow) => r.fullName },
              { header: 'Role', width: 14, value: (r: AttendanceReportRow) => r.roleName },
              {
                header: 'Total Masuk',
                width: 12,
                type: 'number',
                value: (r: AttendanceReportRow) => r.totalMasuk,
              },
              {
                header: 'Total Izin',
                width: 10,
                type: 'number',
                value: (r: AttendanceReportRow) => r.totalIzin,
              },
              {
                header: 'Total Tidak Masuk',
                width: 16,
                type: 'number',
                value: (r: AttendanceReportRow) => r.totalTidakMasuk,
              },
              {
                header: 'Total Telat',
                width: 11,
                type: 'number',
                value: (r: AttendanceReportRow) => r.totalTelat,
              },
              {
                header: 'Menit Telat',
                width: 11,
                type: 'number',
                value: (r: AttendanceReportRow) => r.lateMinutes,
              },
              {
                header: '% Kehadiran',
                width: 12,
                type: 'number',
                value: (r: AttendanceReportRow) => Math.round(rate(r) * 10) / 10,
              },
            ],
          },
          {
            name: 'Rincian Harian',
            rows: dayRows,
            columns: [
              { header: 'Nama Karyawan', width: 24, value: (x) => x.row.fullName },
              { header: 'Tanggal', width: 14, type: 'date', value: (x) => parseLocalDate(x.d.day) },
              { header: 'Shift', width: 14, value: (x) => x.d.shift ?? '—' },
              { header: 'Jam Masuk', width: 10, value: (x) => formatTime(x.d.checkIn) },
              { header: 'Jam Keluar', width: 10, value: (x) => formatTime(x.d.checkOut) },
              {
                header: 'Status',
                width: 12,
                value: (x) => STATUS_LABELS[x.d.status as AttendanceDayStatus],
              },
              { header: 'Menit Telat', width: 11, type: 'number', value: (x) => x.d.lateMinutes },
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
    'whitespace-nowrap py-[14px] pr-3 text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Laporan Absensi"
        info="Rekap kehadiran karyawan aktif (selain Admin/Owner) dari presensi QR & manual. Hari kerja = hari yang terjadwal di Shift Kerja. Terjadwal tapi tidak absen dihitung Tidak Masuk (hari ini belum dihitung). % Kehadiran = (Masuk + Telat) ÷ hari kerja."
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
              placeholder="Cari nama karyawan..."
              className={`${filterClass} w-52 pl-8`}
              aria-label="Cari nama karyawan"
            />
          </div>
          <select
            value={roleName}
            onChange={(e) => {
              setRoleName(e.target.value);
              setPage(1);
            }}
            className={filterClass}
            aria-label="Role"
          >
            <option value="">Semua Role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Karyawan Aktif" value={filtered.length} format="number" />
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">
            Rata-rata Kehadiran
          </p>
          <p className="font-mono text-lg font-bold text-[#0f172a]">{pctText(avgRate)}</p>
          <p className="text-[11px] text-[#94a3b8]">{totalWorkDays} hari kerja terjadwal</p>
        </div>
        <StatCard
          label="Total Keterlambatan"
          value={totalLate}
          format="number"
          hint="Jumlah kejadian telat, seluruh karyawan"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Nama Karyawan</th>
                <th className={`${thClass} text-left`}>Role</th>
                <th className={`${thClass} text-right`}>Total Masuk</th>
                <th className={`${thClass} text-right`}>Total Izin</th>
                <th className={`${thClass} text-right`}>Total Tidak Masuk</th>
                <th className={`${thClass} text-right`}>Total Telat</th>
                <th className={`${thClass} text-right`}>% Kehadiran</th>
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    {q || roleName ? 'Karyawan tidak ditemukan.' : 'Belum ada karyawan aktif.'}
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => {
                  const pct = rate(r);
                  return (
                    <tr
                      key={r.employeeId}
                      className="border-t border-[#f1f5f9] first:border-t-0 text-sm"
                    >
                      <td className="py-3 pl-6 pr-3 font-semibold text-[#0f172a]">{r.fullName}</td>
                      <td className="py-3 pr-3 text-[#475569]">{r.roleName}</td>
                      <td className="py-3 pr-3 text-right font-mono">{r.totalMasuk}</td>
                      <td className="py-3 pr-3 text-right font-mono">{r.totalIzin || '—'}</td>
                      <td
                        className={`py-3 pr-3 text-right font-mono ${r.totalTidakMasuk ? 'text-[#be123c]' : ''}`}
                      >
                        {r.totalTidakMasuk || '—'}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono">
                        {r.totalTelat ? (
                          <span title={`Total ${formatLate(r.lateMinutes)}`}>
                            {r.totalTelat}
                            <span className="ml-1 text-[#94a3b8]">
                              ({formatLate(r.lateMinutes)})
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {r.workDays ? (
                          <span
                            className={`font-mono font-semibold ${pct >= 90 ? 'text-[#047857]' : pct >= 75 ? 'text-[#92400e]' : 'text-[#be123c]'}`}
                          >
                            {pctText(pct)}
                          </span>
                        ) : (
                          <span className="text-[#94a3b8]">Belum ada jadwal</span>
                        )}
                      </td>
                      <td className="py-3 pr-6 text-right">
                        <button
                          onClick={() => setDetail(r)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
                        >
                          <Eye className="size-3.5" />
                          Detail
                        </button>
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
          total={filtered.length}
          itemLabel="karyawan"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {detail && (
        <AttendanceDetailModal row={detail} range={range} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

/** Rincian harian satu karyawan di periode laporan */
function AttendanceDetailModal({
  row,
  range,
  onClose,
}: {
  row: AttendanceReportRow;
  range: DateRange;
  onClose: () => void;
}) {
  const [days, setDays] = useState<AttendanceReportDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAttendanceReportDetail(row.employeeId, range.start, range.end)
      .then(setDays)
      .catch((err) => setError(err?.message ?? 'Gagal memuat rincian.'));
  }, [row.employeeId, range.start, range.end]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">{row.fullName}</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              {row.roleName} · {rangeText(range)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-4 gap-2 border-b border-[#e2e8f0] px-6 py-4 text-center">
          {(
            [
              ['Masuk Tepat Waktu', row.totalMasuk - row.totalTelat, 'text-[#047857]'],
              ['Telat', row.totalTelat, 'text-[#92400e]'],
              ['Izin', row.totalIzin, 'text-[#1d4ed8]'],
              ['Tidak Masuk', row.totalTidakMasuk, 'text-[#be123c]'],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label}>
              <p className={`font-mono text-lg font-bold ${tone}`}>{value}</p>
              <p className="text-[11px] text-[#64748b]">{label}</p>
            </div>
          ))}
        </div>

        <div className="overflow-y-auto">
          {error && <p className="p-6 text-xs text-[#e11d48]">{error}</p>}
          {!error && !days && <p className="p-6 text-center text-xs text-[#94a3b8]">Memuat...</p>}
          {days && days.length === 0 && (
            <p className="p-6 text-center text-xs text-[#94a3b8]">
              Tidak ada jadwal atau presensi di periode ini.
            </p>
          )}
          {days && days.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#e2e8f0] text-left text-xs font-bold uppercase tracking-[0.55px] text-[#64748b]">
                  <th className="py-2.5 pl-6 pr-3">Tanggal</th>
                  <th className="py-2.5 pr-3">Shift</th>
                  <th className="py-2.5 pr-3 text-right">Jam Masuk</th>
                  <th className="py-2.5 pr-3 text-right">Jam Keluar</th>
                  <th className="py-2.5 pr-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.day} className="border-t border-[#f1f5f9]">
                    <td className="py-2.5 pl-6 pr-3 text-[#0f172a]">
                      {formatDay(d.day)}
                      {d.source === 'manual' && (
                        <span
                          className="ml-1.5 rounded bg-[#f1f5f9] px-1 py-0.5 text-xs text-[#64748b]"
                          title={d.notes ?? undefined}
                        >
                          manual
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-[#475569]">
                      {d.shift ?? '—'}
                      {!d.scheduled && (
                        <span className="ml-1 text-[#94a3b8]">(di luar jadwal)</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono">{formatTime(d.checkIn)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono">{formatTime(d.checkOut)}</td>
                    <td className="py-2.5 pr-6 text-right">
                      <StatusBadge status={d.status} />
                      {d.status === 'telat' && d.lateMinutes > 0 && (
                        <span className="ml-1.5 font-mono text-xs text-[#92400e]">
                          +{formatLate(d.lateMinutes)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
