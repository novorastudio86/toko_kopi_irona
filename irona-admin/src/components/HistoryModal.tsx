import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import type { HistoryEntry } from '../types/history';

export type HistoryFields = Record<string, { label: string; format?: (v: unknown) => string }>;

const ACTION_STYLES: Record<HistoryEntry['action'], { label: string; className: string }> = {
  dibuat: { label: 'Dibuat', className: 'bg-[#059669]' },
  diubah: { label: 'Diubah', className: 'bg-[#0f172a]' },
  dinonaktifkan: { label: 'Dinonaktifkan', className: 'bg-[#e11d48]' },
  diaktifkan: { label: 'Diaktifkan', className: 'bg-[#2563eb]' },
  dihapus: { label: 'Dihapus', className: 'bg-[#e11d48]' },
};

/** Tombol ikon di header halaman untuk membuka riwayat perubahan */
export function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Riwayat Perubahan"
      aria-label="Riwayat Perubahan"
      className="flex size-9 items-center justify-center text-[#334155] hover:text-[#0f172a]"
    >
      <History className="size-[18px]" />
    </button>
  );
}

type Props = {
  title: string;
  load: () => Promise<HistoryEntry[]>;
  fields: HistoryFields;
  onClose: () => void;
};

export function HistoryModal({ title, load, fields, onClose }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then(setHistory)
      .catch((err) => setError(err?.message ?? 'Gagal memuat riwayat.'))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const show = (k: string, v: unknown) =>
    v === null || v === undefined || v === '' ? '—' : (fields[k]?.format ?? String)(v);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">{title}</h2>
            <p className="text-xs leading-4 text-[#64748b]">Perubahan dalam 14 hari terakhir.</p>
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
          {!loading && !error && history.length === 0 && (
            <p className="py-6 text-center text-xs text-[#94a3b8]">
              Tidak ada perubahan dalam 14 hari terakhir.
            </p>
          )}
          {history.map((h) => {
            const action = ACTION_STYLES[h.action];
            return (
              <div key={h.id} className="rounded-xl border border-[#e2e8f0] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${action.className}`}
                    >
                      {action.label}
                    </span>
                    <span className="truncate text-xs font-semibold text-[#0f172a]">{h.subject}</span>
                    {h.tag && (
                      <span className="shrink-0 rounded border border-[#e2e8f0] px-1.5 text-xs font-medium text-[#64748b]">
                        {h.tag}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-[#64748b]">
                    {new Date(h.changedAt).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {h.reason && (
                  <p className="pt-1.5 text-xs text-[#334155]">
                    <span className="font-semibold">Alasan:</span> {h.reason}
                  </p>
                )}
                {h.changes && (
                  <ul className="flex flex-col gap-0.5 pt-1.5">
                    {Object.entries(h.changes).map(([k, c]) => {
                      const label = <span className="font-semibold">{fields[k]?.label ?? k}:</span>;
                      // Daftar (mis. komponen resep): tampilkan yang ditambah & dihapus saja
                      if (!fields[k]?.format && (Array.isArray(c.from) || Array.isArray(c.to))) {
                        const from = (c.from as string[] | null) ?? [];
                        const to = (c.to as string[] | null) ?? [];
                        return (
                          <li key={k} className="text-xs text-[#334155]">
                            {label}
                            {from
                              .filter((x) => !to.includes(x))
                              .map((x) => (
                                <span key={`-${x}`} className="block pl-3 text-[#e11d48] line-through">
                                  − {x}
                                </span>
                              ))}
                            {to
                              .filter((x) => !from.includes(x))
                              .map((x) => (
                                <span key={`+${x}`} className="block pl-3 text-[#059669]">
                                  + {x}
                                </span>
                              ))}
                          </li>
                        );
                      }
                      return (
                        <li key={k} className="text-xs text-[#334155]">
                          {label}{' '}
                          {k === 'photo_url' ? (
                            show(k, c.to)
                          ) : (
                            <>
                              <span className="text-[#94a3b8] line-through">{show(k, c.from)}</span> →{' '}
                              {show(k, c.to)}
                            </>
                          )}
                        </li>
                      );
                    })}
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
