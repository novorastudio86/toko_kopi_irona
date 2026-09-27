import type { PromotionStatus } from '../../types/promotion';

export function PromotionStatusBadge({
  status,
  isUpcoming,
}: {
  status: PromotionStatus;
  isUpcoming?: boolean;
}) {
  if (status === 'kedaluwarsa') {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-2.5 py-0.5 text-[10px] font-bold text-[#64748b]">
        Kedaluwarsa
      </span>
    );
  }
  if (status === 'nonaktif') {
    return (
      <span className="inline-flex items-center rounded-full border border-[#cbd5e1] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#475569]">
        Nonaktif
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-bold text-white">
        Aktif
      </span>
      {isUpcoming && <span className="text-[10px] font-semibold text-[#b45309]">belum mulai</span>}
    </span>
  );
}
