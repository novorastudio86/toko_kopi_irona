import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { fetchShiftPatterns, fetchWeeklyShifts, saveWeeklyShifts } from '../../services/shifts';
import type { EmployeeShiftRow, ShiftPattern, WeeklyShifts } from '../../types/shift';
import { formatClock } from '../../utils/date';

// Senin dulu, Minggu terakhir (day_of_week: 0 = Minggu)
const DAYS = [
  { dow: 1, label: 'Senin' },
  { dow: 2, label: 'Selasa' },
  { dow: 3, label: 'Rabu' },
  { dow: 4, label: 'Kamis' },
  { dow: 5, label: 'Jumat' },
  { dow: 6, label: 'Sabtu' },
  { dow: 0, label: 'Minggu' },
];

type Props = {
  employee: EmployeeShiftRow | null;
  allEmployees: EmployeeShiftRow[];
  onClose: () => void;
  onSaved: (employeeName: string) => void;
};

export default function ShiftDefaultsModal({ employee, allEmployees, onClose, onSaved }: Props) {
  const [selectedId, setSelectedId] = useState(employee?.employeeId ?? '');
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [weekly, setWeekly] = useState<WeeklyShifts>({});
  const [loading, setLoading] = useState(!!employee);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWeekly(employeeId: string) {
    setLoading(true);
    setError(null);
    try {
      setWeekly(await fetchWeeklyShifts(employeeId));
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat jadwal.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShiftPatterns()
      .then(setPatterns)
      .catch((err) => setError(err?.message ?? 'Gagal memuat pola shift.'));
  }, []);

  useEffect(() => {
    if (employee) loadWeekly(employee.employeeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  function selectEmployee(id: string) {
    setSelectedId(id);
    setWeekly({});
    if (id) loadWeekly(id);
  }

  const patternById = new Map(patterns.map((p) => [p.id, p]));
  const selectedName = allEmployees.find((e) => e.employeeId === selectedId)?.fullName ?? '';

  function overlaps(aId: string, bId: string): boolean {
    const a = patternById.get(aId);
    const b = patternById.get(bId);
    if (!a || !b) return false;
    return a.startTime < b.endTime && b.startTime < a.endTime;
  }

  /** Pola yang boleh jadi Shift 2: bukan Shift 1 dan tidak bertabrakan jamnya */
  function secondOptions(firstId: string): ShiftPattern[] {
    return patterns.filter((p) => p.id !== firstId && !overlaps(firstId, p.id));
  }

  function setFirst(dow: number, value: string) {
    setWeekly((prev) => {
      if (value === 'libur') return { ...prev, [dow]: [] };
      const second = prev[dow]?.[1];
      const keepSecond = second && second !== value && !overlaps(value, second);
      return { ...prev, [dow]: keepSecond ? [value, second] : [value] };
    });
  }

  function setSecond(dow: number, value: string | null) {
    setWeekly((prev) => {
      const first = prev[dow]?.[0];
      if (!first) return prev;
      return { ...prev, [dow]: value ? [first, value] : [first] };
    });
  }

  async function handleSave() {
    if (!selectedId) {
      setError('Pilih karyawan terlebih dahulu.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveWeeklyShifts(selectedId, weekly);
      onSaved(selectedName);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan jadwal.');
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    'rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0f172a] outline-none focus:border-[#94a3b8]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 pb-5 pt-5">
          <div>
            <h2 className="text-lg font-bold leading-7 text-[#0f172a]">
              Jadwal Mingguan{employee ? ` — ${employee.fullName}` : ''}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Berulang otomatis tiap minggu. Maksimal 2 shift per hari — Shift 2 dibayar sebagai bonus.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          {!employee && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-[0.6px] text-[#334155]">Karyawan</label>
              <select
                value={selectedId}
                onChange={(e) => selectEmployee(e.target.value)}
                className="w-full rounded-xl border border-[#cbd5e1] bg-white px-4 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#94a3b8]"
              >
                <option value="">Pilih karyawan</option>
                {allEmployees.map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedId &&
            (loading ? (
              <p className="py-6 text-center text-xs text-[#94a3b8]">Memuat jadwal...</p>
            ) : (
              <div className="flex flex-col gap-2">
                {DAYS.map(({ dow, label }) => {
                  const [first, second] = weekly[dow] ?? [];
                  const options = first ? secondOptions(first) : [];

                  return (
                    <div
                      key={dow}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5"
                    >
                      <span className="w-16 text-xs font-semibold text-[#334155]">{label}</span>

                      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                        <select value={first ?? 'libur'} onChange={(e) => setFirst(dow, e.target.value)} className={selectClass}>
                          <option value="libur">Libur</option>
                          {patterns.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({formatClock(p.startTime)}–{formatClock(p.endTime)})
                            </option>
                          ))}
                        </select>

                        {first && second && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold uppercase text-[#94a3b8]">+</span>
                            <select value={second} onChange={(e) => setSecond(dow, e.target.value)} className={selectClass}>
                              {options.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({formatClock(p.startTime)}–{formatClock(p.endTime)})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => setSecond(dow, null)}
                              aria-label="Hapus Shift 2"
                              className="rounded-md p-1 text-[#94a3b8] hover:bg-white hover:text-[#e11d48]"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        )}

                        {first && !second && (
                          <button
                            onClick={() => setSecond(dow, options[0].id)}
                            disabled={options.length === 0}
                            title={options.length === 0 ? 'Tidak ada shift lain yang jamnya tidak bertabrakan' : undefined}
                            className="flex items-center gap-1 rounded-lg border border-dashed border-[#cbd5e1] px-2.5 py-1.5 text-[11px] font-semibold text-[#475569] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Plus className="size-3" />
                            Shift 2
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">{error}</p>
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
            disabled={saving || !selectedId || loading}
            className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
          </button>
        </div>
      </div>
    </div>
  );
}
