import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { saveSalesTargets } from '../../services/dashboard';
import { FieldLabel, RupiahInput } from '../products/product-form/formUi';

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
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
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">{title}</h2>
            {subtitle && <p className="text-xs leading-4 text-[#64748b]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Daftar lengkap untuk "Lihat Semua" */
export function ListModal({
  title,
  subtitle,
  columns,
  rows,
  onClose,
}: {
  title: string;
  subtitle?: string;
  columns: [string, string, string?];
  rows: { key: string; cells: [string, string, string?] }[];
  onClose: () => void;
}) {
  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose}>
      <div className="overflow-hidden rounded-xl border border-[#e2e8f0]">
        <table className="w-full text-xs">
          <thead className="bg-[#f8fafc] text-[10px] font-bold uppercase tracking-[0.5px] text-[#64748b]">
            <tr>
              <th className="px-3 py-2 text-left">{columns[0]}</th>
              <th className="px-3 py-2 text-right">{columns[1]}</th>
              {columns[2] && <th className="px-3 py-2 text-right">{columns[2]}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-[#94a3b8]">
                  Belum ada data di periode ini.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.key} className="border-t border-[#f1f5f9]">
                <td className="px-3 py-2 text-[#334155]">
                  <span className="pr-2 font-mono text-[#94a3b8]">{i + 1}.</span>
                  {r.cells[0]}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-[#0f172a]">
                  {r.cells[1]}
                </td>
                {columns[2] && (
                  <td className="px-3 py-2 text-right font-mono text-[#64748b]">{r.cells[2]}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}

/** Atur target penjualan harian & bulanan (mingguan = harian × 7) */
export function TargetModal({
  daily,
  monthly,
  onClose,
  onSaved,
}: {
  daily: number;
  monthly: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dailyVal, setDailyVal] = useState(daily ? String(Math.round(daily)) : '');
  const [monthlyVal, setMonthlyVal] = useState(monthly ? String(Math.round(monthly)) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveSalesTargets(Number(dailyVal) || 0, Number(monthlyVal) || 0);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan target.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Target Penjualan"
      subtitle="Dipakai di kartu Total Penjualan. Target mingguan = target harian × 7."
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Target'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Target Harian</FieldLabel>
        <RupiahInput value={dailyVal} onChange={setDailyVal} placeholder="0" />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Target Bulanan</FieldLabel>
        <RupiahInput value={monthlyVal} onChange={setMonthlyVal} placeholder="0" />
      </div>
      {error && (
        <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          {error}
        </p>
      )}
    </ModalShell>
  );
}
