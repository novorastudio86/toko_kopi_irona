import type { PeakCell } from '../../types/trendReport';
import { DAY_NAMES, DAY_ORDER, HOURS, hourLabel, type ValueOf } from './peakData';

/**
 * Heatmap Jam (00–23) × Hari (Senin–Minggu).
 * Intensitas warna = nilai sel ÷ nilai tertinggi (makin gelap makin ramai).
 */
export default function PeakHeatmap({
  cells,
  valueOf,
  format,
}: {
  cells: PeakCell[];
  valueOf: ValueOf;
  format: (n: number) => string;
}) {
  const grid = new Map<string, number>();
  cells.forEach((c) =>
    grid.set(`${c.dow}-${c.hour}`, (grid.get(`${c.dow}-${c.hour}`) ?? 0) + valueOf(c))
  );
  const max = Math.max(0, ...grid.values());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[64px_repeat(24,minmax(0,1fr))] gap-[3px]">
          <div />
          {HOURS.map((h) => (
            <div key={h} className="pb-1 text-center font-mono text-xs text-[#94a3b8]">
              {String(h).padStart(2, '0')}
            </div>
          ))}
          {DAY_ORDER.map((dow) => (
            <div key={dow} className="contents">
              <div className="flex items-center pr-2 text-xs font-medium text-[#475569]">
                {DAY_NAMES[dow]}
              </div>
              {HOURS.map((h) => {
                const v = grid.get(`${dow}-${h}`) ?? 0;
                const ratio = max ? v / max : 0;
                return (
                  <div
                    key={h}
                    title={`${DAY_NAMES[dow]} ${hourLabel(h)}: ${format(v)}`}
                    className="flex aspect-square min-h-[22px] items-center justify-center rounded-[4px] text-xs font-semibold"
                    style={{
                      background: v ? `rgba(15, 23, 42, ${0.08 + ratio * 0.92})` : '#f8fafc',
                      color: ratio > 0.5 ? '#fff' : '#475569',
                    }}
                  >
                    {v && ratio >= 0.6 ? Math.round(ratio * 100) : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-[#64748b]">
          <span>Sepi</span>
          <div
            className="h-2 w-32 rounded-full"
            style={{
              background: 'linear-gradient(90deg, rgba(15,23,42,0.08), rgba(15,23,42,1))',
            }}
          />
          <span>Ramai</span>
          <span className="ml-2 text-[#94a3b8]">Angka di sel = % dari slot teramai</span>
        </div>
      </div>
    </div>
  );
}
