import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchPendingOvertime, reviewOvertime } from '../../services/attendance';
import type { PendingOvertime } from '../../types/attendance';
import { formatDayLabel } from '../../utils/date';

type Props = {
  /** Kalau diisi: putuskan 1 presensi ini saja (mis. mengubah keputusan). Kosong: semua yang menunggu. */
  single?: PendingOvertime | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

export default function OvertimeApprovalModal({ single, onClose, onSaved }: Props) {
  const [items, setItems] = useState<PendingOvertime[]>(single ? [single] : []);
  const [loading, setLoading] = useState(!single);
  const [selected, setSelected] = useState<Set<string>>(new Set(single ? [single.id] : []));
  // Menit yang disetujui per presensi (default = semua menit lembur malam)
  const [minutes, setMinutes] = useState<Record<string, string>>(
    single ? { [single.id]: String(single.overtimeNightMinutes) } : {}
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (single) return;
    try {
      const list = await fetchPendingOvertime();
      setItems(list);
      setMinutes(Object.fromEntries(list.map((i) => [i.id, String(i.overtimeNightMinutes)])));
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat lembur.');
    } finally {
      setLoading(false);
    }
  }, [single]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Setujui: menit penuh dikirim sekaligus; menit sebagian dikirim per presensi */
  async function approve(ids: string[]) {
    setBusy(true);
    setError(null);
    try {
      const full: string[] = [];
      for (const id of ids) {
        const item = items.find((i) => i.id === id)!;
        const m = Math.min(
          Number(minutes[id] ?? item.overtimeNightMinutes) || 0,
          item.overtimeNightMinutes
        );
        if (m === item.overtimeNightMinutes) full.push(id);
        else await reviewOvertime({ attendanceIds: [id], action: 'approve', minutes: m, note });
      }
      if (full.length) await reviewOvertime({ attendanceIds: full, action: 'approve', note });
      onSaved(`${ids.length} lembur disetujui.`);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyetujui lembur.');
    } finally {
      setBusy(false);
    }
  }

  async function reject(ids: string[]) {
    setBusy(true);
    setError(null);
    try {
      await reviewOvertime({ attendanceIds: ids, action: 'reject', note });
      onSaved(`${ids.length} lembur ditolak (tidak dibayar).`);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menolak lembur.');
    } finally {
      setBusy(false);
    }
  }

  const ids = [...selected];
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              {single ? 'Keputusan Lembur' : 'Persetujuan Lembur'}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Lembur lewat jam tutup baru dibayar setelah disetujui. Kurangi menitnya kalau sebagian
              waktu tidak dipakai bekerja.
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

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-[#f8fafc] text-[10px] font-bold uppercase tracking-[0.5px] text-[#64748b]">
                <tr>
                  {!single && (
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
                        }
                        aria-label="Pilih semua"
                      />
                    </th>
                  )}
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Karyawan</th>
                  <th className="px-3 py-2 text-left">Masuk – Pulang</th>
                  <th className="px-3 py-2 text-right">Lembur Terhitung</th>
                  <th className="px-3 py-2 text-right">Disetujui (menit)</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[#94a3b8]">
                      Memuat...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[#94a3b8]">
                      Tidak ada lembur yang menunggu persetujuan.
                    </td>
                  </tr>
                )}
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-[#f1f5f9]">
                    {!single && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i.id)}
                          onChange={() => toggle(i.id)}
                          aria-label={`Pilih ${i.employeeName}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-[#475569]">{formatDayLabel(i.attendanceDate)}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-[#0f172a]">{i.employeeName}</span>
                      <span className="block text-[10px] capitalize text-[#94a3b8]">
                        {i.shift ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[#334155]">
                      {formatTime(i.checkIn)} – {formatTime(i.checkOut)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-[#0f172a]">
                      {formatMinutes(i.overtimeNightMinutes)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={minutes[i.id] ?? ''}
                        onChange={(e) =>
                          setMinutes((prev) => ({
                            ...prev,
                            [i.id]: e.target.value.replace(/\D/g, '').slice(0, 4),
                          }))
                        }
                        className="w-20 rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-right font-mono text-xs outline-none focus:border-[#94a3b8]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan (opsional), mis. menunggu stok opname / santai setelah tutup"
            className="w-full rounded-xl border border-[#cbd5e1] px-4 py-2.5 text-xs outline-none focus:border-[#94a3b8]"
          />
          <p className="text-[11px] leading-4 text-[#94a3b8]">
            Dibayar per menit (tarif per jam ÷ 60). Lembur pagi karena Jam Khusus sudah otomatis
            disetujui dan tidak muncul di sini.
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
          <span className="text-xs text-[#64748b]">{single ? '' : `${selected.size} dipilih`}</span>
          <div className="flex gap-2">
            <button
              disabled={busy || ids.length === 0}
              onClick={() => reject(ids)}
              className="rounded border border-[#fecdd3] bg-white px-4 py-2 text-xs font-semibold text-[#e11d48] hover:bg-[#fff1f2] disabled:opacity-40"
            >
              Tolak
            </button>
            <button
              disabled={busy || ids.length === 0}
              onClick={() => approve(ids)}
              className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-40"
            >
              {busy ? 'Menyimpan...' : 'Setujui'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
