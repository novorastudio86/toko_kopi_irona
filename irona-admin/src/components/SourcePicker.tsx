import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { RecipeSource } from '../types/product';

const GROUP_LABEL: Record<RecipeSource['type'], string> = { bahan_baku: 'Bahan Baku', racikan: 'Racikan' };

type Props = {
  value: string;
  onChange: (key: string) => void;
  sources: RecipeSource[];
  disabledKeys?: Set<string>;
  inputClassName?: string;
};

/** Pilih bahan baku / racikan yang bisa diketik untuk mencari */
export function SourcePicker({ value, onChange, sources, disabledKeys, inputClassName = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = sources.find((s) => s.key === value);
  const label = (s: RecipeSource) => `${s.name} (${s.unitName})`;

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources.filter((s) => !disabledKeys?.has(s.key) && (!q || s.name.toLowerCase().includes(q)));
  }, [sources, disabledKeys, query]);

  function pick(s: RecipeSource) {
    onChange(s.key);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (options.length ? (i + delta + options.length) % options.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && options[active]) pick(options[active]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation(); // jangan ikut menutup modal
      setOpen(false);
    }
  }

  function openList() {
    setQuery('');
    setActive(0);
    setOpen(true);
  }

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={open ? query : selected ? label(selected) : ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        title={selected ? label(selected) : undefined}
        placeholder={open && selected ? label(selected) : 'Cari bahan...'}
        className={`w-full truncate border border-[#cbd5e1] bg-white pl-8 pr-7 text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#94a3b8] ${inputClassName}`}
      />
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 max-h-64 w-max min-w-full max-w-[320px] overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white py-1 text-sm shadow-[0px_10px_24px_-6px_rgba(15,23,42,0.18)]"
        >
          {options.length === 0 && <li className="px-3 py-2 text-xs text-[#94a3b8]">Bahan tidak ditemukan.</li>}
          {options.map((s, i) => (
            <li key={s.key}>
              {(i === 0 || options[i - 1].type !== s.type) && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.3px] text-[#64748b]">
                  {GROUP_LABEL[s.type]}
                </p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={s.key === value}
                onMouseDown={(e) => e.preventDefault()} // tahan fokus input agar blur tidak menutup duluan
                onClick={() => pick(s)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full px-3 py-1.5 text-left leading-5 text-[#0f172a] ${
                  i === active ? 'bg-[#f1f5f9]' : ''
                } ${s.key === value ? 'font-semibold' : ''}`}
              >
                {label(s)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
