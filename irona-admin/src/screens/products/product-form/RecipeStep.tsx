import { useMemo } from 'react';
import { FlaskConical, Plus, X } from 'lucide-react';
import { formatRupiah, formatRupiahDetail } from '../../../utils/format';
import type { RecipeMethod, RecipeRow, RecipeSource } from '../../../types/product';
import { FieldError, FieldLabel, PercentChips, RupiahInput } from './formUi';

const METHODS: { value: RecipeMethod; title: string; description: string }[] = [
  {
    value: 'isi_sekarang',
    title: 'Isi Sekarang',
    description: 'Input rincian takaran bahan baku & hitung total cost langsung.',
  },
  {
    value: 'isi_nanti',
    title: 'Isi Nanti',
    description: 'Hanya membuat produk, formula resep diisi di Master Resep.',
  },
  {
    value: 'tanpa_resep',
    title: 'Tanpa Resep',
    description: 'Produk jadi / kemasan langsung tanpa perlu bahan mentah.',
  },
];

export function newRecipeRow(): RecipeRow {
  return { rowId: crypto.randomUUID(), sourceKey: '', quantity: '' };
}

type Props = {
  method: RecipeMethod;
  onMethodChange: (method: RecipeMethod) => void;
  rows: RecipeRow[];
  onRowsChange: (rows: RecipeRow[]) => void;
  sources: RecipeSource[];
  addCostPct: number | null;
  onAddCostPctChange: (value: number | null) => void;
  manualTotalCost: string;
  onManualTotalCostChange: (digits: string) => void;
  recipeCost: number;
  totalCost: number;
  error?: string | null;
};

export function RecipeStep({
  method,
  onMethodChange,
  rows,
  onRowsChange,
  sources,
  addCostPct,
  onAddCostPctChange,
  manualTotalCost,
  onManualTotalCostChange,
  recipeCost,
  totalCost,
  error,
}: Props) {
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.key, s])), [sources]);
  const rawSources = sources.filter((s) => s.type === 'bahan_baku');
  const racikanSources = sources.filter((s) => s.type === 'racikan');

  function updateRow(rowId: string, patch: Partial<RecipeRow>) {
    onRowsChange(rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Metode resep */}
      <div className="flex flex-col gap-3">
        <FieldLabel>Pilih Metode Manajemen Resep</FieldLabel>
        <div className="grid grid-cols-3 gap-3">
          {METHODS.map((m) => {
            const selected = method === m.value;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onMethodChange(m.value)}
                className={`flex items-start justify-between gap-3 rounded-xl bg-white text-left transition-colors ${
                  selected ? 'border-2 border-[#0f172a] p-4' : 'border border-[#e2e8f0] p-[17px] hover:border-[#cbd5e1]'
                }`}
              >
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-bold leading-5 text-[#0f172a]">{m.title}</span>
                  <span className="text-xs leading-[18px] text-[#64748b]">{m.description}</span>
                </span>
                <span
                  className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? 'border-[#0f172a]' : 'border-[#cbd5e1]'
                  }`}
                >
                  {selected && <span className="size-2 rounded-full bg-[#0f172a]" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Isi Sekarang: editor resep */}
      {method === 'isi_sekarang' && (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-[rgba(248,250,252,0.7)] p-5">
            <p className="flex items-center gap-2 text-sm font-bold leading-5 text-[#0f172a]">
              <FlaskConical className="size-4" />
              Komposisi Takaran Resep (Per 1 Porsi)
            </p>

            <div className="grid grid-cols-[minmax(0,1fr)_96px_56px_104px_104px_28px] gap-3 px-3 text-[11px] font-semibold uppercase tracking-[0.3px] text-[#64748b]">
              <span>Bahan Baku / Racikan</span>
              <span>Takaran</span>
              <span>Satuan</span>
              <span>Harga Satuan</span>
              <span>Total HPP</span>
              <span />
            </div>

            {rows.map((row) => {
              const source = sourceMap.get(row.sourceKey);
              const qty = Number(row.quantity);
              const subtotal = source && qty > 0 ? qty * source.unitPrice : null;
              const usedElsewhere = new Set(rows.filter((r) => r.rowId !== row.rowId).map((r) => r.sourceKey));

              return (
                <div
                  key={row.rowId}
                  className="grid grid-cols-[minmax(0,1fr)_96px_56px_104px_104px_28px] items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white p-3"
                >
                  <select
                    value={row.sourceKey}
                    onChange={(e) => updateRow(row.rowId, { sourceKey: e.target.value })}
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#94a3b8]"
                  >
                    <option value="">Pilih bahan...</option>
                    <optgroup label="Bahan Baku">
                      {rawSources.map((s) => (
                        <option key={s.key} value={s.key} disabled={usedElsewhere.has(s.key)}>
                          {s.name} ({s.unitName})
                        </option>
                      ))}
                    </optgroup>
                    {racikanSources.length > 0 && (
                      <optgroup label="Racikan">
                        {racikanSources.map((s) => (
                          <option key={s.key} value={s.key} disabled={usedElsewhere.has(s.key)}>
                            {s.name} ({s.unitName})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.rowId, { quantity: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#94a3b8]"
                  />
                  <span className="text-sm text-[#64748b]">{source?.unitName ?? '-'}</span>
                  <span className="font-mono text-xs text-[#64748b]">
                    {source ? formatRupiahDetail(source.unitPrice) : '-'}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#0f172a]">
                    {subtotal !== null ? formatRupiah(subtotal) : '-'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRowsChange(rows.filter((r) => r.rowId !== row.rowId))}
                    aria-label="Hapus bahan"
                    className="flex size-7 items-center justify-center rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => onRowsChange([...rows, newRecipeRow()])}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#cbd5e1] py-3 text-sm font-semibold text-[#1e293b] hover:bg-white"
            >
              <Plus className="size-4" />
              Tambah Bahan Lain
            </button>

            {racikanSources.length === 0 && (
              <p className="text-[11px] leading-4 text-[#94a3b8]">
                Belum ada racikan. Racikan bisa dibuat di Master Resep, lalu akan muncul di daftar ini.
              </p>
            )}
          </div>

          {/* Ringkasan biaya */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f1f5f9] p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#475569]">Cost</span>
              <span className="font-mono text-[#0f172a]">{formatRupiah(recipeCost)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-[#475569]">
                Add Cost (Penyusutan)
                {addCostPct !== null && (
                  <span className="rounded border border-[#e2e8f0] bg-white px-1.5 text-[11px] font-semibold text-[#0f172a]">
                    {addCostPct}%
                  </span>
                )}
              </span>
              <span className="font-mono text-[#0f172a]">
                +{formatRupiah(recipeCost * ((addCostPct ?? 0) / 100))}
              </span>
            </div>
            <PercentChips options={[10, 20, 30]} value={addCostPct} onChange={onAddCostPctChange} />
            <div className="mt-1 flex items-end justify-between border-t border-[#e2e8f0] pt-4">
              <span className="text-sm font-bold text-[#0f172a]">Total Cost</span>
              <span className="text-2xl font-extrabold tracking-[-0.5px] text-[#0f172a]">
                {formatRupiah(totalCost)}
                <span className="text-sm font-medium text-[#64748b]"> / porsi</span>
              </span>
            </div>
          </div>
        </>
      )}

      {/* Isi Nanti */}
      {method === 'isi_nanti' && (
        <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-sm leading-6 text-[#475569]">
          Produk akan disimpan sebagai <span className="font-semibold text-[#0f172a]">nonaktif</span> dan masuk
          daftar <span className="font-semibold text-[#0f172a]">Belum Lengkap Resep</span> di Master Resep. Total
          cost dan harga jual bisa ditetapkan setelah resepnya dilengkapi, lalu produk bisa diaktifkan.
        </div>
      )}

      {/* Tanpa Resep */}
      {method === 'tanpa_resep' && (
        <div className="flex flex-col gap-2 rounded-2xl border border-[#e2e8f0] bg-[rgba(248,250,252,0.7)] p-5">
          <FieldLabel required>Total Cost per Satuan</FieldLabel>
          <RupiahInput
            value={manualTotalCost}
            onChange={onManualTotalCostChange}
            hasError={!!error}
            placeholder="Contoh: 4.000"
          />
          <p className="text-[11px] leading-4 text-[#94a3b8]">
            Isi dengan harga beli/modal produk jadi (mis. air mineral botolan). Stok bahan tidak dipotong otomatis.
          </p>
        </div>
      )}

      <FieldError message={error} />
    </div>
  );
}