import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import {
  deleteDateOverride,
  fetchShiftPatterns,
  fetchUpcomingOverrides,
  saveDateOverride,
} from '../../services/shifts';
import type { DateOverride, ShiftPattern } from '../../types/shift';
import { formatClock, parseLocalDate, todayISO } from '../../utils/date';

type Props = { onClose: () => void; onSaved: (date: string) => void };

export default function ShiftDateOverrideModal({ onClose, onSaved }: Props) {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [date, setDate] = useState(todayISO());
  const [patternId, setPatternId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([fetchShiftPatterns(), fetchUpcomingOverrides(todayISO())]);
      setPatterns(p);
      setOverrides(o);
      setPatternId((prev) => prev || p[0]?.id || '');
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function handleSave() {
    if (!patternId || !startTime || !endTime) {
      setError('Lengkapi shift, jam mulai, dan jam selesai.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDateOverride({ date, patternId, startTime, endTime, note: note.trim() || null });
      onSaved(date);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan jam khusus.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Hapus jam khusus ini? Hari itu kembali memakai jam shift normal.')) return;
    try {
      await deleteDateOverride(id);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menghapus.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 pb-5 pt-5">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Jam Khusus Toko</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Ubah jam satu shift di tanggal tertentu (mis. Sabtu buka 05:00). Berlaku untuk semua karyawan di shift
              itu. Jam sebelum 08:00 atau sesudah 23:00 dihitung lembur.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-[0.6px] text-[#334155]">Tanggal</label>
              <input
                type="date"
                value={date}
                min={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#94a3b8]"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-[0.6px] text-[#334155]">Shift</label>
              <select
                value={patternId}
                onChange={(e) => setPatternId(e.target.value)}
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#94a3b8]"
              >
                {patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (normal {formatClock(p.startTime)}–{formatClock(p.endTime)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-[0.6px] text-[#334155]">Jam Mulai</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#94a3b8]"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-[0.6px] text-[#334155]">Jam Selesai</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#94a3b8]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-[0.6px] text-[#334155]">Catatan (opsional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Buka lebih pagi untuk event komunitas"
              className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#94a3b8]"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : '+ Tambah Jam Khusus'}
          </button>

          <div className="flex flex-col gap-2 border-t border-[#f1f5f9] pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.5px] text-[#64748b]">Jam Khusus Terjadwal</p>
            {loading ? (
              <p className="text-xs text-[#94a3b8]">Memuat...</p>
            ) : overrides.length === 0 ? (
              <p className="text-xs text-[#94a3b8]">Belum ada jam khusus.</p>
            ) : (
              overrides.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <div className="text-xs">
                    <span className="font-bold text-[#0f172a]">
                      {parseLocalDate(o.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-[#64748b]">
                      {' '}
                      · {o.patternName} {formatClock(o.startTime)}–{formatClock(o.endTime)}
                    </span>
                  </div>
                  <button onClick={() => handleDelete(o.id)} className="text-[#94a3b8] hover:text-[#e11d48]">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}