import { Plus, X } from 'lucide-react';
import type { ShiftPattern } from '../../types/shift';
import { formatClock } from '../../utils/date';
import { inputClass } from '../products/product-form/formUi';

type Props = {
  patterns: ShiftPattern[];
  /** id pola shift, maks. 2 (Shift 1, Shift 2) */
  value: string[];
  onChange: (ids: string[]) => void;
  hasError?: boolean;
};

function overlaps(a: ShiftPattern, b: ShiftPattern) {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function label(p: ShiftPattern) {
  return `${p.name} (${formatClock(p.startTime)}–${formatClock(p.endTime)})`;
}

/** Pilih Shift 1 + Shift 2 opsional — dipakai modal Tambah Manual & Koreksi presensi */
export function AttendanceShiftPicker({ patterns, value, onChange, hasError }: Props) {
  const [first, second] = value;
  const firstPattern = patterns.find((p) => p.id === first);
  const secondOptions = firstPattern
    ? patterns.filter((p) => p.id !== first && !overlaps(firstPattern, p))
    : [];

  function setFirst(id: string) {
    if (!id) return onChange([]);
    const next = patterns.find((p) => p.id === id)!;
    const keep = patterns.find((p) => p.id === second);
    onChange(keep && keep.id !== id && !overlaps(next, keep) ? [id, keep.id] : [id]);
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        value={first ?? ''}
        onChange={(e) => setFirst(e.target.value)}
        className={inputClass(hasError)}
      >
        <option value="">Pilih shift</option>
        {patterns.map((p) => (
          <option key={p.id} value={p.id}>
            {label(p)}
          </option>
        ))}
      </select>

      {first && second && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-bold uppercase text-[#94a3b8]">Shift 2</span>
          <select
            value={second}
            onChange={(e) => onChange([first, e.target.value])}
            className={inputClass()}
          >
            {secondOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {label(p)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange([first])}
            aria-label="Hapus Shift 2"
            className="rounded-md p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#e11d48]"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {first && !second && (
        <button
          type="button"
          onClick={() => onChange([first, secondOptions[0].id])}
          disabled={secondOptions.length === 0}
          className="flex w-fit items-center gap-1 rounded-lg border border-dashed border-[#cbd5e1] px-2.5 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3" />
          Shift 2 (double shift)
        </button>
      )}
    </div>
  );
}
