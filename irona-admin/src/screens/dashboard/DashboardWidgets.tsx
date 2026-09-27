import type { ReactNode } from 'react';
import type { BreakdownRow, LowStockRow } from '../../types/dashboard';

const rp = (n: number) =>
  `Rp ${n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qtyFmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 3 });

/** Kartu widget dengan judul & tautan "Lihat Semua" */
export function WidgetCard({
  title,
  children,
  onViewAll,
  accent = 'green',
  empty,
}: {
  title: string;
  children: ReactNode;
  onViewAll?: () => void;
  accent?: 'green' | 'orange';
  empty?: boolean;
}) {
  return (
    <article className="flex flex-col justify-between rounded-[22px] border border-[rgba(226,232,240,0.9)] bg-white p-[29px] shadow-[0px_2px_8px_-2px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-6">
        <h3 className="text-lg font-bold leading-7 tracking-[-0.45px] text-[#0f172a]">{title}</h3>
        {empty ? (
          <p className="py-6 text-center text-xs text-[#94a3b8]">Belum ada data di periode ini.</p>
        ) : (
          children
        )}
      </div>
      {onViewAll && (
        <div className="mt-6 flex justify-end border-t border-[#f1f5f9] pt-[21px]">
          <button
            onClick={onViewAll}
            className={`text-sm font-semibold leading-5 hover:underline ${
              accent === 'orange' ? 'text-[#ea580c]' : 'text-[#00b87a]'
            }`}
          >
            Lihat Semua →
          </button>
        </div>
      )}
    </article>
  );
}

/** Kotak dalam dengan garis vertikal tipis (gaya "matrix" di desain) */
function MatrixBox({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#f1f5f9] bg-white p-[17px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.02)]">
      <div className="pointer-events-none absolute inset-0 flex justify-between px-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-full w-px bg-[rgba(241,245,249,0.9)]" />
        ))}
      </div>
      <div className="relative flex flex-col gap-[14px]">{children}</div>
    </div>
  );
}

function Bar({
  ratio,
  color = '#05e298',
  height = 12,
}: {
  ratio: number;
  color?: string;
  height?: number;
}) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-[#f1f5f9]" style={{ height }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, background: color }}
      />
    </div>
  );
}

/** Label di kiri, nominal + batang di kanan (Kasir, Jenis Order, Metode Pembayaran) */
export function LabeledBarList({ rows, limit }: { rows: BreakdownRow[]; limit?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <MatrixBox>
      {rows.slice(0, limit).map((r) => (
        <div key={r.key} className="grid grid-cols-[88px_1fr] items-center gap-3">
          <span className="text-right text-xs font-medium text-[#475569]">{r.label}</span>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-bold leading-4 text-[#0f172a]">{rp(r.amount)}</span>
            <Bar ratio={r.amount / max} height={8} />
          </div>
        </div>
      ))}
    </MatrixBox>
  );
}

/** Nama + nominal + persen, batang penuh di bawah (Penjualan per Kategori) */
export function ShareBarList({ rows, limit }: { rows: BreakdownRow[]; limit?: number }) {
  const total = rows.reduce((s, r) => s + r.amount, 0) || 1;
  return (
    <MatrixBox>
      {rows.slice(0, limit).map((r) => (
        <div key={r.key} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#334155]">{r.label}</span>
            <span className="flex items-center gap-3">
              <span className="text-[13px] font-bold leading-4 text-[#0f172a]">{rp(r.amount)}</span>
              <span className="w-8 text-right text-xs font-medium text-[#94a3b8]">
                {Math.round((r.amount / total) * 100)}%
              </span>
            </span>
          </div>
          <Bar ratio={r.amount / total} />
        </div>
      ))}
    </MatrixBox>
  );
}

/** Nama + jumlah terjual, batang di bawah (Produk Terlaris) */
export function QtyBarList({ rows, limit }: { rows: BreakdownRow[]; limit?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <MatrixBox>
      {rows.slice(0, limit).map((r) => (
        <div key={r.key} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#334155]">{r.label}</span>
            <span className="text-[13px] font-bold text-[#0f172a]">{qtyFmt(r.count)}</span>
          </div>
          <Bar ratio={r.count / max} />
        </div>
      ))}
    </MatrixBox>
  );
}

/** Warna batang stok menurut persen terhadap batas minimum */
function stockColor(ratio: number): string {
  if (ratio < 0.3) return '#a33a2b';
  if (ratio < 0.45) return '#d5c8a7';
  if (ratio < 0.75) return '#de9a35';
  return '#5d803f';
}

/** Ketersediaan Stok: stok saat ini / batas minimum */
export function StockList({ rows, limit }: { rows: LowStockRow[]; limit?: number }) {
  return (
    <div className="flex flex-col gap-5">
      {rows.slice(0, limit).map((r) => (
        <div key={r.name} className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[13px] font-medium leading-5 text-[#1e293b]">{r.name}</span>
            <span className="shrink-0 text-xs font-bold text-[#0f172a]">
              {qtyFmt(r.stock)} {r.unit}
              <span className="font-medium text-[#94a3b8]">
                {' '}
                / {qtyFmt(r.minStock)} {r.unit}
              </span>
            </span>
          </div>
          <Bar ratio={r.ratio} color={stockColor(r.ratio)} />
        </div>
      ))}
    </div>
  );
}
