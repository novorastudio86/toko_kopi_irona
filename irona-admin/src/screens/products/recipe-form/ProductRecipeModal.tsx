import { useEffect, useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';
import { fetchProductDetail, fetchRecipeSources } from '../../../services/products';
import { saveProductRecipe } from '../../../services/recipes';
import { formatPercent, formatRupiah } from '../../../utils/format';
import type { RecipeRow, RecipeSource } from '../../../types/product';
import type { RecipeListItem } from '../../../types/recipe';
import { FieldError, FieldLabel, PercentChips, RupiahInput } from '../product-form/formUi';
import { RecipeRowsEditor, newRow } from './RecipeRowsEditor';

type Props = {
  /** Produk yang bisa dipilih (belum lengkap resepnya) — dipakai saat mode tambah */
  products: RecipeListItem[];
  /** Diisi = mode ubah resep produk tertentu */
  productId?: string | null;
  onClose: () => void;
  onSaved: (productName: string) => void;
};

export default function ProductRecipeModal({ products, productId = null, onClose, onSaved }: Props) {
  const isEdit = !!productId;

  const [selectedId, setSelectedId] = useState(productId ?? '');
  const [productName, setProductName] = useState('');
  const [productUnit, setProductUnit] = useState('Porsi');
  const [sources, setSources] = useState<RecipeSource[]>([]);
  const [rows, setRows] = useState<RecipeRow[]>([newRow()]);
  const [addCostPct, setAddCostPct] = useState<number | null>(10);
  const [desiredPct, setDesiredPct] = useState<number | null>(25);
  const [sellingPrice, setSellingPrice] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ product?: string; rows?: string; price?: string; form?: string }>({});

  useEffect(() => {
    fetchRecipeSources()
      .then(setSources)
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat daftar bahan.' }))
      .finally(() => setLoading(false));
  }, []);

  // Muat data produk terpilih (resep lama kalau ada)
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetchProductDetail(selectedId)
      .then((detail) => {
        if (cancelled || !detail) return;
        setProductName(detail.name);
        setProductUnit(detail.unit);
        setRows(
          detail.recipe.length > 0
            ? detail.recipe.map((r) => ({
                rowId: crypto.randomUUID(),
                sourceKey: `${r.type}:${r.id}`,
                quantity: String(r.quantity),
              }))
            : [newRow()]
        );
        setAddCostPct(detail.addCostPercentage || 10);
        setDesiredPct(detail.desiredCostPercentage ?? 25);
        setSellingPrice(detail.sellingPrice !== null ? String(Math.round(detail.sellingPrice)) : '');
      })
      .catch((err) => !cancelled && setErrors({ form: err?.message ?? 'Gagal memuat produk.' }));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.key, s])), [sources]);
  const validRows = rows.filter((r) => r.sourceKey && Number(r.quantity) > 0);
  const cost = validRows.reduce(
    (sum, r) => sum + Number(r.quantity) * (sourceMap.get(r.sourceKey)?.unitPrice ?? 0),
    0
  );
  const totalCost = cost * (1 + (addCostPct ?? 0) / 100);
  const recommended = desiredPct ? totalCost / (desiredPct / 100) : null;
  const price = Number(sellingPrice) || 0;
  const marginRp = price - totalCost;

  // Isi otomatis harga jual saat rekomendasi tersedia dan belum diisi
  useEffect(() => {
    if (!sellingPrice && recommended && recommended > 0) {
      setSellingPrice(String(Math.ceil(recommended / 1000) * 1000));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended]);

  async function handleSave() {
    const next: typeof errors = {};
    if (!selectedId) next.product = 'Pilih produk terlebih dahulu.';
    if (validRows.length === 0) next.rows = 'Tambahkan minimal satu bahan dengan takarannya.';
    if (!(price > 0)) next.price = 'Harga jual wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveProductRecipe(selectedId, {
        addCostPercentage: addCostPct ?? 0,
        desiredCostPercentage: desiredPct ?? 0,
        sellingPrice: price,
        recipe: validRows.map((r) => {
          const source = sourceMap.get(r.sourceKey)!;
          return { type: source.type, id: source.id, quantity: Number(r.quantity), unitId: source.unitId };
        }),
      });
      onSaved(productName);
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan resep.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 pb-5 pt-5">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              {isEdit ? 'Ubah Resep Produk' : 'Tambah Resep Produk'}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">Hubungkan formula bahan ke produk menu penjualan</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded p-1 text-[#64748b] hover:text-[#0f172a]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {loading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat data...</p>
          ) : (
            <>
              {/* Pilih produk */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Pilih Produk</FieldLabel>
                <select
                  value={selectedId}
                  disabled={isEdit}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className={`w-full rounded-md border bg-white px-3 py-[9px] text-xs text-[#0f172a] outline-none focus:border-[#94a3b8] disabled:bg-[#f8fafc] ${
                    errors.product ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
                  }`}
                >
                  <option value="">Pilih produk</option>
                  {isEdit ? (
                    <option value={selectedId}>{productName}</option>
                  ) : (
                    products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs leading-4 text-[#64748b]">
                  Hanya menampilkan produk yang belum lengkap formula resepnya.
                </p>
                <FieldError message={errors.product} />
              </div>

              {/* Komposisi */}
              <RecipeRowsEditor
                title={`Komposisi Takaran Resep (Per 1 ${productUnit})`}
                rows={rows}
                onChange={setRows}
                sources={sources}
              />
              <FieldError message={errors.rows} />

              {/* Rincian biaya */}
              <div className="flex flex-col gap-2.5 rounded-lg border border-[#cbd5e1] bg-[#f1f5f9] p-[17px]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#475569]">Cost</span>
                  <span className="font-mono text-[#0f172a]">{formatRupiah(cost)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-[#475569]">
                    Add Cost (Penyusutan)
                    {addCostPct !== null && (
                      <span className="rounded border border-[#cbd5e1] bg-white px-[7px] py-[3px] text-xs font-semibold text-[#0f172a]">
                        {addCostPct}%
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[#0f172a]">+{formatRupiah(cost * ((addCostPct ?? 0) / 100))}</span>
                </div>
                <PercentChips options={[10, 20, 30]} value={addCostPct} onChange={setAddCostPct} />
                <div className="h-px bg-[#cbd5e1]" />
                <div className="flex items-end justify-between">
                  <span className="text-xs font-bold text-[#0f172a]">Total Cost</span>
                  <span className="text-base font-bold tracking-[-0.4px] text-[#0f172a]">
                    {formatRupiah(totalCost)} <span className="text-xs font-normal text-[#475569]">/ {productUnit}</span>
                  </span>
                </div>
              </div>

              {/* Desired cost */}
              <div className="flex flex-col gap-2.5 rounded-xl border border-[#e2e8f0] bg-white p-[17px]">
                <div>
                  <p className="text-xs font-bold text-[#0f172a]">Persentase Desired Cost</p>
                  <p className="text-xs leading-4 text-[#64748b]">
                    Target beban modal pokok terhadap harga jual produk
                  </p>
                </div>
                <PercentChips options={[10, 20, 25, 30]} value={desiredPct} onChange={setDesiredPct} />
              </div>

              {/* Rekomendasi */}
              <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-[17px]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#0f172a]">Harga Jual Rekomendasi</p>
                  <p className="text-xs leading-4 text-[#64748b]">Kalkulasi otomatis target harga jual sehat kafe</p>
                </div>
                <span className="text-lg font-bold text-[#0f172a]">
                  {recommended !== null ? formatRupiah(recommended) : '-'}
                </span>
              </div>

              {/* Harga jual */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Harga Jual Ditetapkan (Rp)</FieldLabel>
                <RupiahInput value={sellingPrice} onChange={setSellingPrice} hasError={!!errors.price} />
                <FieldError message={errors.price} />
              </div>

              {/* Analisis margin */}
              <div className="flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-[17px]">
                <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#0f172a]">
                  Analisis Margin &amp; Beban Pokok
                </p>
                <div className="flex gap-3">
                  {[
                    { label: 'Cost Ratio (%)', value: price > 0 ? formatPercent((totalCost / price) * 100) : '-' },
                    {
                      label: 'Margin (%)',
                      value: price > 0 ? formatPercent((marginRp / price) * 100) : '-',
                      green: marginRp >= 0,
                    },
                    { label: 'Margin (Rp)', value: price > 0 ? formatRupiah(marginRp) : '-' },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="flex flex-1 flex-col gap-1 rounded-lg border border-[#e2e8f0] bg-white p-[13px]"
                    >
                      <span className="text-xs font-semibold text-[#64748b]">{card.label}</span>
                      <span className={`text-lg font-bold ${card.green ? 'text-[#059669]' : 'text-[#0f172a]'}`}>
                        {card.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="flex items-center gap-2.5 rounded-md bg-[#f1f5f9] p-3 text-xs leading-4 text-[#475569]">
                <Info className="size-4 shrink-0" />
                Alert stok otomatis mengikuti ketersediaan bahan baku asli di modul Inventory Toko Kopi Irona.
              </p>

              {errors.form && (
                <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
                  {errors.form}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-[#e2e8f0] px-6 pb-4 pt-[17px]">
          <button
            onClick={onClose}
            className="rounded-md border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-md bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Resep'}
          </button>
        </div>
      </div>
    </div>
  );
}