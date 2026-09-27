import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createManualAttendance } from '../../services/attendance';
import { fetchEmployeeSlots, fetchShiftPatterns } from '../../services/shifts';
import type { MissingEmployee } from '../../types/attendance';
import type { ShiftPattern, ShiftSlot } from '../../types/shift';
import { formatClock, parseLocalDate } from '../../utils/date';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';
import { AttendanceShiftPicker } from './AttendanceShiftPicker';

type Props = {
  date: string;
  employees: MissingEmployee[];
  onClose: () => void;
  onSaved: () => void;
};

export default function AttendanceManualModal({ date, employees, onClose, onSaved }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [scheduled, setScheduled] = useState<ShiftSlot[] | null>(null);
  const [shiftIds, setShiftIds] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState(`${date}T08:00`);
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    fetchShiftPatterns()
      .then(setPatterns)
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat pola shift.' }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  /** Isi shift & jam masuk otomatis dari jadwal Shift Kerja karyawan di tanggal ini */
  async function selectEmployee(id: string) {
    setEmployeeId(id);
    setScheduled(null);
    setShiftIds([]);
    if (!id) return;
    try {
      const slots = await fetchEmployeeSlots(id, date);
      setScheduled(slots);
      setShiftIds(slots.map((s) => s.shiftPatternId));
      if (slots[0]) setCheckIn(`${date}T${formatClock(slots[0].startTime)}`);
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal memuat jadwal karyawan.' });
    }
  }

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!employeeId) next.employee = 'Pilih karyawan.';
    if (shiftIds.length === 0) next.shift = 'Pilih shift.';
    if (!checkIn) next.checkIn = 'Jam masuk wajib diisi.';
    if (checkOut && new Date(checkOut) <= new Date(checkIn))
      next.checkOut = 'Jam pulang harus setelah jam masuk.';
    if (!reason.trim()) next.reason = 'Alasan wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await createManualAttendance({
        employeeId,
        date,
        shiftPatternIds: shiftIds,
        checkIn: new Date(checkIn).toISOString(),
        checkOut: checkOut ? new Date(checkOut).toISOString() : null,
        reason: reason.trim(),
      });
      onSaved();
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menambah presensi.' });
    } finally {
      setSaving(false);
    }
  }

  const scheduledIds = (scheduled ?? []).map((s) => s.shiftPatternId).join(',');
  const differsFromSchedule = scheduled !== null && scheduledIds !== shiftIds.join(',');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 pb-5 pt-5">
          <div>
            <h2 className="text-lg font-bold leading-7 text-[#0f172a]">Tambah Presensi Manual</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Untuk karyawan yang lupa scan di{' '}
              {parseLocalDate(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Karyawan</FieldLabel>
            <select
              value={employeeId}
              onChange={(e) => selectEmployee(e.target.value)}
              className={inputClass(!!errors.employee)}
            >
              <option value="">Pilih karyawan</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.roleName})
                </option>
              ))}
            </select>
            <FieldError message={errors.employee} />
            {employees.length === 0 && (
              <p className="text-[11px] text-[#94a3b8]">
                Semua karyawan aktif sudah tercatat di tanggal ini.
              </p>
            )}
          </div>

          {employeeId && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Shift</FieldLabel>
              <AttendanceShiftPicker
                patterns={patterns}
                value={shiftIds}
                onChange={setShiftIds}
                hasError={!!errors.shift}
              />
              <FieldError message={errors.shift} />
              {scheduled !== null && (
                <p
                  className={`text-[11px] leading-4 ${differsFromSchedule ? 'text-[#b45309]' : 'text-[#94a3b8]'}`}
                >
                  {scheduled.length === 0
                    ? 'Karyawan ini tidak terjadwal di tanggal ini (libur / belum diatur) — pilih shift yang dikerjakan.'
                    : `Terjadwal di Shift Kerja: ${scheduled
                        .map(
                          (s) =>
                            `${s.shiftName} ${formatClock(s.startTime)}–${formatClock(s.endTime)}`
                        )
                        .join(
                          ' + '
                        )}${differsFromSchedule ? ' — pilihanmu berbeda dari jadwal.' : ''}`}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <FieldLabel required>Jam Masuk</FieldLabel>
              <input
                type="datetime-local"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className={inputClass(!!errors.checkIn)}
              />
              <FieldError message={errors.checkIn} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <FieldLabel>Jam Pulang</FieldLabel>
              <input
                type="datetime-local"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className={inputClass(!!errors.checkOut)}
              />
              <FieldError message={errors.checkOut} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Alasan</FieldLabel>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Lupa scan, dicatat berdasarkan laporan supervisor"
              className={inputClass(!!errors.reason)}
            />
            <FieldError message={errors.reason} />
          </div>

          <p className="text-[11px] leading-4 text-[#94a3b8]">
            Telat, lembur (lewat 23:00 / sebelum 08:00 karena Jam Khusus), dan Shift 2 dihitung
            otomatis dari shift yang dipilih.
          </p>

          {errors.form && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {errors.form}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#cbd5e1] bg-white px-5 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || employees.length === 0}
            className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Presensi'}
          </button>
        </div>
      </div>
    </div>
  );
}
