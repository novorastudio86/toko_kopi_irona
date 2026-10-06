import { useMemo } from 'react';
import { FlaskConical, Plus, X } from 'lucide-react';
import { formatRupiah, formatRupiahDetail } from '../../../utils/format';
import type { RecipeRow, RecipeSource } from '../../../types/product';
import { SourcePicker } from '../../../components/SourcePicker';

export function newRow(): RecipeRow {
  return { rowId: crypto.randomUUID(), sourceKey: '', quantity: '' };
}

type Props = {
  title: string;
  rows: RecipeRow[];
  onChange: (rows: RecipeRow[]) => void;
  sources: RecipeSource[];
  /** false = hanya bahan baku (dipakai saat racikan tidak boleh memakai racikan lain) */
  allowRacikan?: boolean;
  excludeKey?: string;
};

export function RecipeRowsEditor({ title, rows, onChange, sources, allowRacikan = true, excludeKey }: Props) {
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.key, s])), [sources]);
  const rawSources = sources.filter((s) => s.type === 'bahan_baku');
  const racikanSources = allowRacikan
    ? sources.filter((s) => s.type === 'racikan' && s.key !== excludeKey)
    : [];

  function updateRow(rowId: string, patch: Partial<RecipeRow>) {
    onChange(rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-[17px]">
      <p className="flex items-center gap-2 text-xs font-bold leading-4 text-[#0f172a]">
        <FlaskConical className="size-4" />
        {title}
      </p>

      <div className="grid grid-cols-[minmax(0,5fr)_92px_56px_104px_128px] gap-2.5 px-3 text-[11px] font-medium leading-4 text-[#64748b]">
        <span>{allowRacikan ? 'Bahan Baku / Racikan' : 'Bahan Baku'}</span>
        <span>Takaran</span>
        <span>Satuan</span>
        <span>Harga Satuan</span>
        <span>Total HPP</span>
      </div>

      {rows.map((row) => {
        const source = sourceMap.get(row.sourceKey);
        const qty = Number(row.quantity);
        const subtotal = source && qty > 0 ? qty * source.unitPrice : null;
        const usedElsewhere = new Set(rows.filter((r) => r.rowId !== row.rowId).map((r) => r.sourceKey));

        return (
          <div
            key={row.rowId}
            className="grid grid-cols-[minmax(0,5fr)_92px_56px_104px_128px] items-center gap-2.5 rounded-md border border-[#e2e8f0] bg-white p-[13px] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]"
          >
            <SourcePicker
              value={row.sourceKey}
              onChange={(key) => updateRow(row.rowId, { sourceKey: key })}
              sources={[...rawSources, ...racikanSources]}
              disabledKeys={usedElsewhere}
              inputClassName="rounded py-[7px] text-xs"
            />

            <input
              type="number"
              min={0}
              step="any"
              value={row.quantity}
              onChange={(e) => updateRow(row.rowId, { quantity: e.target.value })}
              placeholder="0"
              className="w-[70px] rounded border border-[#0f172a] bg-white px-[9px] py-[7px] text-xs font-medium text-[#0f172a] outline-none"
            />

            <span className="text-xs font-medium text-[#64748b]">{source?.unitName ?? '-'}</span>
            <span className="font-mono text-xs text-[#64748b]">
              {source ? formatRupiahDetail(source.unitPrice) : '-'}
            </span>

            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[#0f172a]">
                {subtotal !== null ? formatRupiah(subtotal) : '-'}
              </span>
              <button
                type="button"
                onClick={() => onChange(rows.filter((r) => r.rowId !== row.rowId))}
                aria-label="Hapus bahan"
                className="rounded p-0.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...rows, newRow()])}
        className="flex items-center justify-center gap-1.5 rounded border border-dashed border-[#cbd5e1] py-[9px] text-xs font-semibold text-[#475569] hover:bg-white"
      >
        <Plus className="size-3.5" />
        Tambah Bahan Lain
      </button>
    </div>
  );
}