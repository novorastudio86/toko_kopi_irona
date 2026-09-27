import type { ReactNode } from 'react';
import icSearch from '../assets/ui/search.svg';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children?: ReactNode; // slot untuk filter tambahan di halaman lain
};

export function SearchToolbar({ value, onChange, placeholder, children }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-[17px] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
      <div className="relative w-96">
        <img
          src={icSearch}
          alt=""
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 pl-[41px] pr-[17px] text-xs text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#94a3b8]"
        />
      </div>
      {children}
    </div>
  );
}