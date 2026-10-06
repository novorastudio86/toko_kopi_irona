import { useEffect, useState } from 'react';
import { Minus, Plus, Undo2, X } from 'lucide-react';
import { fetchShiftChanges, undoShiftChange } from '../../services/shifts';
import type { ShiftChangeEvent, ShiftChangeKind } from '../../types/shift';
import { parseLocalDate } from '../../utils/date';

const KIND_LABELS: Record<ShiftChangeKind, string> = {
  tukar: 'Tukar',
  gantikan: 'Gantikan',
  tambah: 'Tambah Shift',
  libur: 'Libur',
};

function shortDate(iso: string) {
  return parseLocalDate(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

type Props = { onClose: () => void; onChanged: (message: string) => void };

export default function ShiftHistoryModal({ onClose, onChanged }: Props) {
  const [events, setEvents] = useState<ShiftChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setEvents(await fetchShiftChanges());
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat riwayat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !undoingId && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, undoingId]);

  async function handleUndo(event: ShiftChangeEvent) {
    if (!window.confirm(`Batalkan perubahan "${KIND_LABELS[event.kind]}" ini? Jadwal kembali seperti sebelumnya.`)) return;
    setUndoingId(event.id);
    setError(null);
    try {
      await undoShiftChange(event.id);
      await load();
      onChanged('Perubahan jadwal dibatalkan.');
    } catch (err: any) {
      setError(err?.message ?? 'Gagal membatalkan perubahan.');
    } finally {
      setUndoingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 pb-5 pt-5">
          <div>
            <h2 className="text-lg font-bold leading-7 text-[#0f172a]">Riwayat Perubahan Jadwal</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Tukar, gantikan, tambah shift, dan libur mendadak. Jadwal mingguan tidak ikut berubah.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-6">
          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">{error}</p>
          )}

          {loading ? (
            <p className="py-6 text-center text-xs text-[#94a3b8]">Memuat riwayat...</p>
          ) : events.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#94a3b8]">Belum ada perubahan jadwal.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      {KIND_LABELS[event.kind]}
                    </span>
                    <span className="text-[11px] text-[#64748b]">
                      {new Date(event.createdAt).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUndo(event)}
                    disabled={undoingId !== null}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475569] hover:text-[#e11d48] disabled:opacity-50"
                  >
                    <Undo2 className="size-3" />
                    {undoingId === event.id ? 'Membatalkan...' : 'Batalkan'}
                  </button>
                </div>

                <ul className="flex flex-col gap-1">
                  {event.lines.map((line, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-[#334155]">
                      {line.action === 'lepas' ? (
                        <Minus className="size-3 shrink-0 text-[#e11d48]" />
                      ) : (
                        <Plus className="size-3 shrink-0 text-[#059669]" />
                      )}
                      <span>
                        <span className="font-bold">{line.employeeName}</span>{' '}
                        {line.action === 'lepas' ? 'lepas' : 'dapat'} {line.shiftName}
                        <span className="text-[#94a3b8]"> · {shortDate(line.date)}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                {event.note && <p className="text-[11px] italic text-[#64748b]">"{event.note}"</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
