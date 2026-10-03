import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  KIND_OPTIONS,
  PRICE_OPTIONS,
  SORT_OPTIONS,
  type MenuFilters as Filters,
} from './filterMenu';

// Kontrol terang di atas bar gelap; outline fokus pakai warna latar supaya kontras dengan bar
const fieldClass =
  'h-[33px] w-full rounded-[6px] border border-border bg-card text-[11px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background';

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('relative min-w-0 flex-auto md:flex-none', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          fieldClass,
          // Mobile: lebar mengikuti opsi terpilih (bukan opsi terpanjang) supaya 3 filter muat satu baris
          'cursor-pointer appearance-none truncate pr-5 pl-2 max-md:field-sizing-content md:pr-7 md:pl-2.5'
        )}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-1.5 size-3 md:right-2.5 -translate-y-1/2"
        strokeWidth={2.25}
      />
    </div>
  );
}

/**
 * Bar hitam search + filter (Figma 658:2). Desktop satu baris; mobile search di atas, filter di
 * bawahnya selebar isinya (yang tidak muat turun ke baris berikut, label tidak terpotong).
 */
export default function MenuFilters({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  filters: Filters;
  onFiltersChange: (patch: Partial<Filters>) => void;
}) {
  return (
    <search className="bg-primary">
      <div className="mx-auto flex max-w-page flex-wrap gap-1.5 px-4 py-3.5 md:flex-nowrap md:gap-3 md:px-[30px]">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Cari menu…"
          aria-label="Cari menu"
          enterKeyHint="search"
          className={cn(
            fieldClass,
            'basis-full px-3 placeholder:text-muted-foreground md:min-w-0 md:flex-1 md:basis-auto'
          )}
        />
        <FilterSelect
          label="Jenis menu"
          value={filters.kind}
          options={KIND_OPTIONS}
          onChange={(kind) => onFiltersChange({ kind })}
          className="md:w-[150px]"
        />
        <FilterSelect
          label="Rentang harga"
          value={filters.price}
          options={PRICE_OPTIONS}
          onChange={(price) => onFiltersChange({ price })}
          className="md:w-[150px]"
        />
        <FilterSelect
          label="Urutkan"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(sort) => onFiltersChange({ sort })}
          className="md:w-[140px]"
        />
      </div>
    </search>
  );
}
