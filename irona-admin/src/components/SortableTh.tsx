import { ChevronDown, ChevronUp } from 'lucide-react';
import icSort from '../assets/ui/sort.svg';

export type SortDir = 'asc' | 'desc';

type Props = {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  align?: 'left' | 'center';
  className?: string;
};

export function SortableTh({ label, sortKey, activeKey, dir, onSort, align = 'left', className = '' }: Props) {
  const isActive = sortKey === activeKey;
  return (
    <th className={`py-[14px] ${align === 'center' ? 'text-center' : 'text-left'} ${className}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] transition-colors hover:text-[#0f172a] ${
          isActive ? 'text-[#0f172a]' : 'text-[#64748b]'
        }`}
      >
        {label}
        {isActive ? (
          dir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
        ) : (
          <img src={icSort} alt="" className="size-3.5" />
        )}
      </button>
    </th>
  );
}