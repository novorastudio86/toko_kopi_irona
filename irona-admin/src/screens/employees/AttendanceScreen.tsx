import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import {
  fetchAttendanceByDate,
  fetchMissingEmployees,
  fetchPendingOvertime,
} from '../../services/attendance';
import { fetchEmployeeShifts } from '../../services/shifts';
import type { AttendanceRow, MissingEmployee, PendingOvertime } from '../../types/attendance';
import type { ShiftSlot } from '../../types/shift';
import { formatClock, parseLocalDate, toLocalISO, todayISO } from '../../utils/date';
import AttendanceCorrectionModal from './AttendanceCorrectionModal';
import AttendanceManualModal from './AttendanceManualModal';
import OvertimeApprovalModal from './OvertimeApprovalModal';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(min: number): string {
  if (min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

export default function AttendanceScreen() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [missing, setMissing] = useState<MissingEmployee[]>([]);
  /** Shift terjadwal per karyawan di tanggal ini (dari Shift Kerja) */
  const [scheduleMap, setScheduleMap] = useState<Map<string, ShiftSlot[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [correctionRow, setCorrectionRow] = useState<AttendanceRow | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  // Lembur malam yang menunggu persetujuan (semua tanggal)
  const [pendingOvertime, setPendingOvertime] = useState<PendingOvertime[]>([]);
  const [approval, setApproval] = useState<{ single: PendingOvertime | null } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [attendance, missingEmployees, schedule, pending] = await Promise.all([
        fetchAttendanceByDate(date),
        fetchMissingEmployees(date),
        fetchEmployeeShifts(date),
        fetchPendingOvertime(),
      ]);
      setPendingOvertime(pending);
      setRows(attendance);
      setMissing(missingEmployees);
      setScheduleMap(new Map(schedule.map((s) => [s.employeeId, s.slots])));
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat presensi.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  function shiftDate(days: number) {
    const d = parseLocalDate(date);
    d.setDate(d.getDate() + days);
    setDate(toLocalISO(d));
  }

  const hadirCount = rows.filter((r) => r.status === 'hadir').length;
  const telatCount = rows.filter((r) => r.status === 'telat').length;
  // Yang dianggap "belum absen" hanya karyawan yang memang terjadwal masuk hari itu (bukan libur)
  const missingScheduled = missing.filter((m) => (scheduleMap.get(m.id)?.length ?? 0) > 0);

  /** Jam shift dari jadwal, hanya untuk pola yang dipakai presensi ini */
  function shiftSlots(row: AttendanceRow): ShiftSlot[] {
    return (scheduleMap.get(row.employeeId) ?? []).filter((s) =>
      row.shiftPatternIds.includes(s.shiftPatternId)
    );
  }

  return (
    <div className="flex max-w-[1400px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Presensi"
        info="Rekap kehadiran harian dari scan QR. Admin bisa mengoreksi jam yang keliru atau menambah presensi yang terlewat."
        badge={
          loading
            ? undefined
            : `${hadirCount} hadir · ${telatCount} telat · ${missingScheduled.length} belum absen`
        }
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftDate(-1)}
              className="rounded-lg border border-[#e2e8f0] bg-white p-2 text-[#475569] hover:bg-[#f8fafc]"
            >
              <ChevronLeft className="size-4" />
            </button>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 font-mono text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
            />
            <button
              onClick={() => shiftDate(1)}
              disabled={date >= todayISO()}
              className="rounded-lg border border-[#e2e8f0] bg-white p-2 text-[#475569] hover:bg-[#f8fafc] disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              onClick={() => setManualOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1e293b]"
            >
              <Plus className="size-3.5" />
              Tambah Manual
            </button>
          </div>
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

      {pendingOvertime.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-5 py-4">
          <p className="flex items-center gap-2 text-sm leading-5 text-[#92400e]">
            <Clock className="size-4 shrink-0" />
            <span>
              <b>{pendingOvertime.length} lembur menunggu persetujuan</b> (
              {formatMinutes(pendingOvertime.reduce((sum, p) => sum + p.overtimeNightMinutes, 0))}).
              Lembur baru dibayar di gaji setelah disetujui.
            </span>
          </p>
          <button
            onClick={() => setApproval({ single: null })}
            className="shrink-0 rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b]"
          >
            Tinjau Lembur
          </button>
        </div>
      )}

      {!loading && missingScheduled.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-5 py-4 drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
          <AlertTriangle className="size-4 shrink-0 text-[#dc2626]" />
          <p className="text-sm leading-5 text-[#334155]">
            <span className="font-bold text-[#0f172a]">
              {missingScheduled.length} karyawan terjadwal belum absen
            </span>{' '}
            di tanggal ini: {missingScheduled.map((m) => m.fullName).join(', ')}.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr className="text-[11px] font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                <th className="px-4 py-3 text-left">Karyawan</th>
                <th className="px-3 py-3 text-left">Shift</th>
                <th className="px-3 py-3 text-left">Jam Masuk</th>
                <th className="px-3 py-3 text-left">Jam Pulang</th>
                <th className="px-3 py-3 text-left">Telat</th>
                <th className="px-3 py-3 text-left">Lembur</th>
                <th className="px-3 py-3 text-left">Shift 2</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat presensi...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-[#94a3b8]">
                    Belum ada presensi tercatat di tanggal ini.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#f1f5f9]">
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-bold text-[#0f172a]">{row.employeeName}</p>
                      <p className="text-[11px] text-[#94a3b8]">{row.roleName}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="text-xs font-semibold capitalize text-[#334155]">
                        {row.shift ?? '—'}
                      </p>
                      {shiftSlots(row).length > 0 && (
                        <p className="font-mono text-[11px] text-[#94a3b8]">
                          {formatClock(shiftSlots(row)[0].startTime)}–
                          {formatClock(shiftSlots(row)[shiftSlots(row).length - 1].endTime)}
                          {shiftSlots(row).some((s) => s.isSpecialHours) && (
                            <span className="ml-1 rounded bg-[#fef3c7] px-1 font-sans text-[10px] font-bold text-[#92400e]">
                              Jam Khusus
                            </span>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-[#0f172a]">
                      {formatTime(row.checkIn)}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-[#0f172a]">
                      {formatTime(row.checkOut)}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-[#dc2626]">
                      {formatMinutes(row.lateMinutes)}
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="font-mono text-xs text-[#059669]">
                        {formatMinutes(row.overtimeMinutes)}
                      </p>
                      {row.overtimeMorningMinutes > 0 && (
                        <p className="text-[10px] text-[#64748b]">
                          Pagi {formatMinutes(row.overtimeMorningMinutes)} (Jam Khusus)
                        </p>
                      )}
                      {row.overtimeNightMinutes > 0 && (
                        <button
                          onClick={() =>
                            setApproval({
                              single: {
                                id: row.id,
                                employeeId: row.employeeId,
                                employeeName: row.employeeName,
                                attendanceDate: row.attendanceDate,
                                shift: row.shift,
                                checkIn: row.checkIn,
                                checkOut: row.checkOut,
                                overtimeNightMinutes: row.overtimeNightMinutes,
                              },
                            })
                          }
                          title={row.overtimeReviewNote ?? 'Putuskan lembur'}
                          className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            row.overtimeStatus === 'pending'
                              ? 'bg-[#fef3c7] text-[#92400e]'
                              : row.overtimeStatus === 'approved'
                                ? 'bg-[#ecfdf5] text-[#047857]'
                                : 'bg-[#fff1f2] text-[#be123c]'
                          }`}
                        >
                          {row.overtimeStatus === 'pending' &&
                            `Menunggu · ${formatMinutes(row.overtimeNightMinutes)}`}
                          {row.overtimeStatus === 'approved' &&
                            (row.overtimeApprovedMinutes < row.overtimeNightMinutes
                              ? `Disetujui ${row.overtimeApprovedMinutes}/${row.overtimeNightMinutes}m`
                              : 'Disetujui')}
                          {row.overtimeStatus === 'rejected' &&
                            `Ditolak · ${formatMinutes(row.overtimeNightMinutes)}`}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-[#2563eb]">
                      {formatMinutes(row.extraShiftMinutes)}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.status === 'hadir' ? (
                          <span className="inline-flex items-center rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-bold text-white">
                            Hadir
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#f43f5e] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#e11d48]">
                            <AlertTriangle className="size-2.5" />
                            Telat {formatMinutes(row.lateMinutes)}
                          </span>
                        )}
                        {row.source === 'manual' && (
                          <span className="inline-flex items-center rounded-full border border-[#cbd5e1] bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
                            Dikoreksi Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setCorrectionRow(row)}
                        title="Koreksi"
                        className="rounded-lg border border-[#e2e8f0] p-[7px] text-[#475569] hover:bg-[#f8fafc]"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {correctionRow && (
        <AttendanceCorrectionModal
          row={correctionRow}
          onClose={() => setCorrectionRow(null)}
          onSaved={() => {
            setCorrectionRow(null);
            setFlash('Presensi berhasil dikoreksi.');
            loadData();
          }}
        />
      )}

      {approval && (
        <OvertimeApprovalModal
          single={approval.single}
          onClose={() => setApproval(null)}
          onSaved={(message) => {
            setApproval(null);
            setFlash(message);
            loadData();
          }}
        />
      )}

      {manualOpen && (
        <AttendanceManualModal
          date={date}
          employees={missing}
          onClose={() => setManualOpen(false)}
          onSaved={() => {
            setManualOpen(false);
            setFlash('Presensi manual berhasil ditambahkan.');
            loadData();
          }}
        />
      )}
    </div>
  );
}
