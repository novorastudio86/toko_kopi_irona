import { useEffect, useState, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';
import { fetchUnits } from '../../services/recipes';
import {
  createRawMaterial,
  createUnit,
  fetchRawMaterialDetail,
  isRawMaterialNameTaken,
  updateRawMaterial,
} from '../../services/rawMaterials';
import { formatQty, formatRupiahDetail } from '../../utils/format';
import type { MaterialType } from '../../types/rawMaterial';
import type { UnitOption } from '../../types/recipe';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';

const TYPE_CARDS: { value: MaterialType; title: string; description: string }[] = [
  {
    value: 'tetap',
    title: 'Barang Tetap',
    description: 'Tidak menyusut saat dipakai (cth: cup plastik, lid sealer, sedotan, box take away).',
  },
  {
    value: 'menyusut',
    title: 'Bahan Menyusut',
    description: 'Mengalami penyusutan fisik / yield saat proses olah resep (cth: biji kopi, susu, sirup).',
  },
];

/** Kartu angka read-only di bagian "Status Kalkulasi Otomatis Sistem" */
function AutoCard({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-lg border border-[#e2e8f0] bg-[#f1f5f9] p-[11px]">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-bold uppercase leading-4 text-[#64748b]">{label}</span>
        <Info className="size-3.5 text-[#94a3b8]" />
      </div>
      <span className="font-mono text-sm font-bold leading-5 text-[#1e293b]">{value}</span>
      <span className="text-[10px] leading-[12.5px] text-[#64748b]">{note}</span>
    </div>
  );
}

type Props = {
  materialId?: string | null;
  onClose: () => void;
  onSaved: (name: string, mode: 'create' | 'edit') => void;
};

export default function RawMaterialFormModal({ materialId = null, onClose, onSaved }: Props) {
  const isEdit = !!materialId;

  const [name, setName] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('menyusut');
  const [baseUnitId, setBaseUnitId] = useState('');
  const [purchaseUnitId, setPurchaseUnitId] = useState('');
  const [qtyPerPackage, setQtyPerPackage] = useState('');
  const [minStock, setMinStock] = useState('');

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [currentStock, setCurrentStock] = useState(0);

  const [newUnitOpen, setNewUnitOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitSaving, setNewUnitSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const unitList = await fetchUnits();
        if (cancelled) return;
        setUnits(unitList);

        if (materialId) {
          const detail = await fetchRawMaterialDetail(materialId);
          if (cancelled || !detail) return;
          setName(detail.name);
          setMaterialType(detail.materialType);
          setBaseUnitId(detail.baseUnitId);
          setPurchaseUnitId(detail.defaultPurchaseUnitId ?? '');
          setQtyPerPackage(detail.defaultQtyPerPackage !== null ? String(detail.defaultQtyPerPackage) : '');
          setMinStock(String(detail.minStockAlert));
          setUnitPrice(detail.unitPrice);
          setCurrentStock(detail.currentStock);
        }
      } catch (err: any) {
        if (!cancelled) setErrors({ form: err?.message ?? 'Gagal memuat data.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const baseUnitName = units.find((u) => u.id === baseUnitId)?.name ?? '';

  async function handleCreateUnit() {
    const value = newUnitName.trim();
    if (!value) return;
    setNewUnitSaving(true);
    try {
      const id = await createUnit(value);
      setUnits(await fetchUnits());
      setBaseUnitId(id);
      setNewUnitOpen(false);
      setNewUnitName('');
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        newUnit: err?.code === '23505' ? `Satuan "${value}" sudah ada.` : err?.message ?? 'Gagal menambah satuan.',
      }));
    } finally {
      setNewUnitSaving(false);
    }
  }

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = 'Nama bahan wajib diisi.';
    if (!baseUnitId) next.baseUnit = 'Pilih satuan dasar.';
    if (qtyPerPackage && !(Number(qtyPerPackage) > 0)) next.qty = 'Isi per kemasan harus lebih dari 0.';
    if (minStock && Number(minStock) < 0) next.minStock = 'Alert stok minimum tidak boleh negatif.';

    if (trimmed && !next.name) {
      try {
        if (await isRawMaterialNameTaken(trimmed, materialId ?? undefined)) {
          next.name = `Bahan "${trimmed}" sudah terdaftar.`;
        }
      } catch (err: any) {
        next.form = err?.message ?? 'Gagal memeriksa nama bahan.';
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = {
      name: trimmed,
      materialType,
      baseUnitId,
      defaultPurchaseUnitId: purchaseUnitId || null,
      defaultQtyPerPackage: qtyPerPackage ? Number(qtyPerPackage) : null,
      minStockAlert: minStock ? Number(minStock) : 0,
    };

    setSaving(true);
    try {
      if (isEdit) await updateRawMaterial(materialId!, input);
      else await createRawMaterial(input);
      onSaved(trimmed, isEdit ? 'edit' : 'create');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan bahan baku.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              {isEdit ? 'Ubah Bahan Baku' : 'Tambah Bahan Baku'}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Registrasi bahan baku baru untuk persediaan dan master resep
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {loading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat data...</p>
          ) : (
            <>
              {/* Nama bahan */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Nama Bahan</FieldLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Biji Kopi Flores Bajawa"
                  className={inputClass(!!errors.name)}
                />
                <FieldError message={errors.name} />
              </div>

              {/* Jenis bahan */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Jenis Bahan</FieldLabel>
                <div className="flex gap-3">
                  {TYPE_CARDS.map((card) => {
                    const selected = materialType === card.value;
                    return (
                      <button
                        key={card.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setMaterialType(card.value)}
                        className={`flex flex-1 items-start gap-2.5 rounded-lg text-left transition-colors ${
                          selected
                            ? 'border-2 border-[#0f172a] bg-[rgba(248,250,252,0.7)] p-3.5'
                            : 'border border-[#cbd5e1] bg-white p-[13px] hover:border-[#94a3b8]'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                            selected ? 'border-[5px] border-[#0f172a] bg-white' : 'border border-[#64748b] bg-white'
                          }`}
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold leading-4 text-[#0f172a]">{card.title}</span>
                          <span className="text-[11px] leading-[14px] text-[#64748b]">{card.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Satuan dasar & satuan pembelian */}
              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <FieldLabel required>Satuan Dasar</FieldLabel>
                  <select
                    value={baseUnitId}
                    onChange={(e) => setBaseUnitId(e.target.value)}
                    className={inputClass(!!errors.baseUnit)}
                  >
                    <option value="">Pilih satuan</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.baseUnit} />

                  {newUnitOpen ? (
                    <div className="flex flex-col gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={newUnitName}
                          onChange={(e) => setNewUnitName(e.target.value)}
                          placeholder="Nama satuan, mis. kg"
                          className="flex-1 rounded border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
                        />
                        <button
                          type="button"
                          onClick={handleCreateUnit}
                          disabled={newUnitSaving}
                          className="rounded bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
                        >
                          {newUnitSaving ? '...' : 'Simpan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewUnitOpen(false);
                            setErrors((prev) => ({ ...prev, newUnit: undefined }));
                          }}
                          className="rounded px-2 py-1.5 text-xs font-medium text-[#475569] hover:bg-white"
                        >
                          Batal
                        </button>
                      </div>
                      <FieldError message={errors.newUnit} />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNewUnitOpen(true)}
                      className="self-start text-[11px] leading-4 text-[#475569] underline hover:text-[#0f172a]"
                    >
                      + Tambah Satuan Baru
                    </button>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel>Satuan Pembelian Default</FieldLabel>
                  <select
                    value={purchaseUnitId}
                    onChange={(e) => setPurchaseUnitId(e.target.value)}
                    className={inputClass()}
                  >
                    <option value="">Belum ditentukan</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] leading-4 text-[#94a3b8]">
                    Satuan saat membeli (mis. karton, jerigen, dus).
                  </p>
                </div>
              </div>

              {/* Isi per kemasan & alert stok minimum */}
              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel>Isi per Kemasan Default</FieldLabel>
                  <div
                    className={`flex items-stretch overflow-hidden rounded-lg border ${
                      errors.qty ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
                    }`}
                  >
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={qtyPerPackage}
                      onChange={(e) => setQtyPerPackage(e.target.value)}
                      placeholder="1000"
                      className="w-full bg-white px-3 py-2 text-right text-xs text-[#0f172a] outline-none"
                    />
                    <span className="flex items-center border-l border-[#cbd5e1] bg-[#e2e8f0] px-3 font-mono text-xs text-[#334155]">
                      {baseUnitName || '-'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-4 text-[#94a3b8]">
                    Jumlah satuan dasar dalam 1 kemasan pembelian.
                  </p>
                  <FieldError message={errors.qty} />
                </div>

                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel>Alert Stok Minimum</FieldLabel>
                  <div
                    className={`flex items-stretch overflow-hidden rounded-lg border ${
                      errors.minStock ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
                    }`}
                  >
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white px-3 py-2 text-right text-xs text-[#0f172a] outline-none"
                    />
                    <span className="flex items-center border-l border-[#cbd5e1] bg-[#e2e8f0] px-3 font-mono text-xs text-[#334155]">
                      {baseUnitName || '-'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-4 text-[#94a3b8]">
                    Peringatan muncul jika stok turun sampai batas ini. Isi 0 untuk mematikan.
                  </p>
                  <FieldError message={errors.minStock} />
                </div>
              </div>

              {/* Status otomatis */}
              <div className="flex flex-col gap-2 border-t border-[#e2e8f0] pt-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#334155]">
                  Status Kalkulasi Otomatis Sistem
                </p>
                <div className="flex gap-2.5">
                  <AutoCard
                    label="Harga per Satuan"
                    value={unitPrice !== null ? `${formatRupiahDetail(unitPrice)} / ${baseUnitName}` : '—'}
                    note="Dihitung otomatis dari pembelian terakhir di Stok Masuk."
                  />
                  <AutoCard
                    label="Stok Saat Ini"
                    value={`${formatQty(currentStock)} ${baseUnitName}`}
                    note="Terisi otomatis saat penerimaan barang."
                  />
                </div>
              </div>

              {errors.form && (
                <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
                  {errors.form}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
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
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}