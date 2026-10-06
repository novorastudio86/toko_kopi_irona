import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchOnlineOrderHistory } from '../../services/onlineOrder';
import { formatRupiah } from '../../utils/format';
import type { OnlineOrderHistoryEntry } from '../../types/onlineOrder';

const SECTION_LABELS: Record<OnlineOrderHistoryEntry['section'], string> = {
  jeda: 'Jeda Tayang',
  ongkir: 'Skema Ongkir',
  biaya_layanan: 'Biaya Layanan',
};

const FIELDS: Record<string, { label: string; format: (v: number) => string }> = {
  free_radius_km: { label: 'Radius gratis', format: (v) => `${v} km` },
  fee_per_step: { label: 'Tarif per kelipatan', format: (v) => formatRupiah(v) },
  step_km: { label: 'Kelipatan jarak', format: (v) => `${v} km` },
  fee_per_100m: { label: 'Tarif per 100 m', format: (v) => formatRupiah(v) },
  max_distance_km: { label: 'Jarak maksimal', format: (v) => `${v} km` },
  service_fee: { label: 'Biaya layanan', format: (v) => formatRupiah(v) },
};

type Props = { onClose: () => void };

export default function OnlineOrderHistoryModal({ onClose }: Props) {
  const [history, setHistory] = useState<OnlineOrderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOnlineOrderHistory()
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
              Riwayat Perubahan Order Online
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Jeda tayang, skema ongkir, dan biaya layanan.
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
            <p className="py-6 text-center text-xs text-[#94a3b8]">Belum ada perubahan.</p>
          )}
          {history.map((h) => {
            const changes = Object.keys(FIELDS).filter(
              (k) => h.after && k in h.after && Number(h.before?.[k]) !== Number(h.after[k])
            );
            return (
              <div key={h.id} className="rounded-xl border border-[#e2e8f0] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-xs font-bold text-white">
                    {SECTION_LABELS[h.section]}
                  </span>
                  <span className="text-xs text-[#64748b]">
                    {new Date(h.createdAt).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="pt-1.5 text-xs text-[#334155]">{h.description}</p>
                {changes.length > 0 && (
                  <ul className="flex flex-col gap-0.5 pt-1">
                    {changes.map((k) => (
                      <li key={k} className="text-xs text-[#334155]">
                        <span className="font-semibold">{FIELDS[k].label}:</span>{' '}
                        <span className="text-[#94a3b8] line-through">
                          {h.before?.[k] !== undefined
                            ? FIELDS[k].format(Number(h.before[k]))
                            : '—'}
                        </span>{' '}
                        → {FIELDS[k].format(Number(h.after![k]))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
