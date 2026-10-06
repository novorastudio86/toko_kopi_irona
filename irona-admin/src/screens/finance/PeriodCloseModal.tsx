import { useCallback, useEffect, useState } from 'react';
import { Lock, LockOpen, X } from 'lucide-react';
import {
  closePeriod,
  fetchFinancePeriods,
  fetchPeriodLog,
  reopenPeriod,
  type FinancePeriod,
} from '../../services/finance';
import { formatMonthLabel } from '../../utils/date';
import { inputClass } from '../products/product-form/formUi';
import { formatDateTime } from './cashFlowFormat';

type Props = {
  /** Bulan yang langsung disiapkan untuk dibuka kembali, mis. "2026-08-01" */
  focusMonth?: string | null;
  onClose: () => void;
  onChanged: (message: string) => void;
};

type LogRow = Awaited<ReturnType<typeof fetchPeriodLog>>[number];

export default function PeriodCloseModal({ focusMonth, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<'bulan' | 'riwayat'>('bulan');
  const [periods, setPeriods] = useState<FinancePeriod[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [reopening, setReopening] = useState<string | null>(focusMonth ?? null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([fetchFinancePeriods(), fetchPeriodLog()]);
      setPeriods(p);
      setLog(l);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat data tutup buku.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged(message);
      setReopening(null);
      setReason('');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Tutup Buku</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Setiap ganti bulan, bulan lalu otomatis tutup buku: datanya tetap ada tapi hanya bisa
              dilihat. Buka kembali kalau perlu koreksi.
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

        <div className="flex shrink-0 gap-1 border-b border-[#e2e8f0] px-6">
          {(
            [
              ['bulan', 'Status Bulan'],
              ['riwayat', 'Riwayat Buka / Tutup'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-xs font-semibold ${
                tab === key
                  ? 'border-[#0f172a] text-[#0f172a]'
                  : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-6">
          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}

          {tab === 'bulan' &&
            periods.map((p) => (
              <div
                key={p.month}
                className={`flex flex-col gap-2 rounded-xl border px-4 py-3 ${
                  p.status === 'dibuka' ? 'border-[#fde68a] bg-[#fffbeb]' : 'border-[#e2e8f0]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {p.status === 'tertutup' ? (
                      <Lock className="size-4 text-[#64748b]" />
                    ) : (
                      <LockOpen
                        className={`size-4 ${p.status === 'dibuka' ? 'text-[#b45309]' : 'text-[#047857]'}`}
                      />
                    )}
                    <span className="text-sm font-semibold text-[#0f172a]">
                      {formatMonthLabel(p.month)}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                        p.status === 'tertutup'
                          ? 'bg-[#f1f5f9] text-[#475569]'
                          : p.status === 'dibuka'
                            ? 'bg-[#fef3c7] text-[#92400e]'
                            : 'bg-[#ecfdf5] text-[#047857]'
                      }`}
                    >
                      {p.status === 'tertutup'
                        ? 'Tutup Buku'
                        : p.status === 'dibuka'
                          ? 'Dibuka Kembali'
                          : 'Bulan Berjalan'}
                    </span>
                  </div>
                  {p.status === 'tertutup' && reopening !== p.month && (
                    <button
                      onClick={() => {
                        setReopening(p.month);
                        setReason('');
                      }}
                      className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Buka Kembali
                    </button>
                  )}
                  {p.status === 'dibuka' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => closePeriod(p.month),
                          `${formatMonthLabel(p.month)} sudah ditutup kembali.`
                        )
                      }
                      className="rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-40"
                    >
                      Tutup Kembali
                    </button>
                  )}
                </div>

                {p.status === 'dibuka' && (
                  <p className="text-xs leading-4 text-[#92400e]">
                    Dibuka oleh {p.openedByName ?? '—'}
                    {p.openedAt ? `, ${formatDateTime(p.openedAt)}` : ''} — {p.reason}
                  </p>
                )}

                {reopening === p.month && p.status === 'tertutup' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Alasan membuka kembali (wajib), mis. tagihan listrik telat diinput"
                      className={inputClass()}
                      autoFocus
                    />
                    <button
                      onClick={() => setReopening(null)}
                      className="shrink-0 rounded-lg border border-[#cbd5e1] px-3 py-2 text-xs text-[#334155]"
                    >
                      Batal
                    </button>
                    <button
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        run(
                          () => reopenPeriod(p.month, reason.trim()),
                          `${formatMonthLabel(p.month)} dibuka kembali untuk koreksi.`
                        )
                      }
                      className="shrink-0 rounded-lg bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Buka
                    </button>
                  </div>
                )}
              </div>
            ))}

          {tab === 'riwayat' && (
            <div className="flex flex-col divide-y divide-[#f1f5f9] rounded-xl border border-[#e2e8f0]">
              {log.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-[#94a3b8]">
                  Belum pernah ada bulan yang dibuka kembali.
                </p>
              )}
              {log.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start justify-between gap-3 px-4 py-2.5 text-xs"
                >
                  <span>
                    <span className="font-semibold text-[#0f172a]">
                      {l.action === 'buka' ? 'Dibuka kembali' : 'Ditutup kembali'} ·{' '}
                      {formatMonthLabel(l.month)}
                    </span>
                    {l.reason && <span className="block text-[#475569]">{l.reason}</span>}
                  </span>
                  <span className="shrink-0 text-right text-xs text-[#64748b]">
                    {l.byName ?? '—'}
                    <span className="block">{formatDateTime(l.at)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
