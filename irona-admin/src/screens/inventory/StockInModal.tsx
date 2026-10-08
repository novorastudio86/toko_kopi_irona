import { useEffect, useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';
import { fetchUnits } from '../../services/recipes';
import { fetchRawMaterialDetail, fetchRawMaterials } from '../../services/rawMaterials';
import { recordStockIn } from '../../services/stock';
import { formatQty, formatRupiahDetail } from '../../utils/format';
import type { RawMaterialListItem } from '../../types/rawMaterial';
import type { UnitOption } from '../../types/recipe';
import { FieldError, FieldLabel, RupiahInput, inputClass } from '../products/product-form/formUi';

type Props = { onClose: () => void; onSaved: (name: string) => void; initialMaterialId?: string };

export default function StockInModal({ onClose, onSaved, initialMaterialId = '' }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [materials, setMaterials] = useState<RawMaterialListItem[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [materialId, setMaterialId] = useState(initialMaterialId);
  const [purchaseUnitId, setPurchaseUnitId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('1');
  const [qtyPerPackage, setQtyPerPackage] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    Promise.all([fetchRawMaterials(), fetchUnits()])
      .then(([m, u]) => {
        setMaterials(m.filter((item) => item.isActive));
        setUnits(u);
      })
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat data.' }))
      .finally(() => setLoading(false));
  }, []);

  // Isi otomatis satuan pembelian & isi kemasan dari master bahan
  useEffect(() => {
    if (!materialId) return;
    let cancelled = false;
    fetchRawMaterialDetail(materialId)
      .then((detail) => {
        if (cancelled || !detail) return;
        setPurchaseUnitId(detail.defaultPurchaseUnitId ?? '');
        setQtyPerPackage(detail.defaultQtyPerPackage !== null ? String(detail.defaultQtyPerPackage) : '');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const material = useMemo(() => materials.find((m) => m.id === materialId), [materials, materialId]);
  const baseQty = Number(purchaseQty) * Number(qtyPerPackage);
  const price = Number(totalPrice);
  const unitPrice = baseQty > 0 && price > 0 ? price / baseQty : null;

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!materialId) next.material = 'Pilih bahan baku.';
    if (!(Number(purchaseQty) > 0)) next.qty = 'Jumlah pembelian harus lebih dari 0.';
    if (!(Number(qtyPerPackage) > 0)) next.perPackage = 'Isi per kemasan harus lebih dari 0.';
    if (!(price > 0)) next.price = 'Total harga wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await recordStockIn({
        rawMaterialId: materialId,
        purchaseUnitId: purchaseUnitId || null,
        purchaseQty: Number(purchaseQty),
        qtyPerPackage: Number(qtyPerPackage),
        totalPrice: price,
        movementDate: date,
        notes: notes.trim() || null,
      });
      onSaved(material?.name ?? 'Bahan');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan stok masuk.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Stok Masuk</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Catat penerimaan barang. Harga per satuan diperbarui dari pembelian ini.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {loading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat data...</p>
          ) : (
            <>
              <div className="flex gap-4">
                <div className="flex flex-[2] flex-col gap-1.5">
                  <FieldLabel required>Bahan Baku</FieldLabel>
                  <select
                    value={materialId}
                    onChange={(e) => setMaterialId(e.target.value)}
                    className={inputClass(!!errors.material)}
                  >
                    <option value="">Pilih bahan baku</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unitName})
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.material} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel required>Tanggal</FieldLabel>
                  <input
                    type="date"
                    value={date}
                    max={today}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass()}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel required>Jumlah Pembelian</FieldLabel>
                  <div
                    className={`flex items-stretch overflow-hidden rounded-xl border ${
                      errors.qty ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
                    }`}
                  >
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={purchaseQty}
                      onChange={(e) => setPurchaseQty(e.target.value)}
                      className="w-full bg-white px-3 py-2.5 text-right text-sm text-[#0f172a] outline-none"
                    />
                    <select
                      value={purchaseUnitId}
                      onChange={(e) => setPurchaseUnitId(e.target.value)}
                      className="border-l border-[#cbd5e1] bg-[#f1f5f9] px-2 text-xs text-[#334155] outline-none"
                    >
                      <option value="">kemasan</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FieldError message={errors.qty} />
                </div>

                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel required>Isi per Kemasan</FieldLabel>
                  <div
                    className={`flex items-stretch overflow-hidden rounded-xl border ${
                      errors.perPackage ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
                    }`}
                  >
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={qtyPerPackage}
                      onChange={(e) => setQtyPerPackage(e.target.value)}
                      className="w-full bg-white px-3 py-2.5 text-right text-sm text-[#0f172a] outline-none"
                    />
                    <span className="flex items-center border-l border-[#cbd5e1] bg-[#f1f5f9] px-3 font-mono text-xs text-[#334155]">
                      {material?.unitName ?? '-'}
                    </span>
                  </div>
                  <FieldError message={errors.perPackage} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Total Harga Pembelian</FieldLabel>
                <RupiahInput value={totalPrice} onChange={setTotalPrice} hasError={!!errors.price} placeholder="0" />
                <FieldError message={errors.price} />
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>Catatan / No. Faktur</FieldLabel>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: PO-2026-089 / Supplier Gayo"
                  className={inputClass()}
                />
              </div>

              {/* Pratinjau hasil */}
              <div className="flex gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <div className="flex flex-1 flex-col">
                  <span className="text-xs font-bold uppercase text-[#64748b]">Masuk ke Stok</span>
                  <span className="font-mono text-sm font-bold text-[#0f172a]">
                    {baseQty > 0 ? `+${formatQty(baseQty)} ${material?.unitName ?? ''}` : '—'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-xs font-bold uppercase text-[#64748b]">Harga per Satuan Baru</span>
                  <span className="font-mono text-sm font-bold text-[#0f172a]">
                    {unitPrice !== null ? `${formatRupiahDetail(unitPrice)} / ${material?.unitName ?? ''}` : '—'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-xs font-bold uppercase text-[#64748b]">Harga Lama</span>
                  <span className="font-mono text-sm text-[#64748b]">
                    {material?.unitPrice != null
                      ? `${formatRupiahDetail(material.unitPrice)} / ${material.unitName}`
                      : '—'}
                  </span>
                </div>
              </div>

              <p className="flex items-center gap-2 text-xs leading-4 text-[#64748b]">
                <Info className="size-3.5 shrink-0" />
                Harga baru langsung dipakai menghitung ulang Total Cost produk dan racikan yang memakai bahan ini.
              </p>

              {errors.form && (
                <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
                  {errors.form}
                </p>
              )}
            </>
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
            disabled={saving || loading}
            className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Stok Masuk'}
          </button>
        </div>
      </div>
    </div>
  );
}