import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate } from '../../utils/date';
import type { Kasbon } from '../../types/kasbon';
import { KasbonStatusBadge } from './KasbonStatusBadge';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#f1f5f9] py-2.5 last:border-b-0">
      <span className="text-xs text-[#64748b]">{label}</span>
      <span className="text-right text-xs font-semibold text-[#0f172a]">{children}</span>
    </div>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = { kasbon: Kasbon; onClose: () => void };

export default function KasbonDetailModal({ kasbon, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const deductMonth = parseLocalDate(kasbon.deductMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Detail Kasbon</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              {kasbon.employeeName} · {kasbon.roleName}
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col overflow-y-auto px-6 py-3">
          <Row label="Jumlah">
            <span className="font-mono text-sm">{formatRupiah(kasbon.amount)}</span>
          </Row>
          <Row label="Status">
            <KasbonStatusBadge status={kasbon.status} />
          </Row>
          <Row label="Tanggal Pengajuan">
            {parseLocalDate(kasbon.requestDate).toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Row>
          <Row label="Dipotong dari Gaji">
            {kasbon.status === 'lunas_tunai' ? <span className="text-[#94a3b8] line-through">{deductMonth}</span> : deductMonth}
          </Row>
          {kasbon.settledCashAt && (
            <Row label="Dilunasi Tunai">
              {formatDateTime(kasbon.settledCashAt)}
              {kasbon.settledCashByName && <span className="block font-normal text-[#64748b]">oleh {kasbon.settledCashByName}</span>}
            </Row>
          )}
          <Row label="Dicatat">
            {formatDateTime(kasbon.createdAt)}
            {kasbon.createdByName && <span className="block font-normal text-[#64748b]">oleh {kasbon.createdByName}</span>}
          </Row>
          <Row label="Catatan">{kasbon.notes || <span className="font-normal text-[#94a3b8]">—</span>}</Row>
        </div>

        <div className="flex shrink-0 justify-end border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
          <button
            onClick={onClose}
            className="rounded border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
