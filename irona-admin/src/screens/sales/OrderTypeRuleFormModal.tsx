import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { fetchProductOptions } from '../../services/promotions';
import { fetchRawMaterialOptions, saveOrderTypeRule } from '../../services/orderTypes';
import { formatRupiah } from '../../utils/format';
import type { ProductOption } from '../../types/promotion';
import type { OrderTypeRule, RawMaterialOption, RuleScope } from '../../types/orderType';
import { FieldError, FieldLabel, RupiahInput } from '../products/product-form/formUi';
import { SCOPE_LABELS } from './orderTypeFormat';

type ItemRow = {
  key: number;
  rawMaterialId: string;
  quantity: string;
  customOn: boolean;
  customCost: string;
};

type Props = {
  rule: OrderTypeRule | null;
  defaultScope: RuleScope;
  onClose: () => void;
  onSaved: (mode: 'create' | 'edit') => void;
};

export default function OrderTypeRuleFormModal({ rule, defaultScope, onClose, onSaved }: Props) {
  const isEdit = !!rule;
  const [scope, setScope] = useState<RuleScope>(rule?.scope ?? defaultScope);
  const [allProducts, setAllProducts] = useState(rule?.appliesToAllProducts ?? false);
  const [productIds, setProductIds] = useState<string[]>(rule?.productIds ?? []);
  const [rows, setRows] = useState<ItemRow[]>(
    rule?.items.length
      ? rule.items.map((i, idx) => ({
          key: idx,
          rawMaterialId: i.rawMaterialId,
          quantity: String(i.quantity),
          customOn: i.customCost !== null,
          customCost: i.customCost !== null ? String(Math.round(i.customCost)) : '',
        }))
      : [{ key: 0, rawMaterialId: '', quantity: '1', customOn: false, customCost: '' }]
  );

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [materials, setMaterials] = useState<RawMaterialOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    Promise.all([fetchProductOptions(), fetchRawMaterialOptions()])
      .then(([p, m]) => {
        setProducts(p);
        setMaterials(m);
      })
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat data.' }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  function rowCost(r: ItemRow): number {
    if (r.customOn) return Number(r.customCost) || 0;
    const m = materialById.get(r.rawMaterialId);
    return Math.round((m?.unitPrice ?? 0) * (Number(r.quantity) || 0) * 100) / 100;
  }
  const total = rows.reduce((sum, r) => sum + rowCost(r), 0);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!allProducts && productIds.length === 0)
      next.products = 'Pilih produk, atau centang Semua Produk.';
    if (rows.some((r) => !r.rawMaterialId || !(Number(r.quantity) > 0))) {
      next.items = 'Setiap baris wajib memilih bahan dengan jumlah lebih dari 0.';
    } else if (new Set(rows.map((r) => r.rawMaterialId)).size !== rows.length) {
      next.items = 'Bahan yang sama tidak boleh dimasukkan dua kali.';
    } else if (rows.some((r) => r.customOn && r.customCost === '')) {
      next.items = 'Isi custom harga, atau matikan togglenya.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveOrderTypeRule(
        {
          scope,
          appliesToAllProducts: allProducts,
          productIds,
          items: rows.map((r) => ({
            rawMaterialId: r.rawMaterialId,
            quantity: Number(r.quantity),
            customCost: r.customOn ? Number(r.customCost) || 0 : null,
          })),
        },
        rule?.id ?? null
      );
      onSaved(isEdit ? 'edit' : 'create');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan aturan.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              {isEdit ? 'Ubah Aturan' : 'Tambah Aturan'}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Bahan tambahan (cup, kresek, dll) yang ikut terpakai & ditagihkan saat order Take Away
              / Online.
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

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Berlaku Untuk</FieldLabel>
            <div className="inline-flex w-fit rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-1">
              {(Object.keys(SCOPE_LABELS) as RuleScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
                    scope === s
                      ? 'bg-[#0f172a] text-white shadow-sm'
                      : 'text-[#475569] hover:text-[#0f172a]'
                  }`}
                >
                  {SCOPE_LABELS[s]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              "Keduanya" otomatis tampil di kartu Take Away dan Online.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel required>Cakupan Produk</FieldLabel>
            <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-[#334155]">
              <input
                type="checkbox"
                checked={allProducts}
                onChange={(e) => setAllProducts(e.target.checked)}
                className="size-4 accent-[#0f172a]"
              />
              Semua Produk
            </label>
            {!allProducts && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Cari produk..."
                      className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#94a3b8]"
                    />
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#0f172a]">
                    {productIds.length} dipilih
                  </span>
                </div>
                <div
                  className={`max-h-48 overflow-y-auto rounded-lg border ${errors.products ? 'border-[#f43f5e]' : 'border-[#e2e8f0]'}`}
                >
                  {filteredProducts.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2.5 border-t border-[#f1f5f9] px-3 py-2 text-xs text-[#0f172a] first:border-t-0 hover:bg-[#f8fafc]"
                    >
                      <input
                        type="checkbox"
                        checked={productIds.includes(p.id)}
                        onChange={() =>
                          setProductIds((prev) =>
                            prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                          )
                        }
                        className="size-3.5 accent-[#0f172a]"
                      />
                      {p.name}
                      <span className="text-[#94a3b8]">
                        — {p.sellingPrice > 0 ? formatRupiah(p.sellingPrice) : '—'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-[#94a3b8]">
                  Produk boleh kena lebih dari 1 aturan — biayanya dijumlahkan.
                </p>
              </>
            )}
            <FieldError message={errors.products} />
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel required>Bahan Tambahan</FieldLabel>
            {rows.map((r) => {
              const m = materialById.get(r.rawMaterialId);
              return (
                <div
                  key={r.key}
                  className="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3"
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={r.rawMaterialId}
                      onChange={(e) => updateRow(r.key, { rawMaterialId: e.target.value })}
                      className="flex-1 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
                    >
                      <option value="">Pilih bahan baku</option>
                      {materials.map((opt) => (
                        <option
                          key={opt.id}
                          value={opt.id}
                          disabled={!opt.isActive && opt.id !== r.rawMaterialId}
                        >
                          {opt.name}
                          {opt.unitPrice > 0
                            ? ` — ${formatRupiah(opt.unitPrice)}/${opt.unitName}`
                            : ' — harga belum ada'}
                          {!opt.isActive ? ' (nonaktif)' : ''}
                        </option>
                      ))}
                    </select>
                    <div className="flex w-36 items-center rounded-lg border border-[#cbd5e1] bg-white pr-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={r.quantity}
                        onChange={(e) =>
                          updateRow(r.key, {
                            quantity: e.target.value.replace(/[^\d.]/g, '').slice(0, 8),
                          })
                        }
                        className="w-full bg-transparent px-3 py-2 text-xs font-semibold text-[#0f172a] outline-none"
                      />
                      <span className="text-[11px] text-[#64748b]">{m?.unitName ?? ''}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                      disabled={rows.length === 1}
                      aria-label="Hapus bahan"
                      className="rounded-lg p-2 text-[#94a3b8] hover:bg-white hover:text-[#e11d48] disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-[#475569]">
                      <input
                        type="checkbox"
                        checked={r.customOn}
                        onChange={(e) => updateRow(r.key, { customOn: e.target.checked })}
                        className="size-3.5 accent-[#0f172a]"
                      />
                      Custom Harga
                    </label>
                    {r.customOn ? (
                      <div className="w-44">
                        <RupiahInput
                          value={r.customCost}
                          onChange={(v) => updateRow(r.key, { customCost: v })}
                          placeholder="0"
                        />
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#64748b]">
                        {m
                          ? `${formatRupiah(m.unitPrice)} × ${r.quantity || 0} ${m.unitName} = `
                          : 'Biaya: '}
                        <span className="font-mono font-bold text-[#0f172a]">
                          {formatRupiah(rowCost(r))}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  {
                    key: Date.now(),
                    rawMaterialId: '',
                    quantity: '1',
                    customOn: false,
                    customCost: '',
                  },
                ])
              }
              className="flex w-fit items-center gap-1 rounded-lg border border-dashed border-[#cbd5e1] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
            >
              <Plus className="size-3.5" />
              Tambah Bahan Lagi
            </button>
            <FieldError message={errors.items} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <span className="text-xs font-semibold text-[#475569]">Total Biaya Aturan</span>
            <span className="font-mono text-base font-bold text-[#0f172a]">
              {formatRupiah(total)}
            </span>
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
            {saving ? 'Menyimpan...' : 'Simpan Aturan'}
          </button>
        </div>
      </div>
    </div>
  );
}
