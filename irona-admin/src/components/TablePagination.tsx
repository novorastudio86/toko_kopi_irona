import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
};

function NavButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`rounded-lg border border-[#e2e8f0] px-[9px] py-[5px] ${
        disabled
          ? 'cursor-not-allowed bg-[#f1f5f9] text-[#94a3b8]'
          : 'bg-white text-[#334155] hover:bg-[#f8fafc]'
      }`}
    >
      {children}
    </button>
  );
}

export function TablePagination({
  page,
  pageSize,
  total,
  itemLabel,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-[rgba(248,250,252,0.5)] px-4 pb-4 pt-[17px]">
      <div className="flex items-center gap-4">
        <p className="text-xs leading-4 text-[#475569]">
          Menampilkan{' '}
          <span className="font-bold text-[#0f172a]">
            {start} - {end}
          </span>{' '}
          dari <span className="font-bold text-[#0f172a]">{total}</span> {itemLabel}
        </p>
        <label className="flex items-center gap-2 text-xs leading-4 text-[#475569]">
          Baris per halaman:
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-[#e2e8f0] bg-white px-2 py-1 text-xs text-[#334155] outline-none"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <NavButton disabled={page <= 1} onClick={() => onPageChange(page - 1)} label="Halaman sebelumnya">
          <ChevronLeft className="size-4" />
        </NavButton>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={
              p === page
                ? 'rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-bold leading-4 text-white'
                : 'rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium leading-4 text-[#334155] hover:bg-[#f8fafc]'
            }
          >
            {p}
          </button>
        ))}
        <NavButton disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} label="Halaman selanjutnya">
          <ChevronRight className="size-4" />
        </NavButton>
      </div>
    </div>
  );
}