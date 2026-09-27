import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  createTryError,
  fetchMaterialOptions,
  fetchRecipeOptions,
  previewTryErrorUsage,
} from '../../services/adjustments';
import type { RecipeOption, TneUsageLine } from '../../types/adjustment';
import { formatRupiah, formatRupiahDetail } from '../../utils/format';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';
import { formatNumber } from './adjustmentFormat';

type Props = {
  onClose: () => void;
  onSaved: (label: string) => void;
};

type Mode = 'resep' | 'racikan_baru';
type MaterialOption = Awaited<ReturnType<typeof fetchMaterialOptions>>[number];
type MaterialRow = { key: number; materialId: string; qty: string };

/** Racikan baru: add cost terkunci 10% (PRD) */
const BRAINSTORM_ADD_COST = 10;

let rowKey = 0;
const newRow = (): MaterialRow => ({ key: ++rowKey, materialId: '', qty: '' });

/** Angka desimal dengan koma/titik, maks 3 desimal */
const cleanDecimal = (v: string) =>
  v
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1')
    .replace(/(\.\d{3})\d+$/, '$1');

export default function TryErrorFormModal({ onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('resep');
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [recipeKey, setRecipeKey] = useState(''); // "<tneType>:<id>"
  const [porsi, setPorsi] = useState('1');
  const [usage, setUsage] = useState<TneUsageLine[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [rows, setRows] = useState<MaterialRow[]>([newRow()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    Promise.all([fetchRecipeOptions(), fetchMaterialOptions()])
      .then(([r, m]) => {
        setRecipes(r);
        setMaterials(m);
      })
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat data resep.' }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const recipe = recipes.find((r) => `${r.tneType}:${r.id}` === recipeKey) ?? null;
  const porsiNum = Number(porsi) || 0;

  // Pratinjau bahan terpotong untuk resep existing
  useEffect(() => {
    if (mode !== 'resep' || !recipe || porsiNum <= 0) {
      setUsage([]);
      return;
    }
    let cancelled = false;
    setLoadingUsage(true);
    const timer = setTimeout(() => {
      previewTryErrorUsage({
        type: recipe.tneType,
        productId: recipe.tneType === 'resep_produk' ? recipe.id : null,
        racikanId: recipe.tneType === 'resep_racikan' ? recipe.id : null,
        quantity: porsiNum,
      })
        .then((lines) => !cancelled && setUsage(lines))
        .catch((err) => !cancelled && setErrors({ form: err?.message ?? 'Gagal memuat bahan.' }))
        .finally(() => !cancelled && setLoadingUsage(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, recipe, porsiNum]);

  const recipeGroups = useMemo(() => {
    const groups = new Map<string, RecipeOption[]>();
    [...recipes]
      .sort((a, b) => (a.tneType === b.tneType ? 0 : a.tneType === 'resep_produk' ? -1 : 1))
      .forEach((r) => {
        const label = r.tneType === 'resep_produk' ? `Produk · ${r.groupName}` : r.groupName;
        groups.set(label, [...(groups.get(label) ?? []), r]);
      });
    return [...groups.entries()];
  }, [recipes]);

  // Racikan baru: hitung di klien dari harga bahan terkini
  const brainstormLines = rows.map((row) => {
    const m = materials.find((x) => x.id === row.materialId);
    const qty = Number(row.qty) || 0;
    return { row, material: m, qty, subtotal: m ? qty * m.unitPrice : 0 };
  });
  const brainstormCost = brainstormLines.reduce((s, l) => s + l.subtotal, 0);
  const brainstormTotal = Math.round(brainstormCost * (1 + BRAINSTORM_ADD_COST / 100) * 100) / 100;

  const recipeTotal = recipe ? Math.round(recipe.costPerPorsi * porsiNum * 100) / 100 : 0;
  const shortage = usage.filter((u) => u.currentStock < u.quantity);

  function updateRow(key: number, patch: Partial<MaterialRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (mode === 'resep') {
      if (!recipe) next.recipe = 'Pilih resep produk atau racikan.';
      if (porsiNum <= 0) next.porsi = 'Jumlah porsi harus lebih dari 0.';
      else if (shortage.length > 0)
        next.porsi = `Stok tidak cukup: ${shortage.map((s) => s.itemName).join(', ')}.`;
    } else {
      const filled = rows.filter((r) => r.materialId || r.qty);
      if (filled.length === 0) next.rows = 'Tambahkan minimal 1 bahan baku.';
      else if (filled.some((r) => !r.materialId || !(Number(r.qty) > 0)))
        next.rows = 'Setiap baris wajib memilih bahan dan takaran lebih dari 0.';
      else {
        const lacking = brainstormLines.filter(
          (l) =>
            l.material &&
            brainstormLines
              .filter((x) => x.material?.id === l.material?.id)
              .reduce((s, x) => s + x.qty, 0) > l.material.stock
        );
        if (lacking.length > 0)
          next.rows = `Stok tidak cukup: ${[...new Set(lacking.map((l) => l.material!.name))].join(', ')}.`;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      if (mode === 'resep' && recipe) {
        await createTryError({
          type: recipe.tneType,
          productId: recipe.tneType === 'resep_produk' ? recipe.id : null,
          racikanId: recipe.tneType === 'resep_racikan' ? recipe.id : null,
          quantity: porsiNum,
          items: [],
          notes: notes.trim() || null,
        });
        onSaved(`${recipe.name} × ${formatNumber(porsiNum)} porsi`);
      } else {
        await createTryError({
          type: 'racikan_baru',
          productId: null,
          racikanId: null,
          quantity: 1,
          items: rows
            .filter((r) => r.materialId)
            .map((r) => ({ raw_material_id: r.materialId, quantity: Number(r.qty) })),
          notes: notes.trim() || null,
        });
        onSaved('Racikan Baru (Brainstorm)');
      }
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal mencatat try & error.' });
    } finally {
      setSaving(false);
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
      active ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Try & Error Produk</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Stok bahan terpotong dan biayanya dicatat. Tidak menambah stok hasil apa pun.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Tipe Try & Error</FieldLabel>
            <div className="flex gap-1 rounded-xl bg-[#f1f5f9] p-1">
              <button
                className={tabClass(mode === 'resep')}
                onClick={() => {
                  setMode('resep');
                  setErrors({});
                }}
              >
                Dari Resep Existing
              </button>
              <button
                className={tabClass(mode === 'racikan_baru')}
                onClick={() => {
                  setMode('racikan_baru');
                  setErrors({});
                }}
              >
                Racikan Baru (Brainstorm)
              </button>
            </div>
          </div>

          {mode === 'resep' ? (
            <>
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel required>Resep</FieldLabel>
                  <select
                    value={recipeKey}
                    onChange={(e) => setRecipeKey(e.target.value)}
                    className={inputClass(!!errors.recipe)}
                  >
                    <option value="">Pilih produk / racikan dari Master Resep</option>
                    {recipeGroups.map(([label, list]) => (
                      <optgroup key={label} label={label}>
                        {list.map((r) => (
                          <option key={`${r.tneType}:${r.id}`} value={`${r.tneType}:${r.id}`}>
                            {r.name} — {formatRupiahDetail(r.costPerPorsi)}/porsi
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <FieldError message={errors.recipe} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel required>Jumlah Porsi</FieldLabel>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={porsi}
                    onChange={(e) => setPorsi(cleanDecimal(e.target.value).slice(0, 8))}
                    className={inputClass(!!errors.porsi)}
                  />
                </div>
              </div>
              <FieldError message={errors.porsi} />

              {recipe && (
                <div className="rounded-xl border border-[#e2e8f0]">
                  <table className="w-full text-xs">
                    <thead className="bg-[#f8fafc] text-[10px] font-bold uppercase tracking-[0.5px] text-[#64748b]">
                      <tr>
                        <th className="px-3 py-2 text-left">Bahan Terpotong</th>
                        <th className="px-3 py-2 text-right">Jumlah</th>
                        <th className="px-3 py-2 text-right">Stok Tersedia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingUsage && usage.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-3 text-center text-[#94a3b8]">
                            Menghitung bahan...
                          </td>
                        </tr>
                      )}
                      {usage.map((u) => {
                        const short = u.currentStock < u.quantity;
                        return (
                          <tr key={u.itemName} className="border-t border-[#f1f5f9]">
                            <td className="px-3 py-2 text-[#334155]">
                              {u.itemName}
                              {u.itemType === 'racikan' && (
                                <span className="ml-1.5 rounded border border-[#cbd5e1] bg-[#f1f5f9] px-1 text-[10px] text-[#475569]">
                                  Racikan
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[#0f172a]">
                              {formatNumber(u.quantity)} {u.unitName}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-mono ${short ? 'font-bold text-[#e11d48]' : 'text-[#64748b]'}`}
                            >
                              {formatNumber(u.currentStock)} {u.unitName}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-col gap-1 rounded-xl bg-[#f8fafc] px-4 py-3 text-xs">
                <div className="flex justify-between text-[#64748b]">
                  <span>Total cost per porsi (Master Resep)</span>
                  <span className="font-mono">
                    {recipe ? formatRupiahDetail(recipe.costPerPorsi) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[#64748b]">
                  <span>Jumlah porsi</span>
                  <span className="font-mono">× {formatNumber(porsiNum)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold text-[#0f172a]">
                  <span>Total Cost</span>
                  <span className="font-mono">{formatRupiahDetail(recipeTotal)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Bahan Baku & Takaran</FieldLabel>
                <div className="flex flex-col gap-2">
                  {brainstormLines.map(({ row, material, qty, subtotal }) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-[1fr_150px_110px_32px] items-center gap-2"
                    >
                      <select
                        value={row.materialId}
                        onChange={(e) => updateRow(row.key, { materialId: e.target.value })}
                        className={inputClass()}
                      >
                        <option value="">Pilih bahan baku</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({formatNumber(m.stock)} {m.unitName})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center rounded-xl border border-[#cbd5e1] bg-white pr-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.qty}
                          onChange={(e) =>
                            updateRow(row.key, { qty: cleanDecimal(e.target.value).slice(0, 10) })
                          }
                          placeholder="0"
                          className="w-full bg-transparent px-3 py-[13px] text-sm font-semibold text-[#0f172a] outline-none"
                        />
                        <span className="text-xs text-[#64748b]">{material?.unitName ?? ''}</span>
                      </div>
                      <span
                        className={`text-right font-mono text-xs ${material && qty > material.stock ? 'font-bold text-[#e11d48]' : 'text-[#334155]'}`}
                      >
                        {formatRupiahDetail(subtotal)}
                      </span>
                      <button
                        onClick={() =>
                          setRows((prev) =>
                            prev.length === 1 ? [newRow()] : prev.filter((r) => r.key !== row.key)
                          )
                        }
                        aria-label="Hapus bahan"
                        className="flex size-8 items-center justify-center rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#e11d48]"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setRows((prev) => [...prev, newRow()])}
                  className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#f1f5f9]"
                >
                  <Plus className="size-3.5" />
                  Tambah Bahan
                </button>
                <FieldError message={errors.rows} />
              </div>

              <div className="flex flex-col gap-1 rounded-xl bg-[#f8fafc] px-4 py-3 text-xs">
                <div className="flex justify-between text-[#64748b]">
                  <span>Cost bahan</span>
                  <span className="font-mono">{formatRupiahDetail(brainstormCost)}</span>
                </div>
                <div className="flex justify-between text-[#64748b]">
                  <span>Add Cost (terkunci)</span>
                  <span className="font-mono">{BRAINSTORM_ADD_COST}%</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold text-[#0f172a]">
                  <span>Total Cost</span>
                  <span className="font-mono">{formatRupiah(brainstormTotal)}</span>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Catatan</FieldLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contoh: Uji coba menu baru Kopi Pandan"
              className={`${inputClass()} resize-none`}
            />
          </div>

          {errors.form && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {errors.form}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
          <button
            onClick={onClose}
            className="rounded border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Try & Error'}
          </button>
        </div>
      </div>
    </div>
  );
}
