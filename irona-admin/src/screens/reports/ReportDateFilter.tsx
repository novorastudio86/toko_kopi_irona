import type { ReactNode } from 'react';
import { PRESET_LABELS, REPORT_PRESETS, presetRange, type DatePreset, type DateRange } from './reportRange';

const inputClass =
  'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';

/** Filter rentang tanggal laporan: pilihan cepat + tanggal dari–sampai */
export default function ReportDateFilter({
  preset,
  range,
  today,
  onChange,
  presets = REPORT_PRESETS,
  children,
}: {
  preset: DatePreset;
  range: DateRange;
  today: string;
  onChange: (preset: DatePreset, range: DateRange) => void;
  /** Pilihan cepat yang ditampilkan */
  presets?: DatePreset[];
  /** Filter tambahan di sebelah kanan (mis. status) */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={preset}
          onChange={(e) => {
            const p = e.target.value as DatePreset;
            onChange(p, p === 'custom' ? range : presetRange(p, today));
          }}
          className={`${inputClass} w-44`}
          aria-label="Periode"
        >
          {presets.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={range.start}
          max={range.end}
          onChange={(e) =>
            e.target.value && onChange('custom', { ...range, start: e.target.value })
          }
          className={inputClass}
          aria-label="Dari tanggal"
        />
        <span className="text-xs text-[#94a3b8]">–</span>
        <input
          type="date"
          value={range.end}
          min={range.start}
          max={today}
          onChange={(e) => e.target.value && onChange('custom', { ...range, end: e.target.value })}
          className={inputClass}
          aria-label="Sampai tanggal"
        />
      </div>
      {children}
    </div>
  );
}
