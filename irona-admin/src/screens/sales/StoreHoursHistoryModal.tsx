import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchStoreHoursHistory } from '../../services/storeHours';
import type { StoreHoursHistoryEntry } from '../../types/storeHours';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

type DaySnapshot = StoreHoursHistoryEntry['after'][number];

function describe(d: DaySnapshot | undefined): string {
  if (!d) return '—';
  return d.is_open ? `${d.open_time}–${d.close_time}` : 'Tutup';
}

/** Hari yang berubah saja, mis. "Sabtu: 08:00–23:00 → 07:00–23:00" */
function changes(entry: StoreHoursHistoryEntry) {
  return entry.after
    .map((after) => {
      const before = entry.before?.find((b) => b.day_of_week === after.day_of_week);
      return { day: after.day_of_week, from: describe(before), to: describe(after) };
    })
    .filter((c) => c.from !== c.to)
    .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));
}

type Props = { onClose: () => void };

export default function StoreHoursHistoryModal({ onClose }: Props) {
  const [history, setHistory] = useState<StoreHoursHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStoreHoursHistory()
      .then(setHistory)
      .catch((err) => setError(err?.message ?? 'Gagal memuat riwayat.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              Riwayat Perubahan Jam Buka
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Hanya hari yang berubah yang ditampilkan.
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

        <div className="flex flex-col gap-2 overflow-y-auto p-6">
          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}
          {loading && <p className="py-6 text-center text-xs text-[#94a3b8]">Memuat riwayat...</p>}
          {!loading && history.length === 0 && (
            <p className="py-6 text-center text-xs text-[#94a3b8]">Jam buka belum pernah diubah.</p>
          )}
          {history.map((h) => {
            const diff = changes(h);
            return (
              <div key={h.id} className="rounded-xl border border-[#e2e8f0] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-bold text-white">
                    {h.channel === 'offline' ? 'Jam Operasional Offline' : 'Jam Layanan Online'}
                  </span>
                  <span className="text-[11px] text-[#64748b]">
                    {new Date(h.createdAt).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {h.changedByName && ` · oleh ${h.changedByName}`}
                  </span>
                </div>
                <ul className="flex flex-col gap-1 pt-2">
                  {diff.length === 0 && (
                    <li className="text-[11px] text-[#94a3b8]">Disimpan tanpa perubahan.</li>
                  )}
                  {diff.map((c) => (
                    <li key={c.day} className="text-[11px] text-[#334155]">
                      <span className="font-semibold">{DAY_NAMES[c.day]}:</span>{' '}
                      <span className="text-[#94a3b8] line-through">{c.from}</span> → {c.to}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
