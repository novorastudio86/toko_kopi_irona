import type { AssetStatus } from '../../types/asset';

export const STATUS_LABELS: Record<AssetStatus, string> = {
  aktif: 'Aktif',
  rusak: 'Rusak',
  dijual: 'Dijual',
  hilang: 'Hilang',
};

/** Pola arsir diagonal untuk status Rusak */
const HATCHED =
  'repeating-linear-gradient(45deg, #f1f5f9 0 4px, #e2e8f0 4px 8px)';

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  if (status === 'aktif') {
    return (
      <span className="inline-flex items-center rounded-full bg-[#0f172a] px-2.5 py-0.5 text-xs font-semibold text-white">
        ● Aktif
      </span>
    );
  }
  if (status === 'rusak') {
    return (
      <span
        style={{ backgroundImage: HATCHED }}
        className="inline-flex items-center rounded-full border-2 border-[#475569] px-2.5 py-1 text-xs font-bold text-[#0f172a]"
      >
        ⊘ Rusak
      </span>
    );
  }
  if (status === 'dijual') {
    return (
      <span className="inline-flex items-center rounded-full border border-[#334155] bg-white px-[11px] py-0.5 text-xs font-semibold text-[#334155] shadow-[0px_0px_0px_1px_#94a3b8]">
        ◈ Dijual
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border-2 border-dashed border-[#94a3b8] bg-[#f8fafc] px-2.5 py-1 text-xs font-medium text-[#64748b]">
      ◌ Hilang
    </span>
  );
}