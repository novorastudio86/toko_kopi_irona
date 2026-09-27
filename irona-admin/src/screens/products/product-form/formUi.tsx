import { useState, type ReactNode } from 'react';
import { formatThousands } from '../../../utils/format';

export function inputClass(hasError?: boolean): string {
  return `w-full rounded-xl border bg-white px-[17px] py-[13px] text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#94a3b8] ${
    hasError ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
  }`;
}

export function FieldLabel({
  children,
  required,
  aside,
}: {
  children: ReactNode;
  required?: boolean;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-bold uppercase leading-4 tracking-[0.6px] text-[#334155]">
        {children}
        {required && <span className="text-[#f43f5e]"> *</span>}
      </p>
      {aside}
    </div>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-xs leading-4 text-[#f43f5e]">{message}</p>;
}

/** Input rupiah: menyimpan angka mentah ("18000"), menampilkan "18.000" */
export function RupiahInput({
  value,
  onChange,
  hasError,
  placeholder,
}: {
  value: string;
  onChange: (digits: string) => void;
  hasError?: boolean;
  placeholder?: string;
}) {
  return (
    <div
      className={`flex items-center rounded-xl border bg-white px-[17px] focus-within:border-[#94a3b8] ${
        hasError ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
      }`}
    >
      <span className="text-sm font-medium text-[#64748b]">Rp</span>
      <input
        type="text"
        inputMode="numeric"
        value={formatThousands(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 12))}
        placeholder={placeholder}
        className="w-full bg-transparent py-[13px] pl-3 text-sm font-semibold text-[#0f172a] outline-none placeholder:font-medium placeholder:text-[#94a3b8]"
      />
    </div>
  );
}

/** Pilihan persentase cepat (10/20/30%) + input custom */
export function PercentChips({
  options,
  value,
  onChange,
}: {
  options: number[];
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [customOpen, setCustomOpen] = useState(value !== null && !options.includes(value));

  const chip = (active: boolean) =>
    `rounded-lg px-4 py-2 text-xs font-semibold leading-4 transition-colors ${
      active ? 'bg-[#0f172a] text-white' : 'border border-[#e2e8f0] bg-white text-[#334155] hover:bg-[#f8fafc]'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => {
            setCustomOpen(false);
            onChange(option);
          }}
          className={chip(!customOpen && value === option)}
        >
          {option}%
        </button>
      ))}
      {customOpen ? (
        <div className="flex items-center rounded-lg border-2 border-[#0f172a] bg-white pl-3 pr-2">
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            autoFocus
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            className="w-16 py-1.5 text-xs font-semibold text-[#0f172a] outline-none"
          />
          <span className="text-xs font-semibold text-[#64748b]">%</span>
        </div>
      ) : (
        <button type="button" onClick={() => setCustomOpen(true)} className={chip(false)}>
          + Custom
        </button>
      )}
    </div>
  );
}