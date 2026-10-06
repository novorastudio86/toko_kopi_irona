import type { KasbonStatus } from '../../types/kasbon';

export const KASBON_STATUS_LABELS: Record<KasbonStatus, string> = {
  berjalan: 'Berjalan',
  lunas_gaji: 'Lunas · Potong Gaji',
  lunas_tunai: 'Lunas · Tunai',
};

export function KasbonStatusBadge({ status }: { status: KasbonStatus }) {
  if (status === 'berjalan') {
    return (
      <span className="inline-flex items-center rounded-full border border-[#f59e0b] bg-[#fffbeb] px-2.5 py-0.5 text-xs font-bold text-[#92400e]">
        {KASBON_STATUS_LABELS[status]}
      </span>
    );
  }
  if (status === 'lunas_gaji') {
    return (
      <span className="inline-flex items-center rounded-full bg-[#0f172a] px-2.5 py-0.5 text-xs font-bold text-white">
        {KASBON_STATUS_LABELS[status]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[#cbd5e1] bg-white px-2.5 py-0.5 text-xs font-bold text-[#334155]">
      {KASBON_STATUS_LABELS[status]}
    </span>
  );
}
