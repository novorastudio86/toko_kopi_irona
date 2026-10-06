import type { AdjustmentType, ProductStatus } from '../../types/adjustment';
import { PRODUCT_STATUS_LABELS } from './adjustmentFormat';

export function AdjustmentTypeBadge({ type }: { type: AdjustmentType }) {
  return type === 'refund' ? (
    <span className="inline-flex rounded-md bg-[#fff1f2] px-2 py-0.5 text-xs font-bold text-[#be123c]">
      Refund
    </span>
  ) : (
    <span className="inline-flex rounded-md bg-[#fef3c7] px-2 py-0.5 text-xs font-bold text-[#92400e]">
      Try & Error
    </span>
  );
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold ${
        status === 'belum_dibuat'
          ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
          : 'border-[#cbd5e1] bg-white text-[#334155]'
      }`}
    >
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}
