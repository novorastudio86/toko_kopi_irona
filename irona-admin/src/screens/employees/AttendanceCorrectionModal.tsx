import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { correctAttendance } from '../../services/attendance';
import { fetchEmployeeSlots, fetchShiftPatterns } from '../../services/shifts';
import type { AttendanceRow } from '../../types/attendance';
import type { ShiftPattern, ShiftSlot } from '../../types/shift';
import { formatClock, parseLocalDate } from '../../utils/date';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';
import { AttendanceShiftPicker } from './AttendanceShiftPicker';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = { row: AttendanceRow; onClose: () => void; onSaved: () => void };

export default function AttendanceCorrectionModal({ row, onClose, onSaved }: Props) {
  const [checkIn, setCheckIn] = useState(toLocalInput(row.checkIn));
  const [checkOut, setCheckOut] = useState(toLocalInput(row.checkOut));
  const [reason, setReason] = useState('');
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [scheduled, setScheduled] = useState<ShiftSlot[] | null>(null);
  const [shiftIds, setShiftIds] = useState<string[]>(row.shiftPatternIds);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // Pakai jadwal Shift Kerja TERBARU di tanggal itu (kalau admin baru mengubah shift, ikut terhitung)
  useEffect(() => {
    Promise.all([fetchShiftPatterns(), fetchEmployeeSlots(row.employeeId, row.attendanceDate)])
      .then(([list, slots]) => {
        setPatterns(list);
        setScheduled(slots);
        if (slots.length > 0) setShiftIds(slots.map((s) => s.shiftPatternId));
      })
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat jadwal.' }));
  }, [row.employeeId, row.attendanceDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const scheduleChanged =
    scheduled !== null &&
    scheduled.length > 0 &&
    scheduled.map((s) => s.shiftPatternId).join(',') !== row.shiftPatternIds.join(',');

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (shiftIds.length === 0) next.shift = 'Pilih shift.';
    if (!checkIn) next.checkIn = 'Jam masuk wajib diisi.';
    if (checkOut && new Date(checkOut) <= new Date(checkIn))
      next.checkOut = 'Jam pulang harus setelah jam masuk.';
    if (!reason.trim()) next.reason = 'Alasan koreksi wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await correctAttendance({
        attendanceId: row.id,
        checkIn: new Date(checkIn).toISOString(),
        checkOut: checkOut ? new Date(checkOut).toISOString() : null,
        reason: reason.trim(),
        shiftPatternIds: shiftIds,
      });
      onSaved();
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan koreksi.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 pb-5 pt-5">
          <div>
            <h2 className="text-lg font-bold leading-7 text-[#0f172a]">Koreksi Presensi</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              {row.employeeName} ·{' '}
              {parseLocalDate(row.attendanceDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
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
            <FieldLabel required>Shift</FieldLabel>
            <AttendanceShiftPicker
              patterns={patterns}
              value={shiftIds}
              onChange={setShiftIds}
              hasError={!!errors.shift}
            />
            <FieldError message={errors.shift} />
            {scheduleChanged && (
              <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[11px] leading-4 text-[#92400e]">
                Jadwal di Shift Kerja sudah berubah sejak absen ({row.shift ?? '—'} →{' '}
                {scheduled!
                  .map(
                    (s) => `${s.shiftName} ${formatClock(s.startTime)}–${formatClock(s.endTime)}`
                  )
                  .join(' + ')}
                ). Shift di atas sudah disesuaikan ke jadwal terbaru.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Jam Masuk</FieldLabel>
            <input
              type="datetime-local"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className={inputClass(!!errors.checkIn)}
            />
            <FieldError message={errors.checkIn} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Jam Pulang</FieldLabel>
            <input
              type="datetime-local"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className={inputClass(!!errors.checkOut)}
            />
            <FieldError message={errors.checkOut} />
            <p className="text-[11px] leading-4 text-[#94a3b8]">
              Kosongkan jika karyawan belum absen pulang.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Alasan Koreksi</FieldLabel>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Scan pertama gagal terbaca, dikoreksi sesuai laporan karyawan"
              className={inputClass(!!errors.reason)}
            />
            <FieldError message={errors.reason} />
          </div>

          <p className="text-[11px] leading-4 text-[#94a3b8]">
            Telat, lembur, dan Shift 2 dihitung ulang otomatis dari shift & jam di atas.
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
            disabled={saving}
            className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Koreksi'}
          </button>
        </div>
      </div>
    </div>
  );
}
