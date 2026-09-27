import { useEffect, useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';
import { fetchRawMaterials } from '../../services/rawMaterials';
import { fetchBatchRacikan, recordStockAdjustment, type BatchRacikanOption } from '../../services/stock';
import { formatQty } from '../../utils/format';
import type { RawMaterialListItem } from '../../types/rawMaterial';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';

const REASONS = [
  { value: 'opname', label: 'Stok Opname' },
  { value: 'penyusutan', label: 'Penyusutan / Sisa Proses' },
  { value: 'rusak', label: 'Rusak / Kedaluwarsa' },
  { value: 'hilang', label: 'Hilang' },
  { value: 'lainnya', label: 'Lainnya' },
];

type Props = { onClose: () => void; onSaved: (name: string) => void };

export default function StockAdjustmentModal({ onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [itemType, setItemType] = useState<'bahan_baku' | 'racikan'>('bahan_baku');
  const [itemId, setItemId] = useState('');
  const [physicalQty, setPhysicalQty] = useState('');
  const [reason, setReason] = useState('opname');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(today);

  const [materials, setMaterials] = useState<RawMaterialListItem[]>([]);
  const [racikanList, setRacikanList] = useState<BatchRacikanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    Promise.all([fetchRawMaterials(), fetchBatchRacikan()])
      .then(([m, r]) => {
        setMaterials(m.filter((item) => item.isActive));
        setRacikanList(r);
      })
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat data.' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const selected = useMemo(() => {
    if (itemType === 'bahan_baku') {
      const m = materials.find((item) => item.id === itemId);
      return m ? { name: m.name, unitName: m.unitName, stock: m.currentStock } : null;
    }
    const r = racikanList.find((item) => item.id === itemId);
    return r ? { name: r.name, unitName: r.unitName, stock: r.currentStock } : null;
  }, [itemType, itemId, materials, racikanList]);

  const delta = selected && physicalQty !== '' ? Number(physicalQty) - selected.stock : null;

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!itemId) next.item = 'Pilih item yang disesuaikan.';
    if (physicalQty === '' || Number(physicalQty) < 0) next.qty = 'Stok fisik wajib diisi dan tidak boleh negatif.';
    if (delta === 0) next.qty = 'Stok fisik sama dengan stok sistem, tidak perlu disesuaikan.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await recordStockAdjustment({
        itemType,
        itemId,
        physicalQty: Number(physicalQty),
        reason,
        notes: notes.trim() || null,
        movementDate: date,
      });
      onSaved(selected?.name ?? 'Item');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan penyesuaian.' });
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
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Penyesuaian Stok</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Samakan stok sistem dengan hasil hitung fisik di gudang.
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
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel required>Jenis Item</FieldLabel>
                  <select
                    value={itemType}
                    onChange={(e) => {
                      setItemType(e.target.value as 'bahan_baku' | 'racikan');
                      setItemId('');
                      setPhysicalQty('');
                    }}
                    className={inputClass()}
                  >
                    <option value="bahan_baku">Bahan Baku</option>
                    <option value="racikan">Racikan (Batch)</option>
                  </select>
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

              <div className="flex flex-col gap-1.5">
                <FieldLabel required>{itemType === 'bahan_baku' ? 'Bahan Baku' : 'Racikan'}</FieldLabel>
                <select
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    setPhysicalQty('');
                  }}
                  className={inputClass(!!errors.item)}
                >
                  <option value="">Pilih item</option>
                  {itemType === 'bahan_baku'
                    ? materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unitName})
                        </option>
                      ))
                    : racikanList.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.unitName})
                        </option>
                      ))}
                </select>
                <FieldError message={errors.item} />
                {itemType === 'racikan' && racikanList.length === 0 && (
                  <p className="text-[11px] text-[#94a3b8]">
                    Belum ada racikan Batch. Buat dulu di Master Resep.
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel>Stok Sistem</FieldLabel>
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] px-4 py-2.5 font-mono text-sm text-[#475569]">
                    {selected ? `${formatQty(selected.stock)} ${selected.unitName}` : '—'}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel required>Stok Fisik (hasil hitung)</FieldLabel>
                  <div
                    className={`flex items-stretch overflow-hidden rounded-xl border ${
                      errors.qty ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
                    }`}
                  >
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={physicalQty}
                      onChange={(e) => setPhysicalQty(e.target.value)}
                      disabled={!selected}
                      className="w-full bg-white px-3 py-2.5 text-right text-sm text-[#0f172a] outline-none disabled:bg-[#f8fafc]"
                    />
                    <span className="flex items-center border-l border-[#cbd5e1] bg-[#f1f5f9] px-3 font-mono text-xs text-[#334155]">
                      {selected?.unitName ?? '-'}
                    </span>
                  </div>
                  <FieldError message={errors.qty} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Alasan Penyesuaian</FieldLabel>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass()}>
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>Catatan</FieldLabel>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Tumpah saat refill hopper grinder"
                  className={inputClass()}
                />
              </div>

              {delta !== null && delta !== 0 && (
                <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                  <span className="text-xs font-semibold text-[#475569]">Selisih yang dicatat</span>
                  <span className="font-mono text-base font-bold text-[#0f172a]">
                    {delta > 0 ? '+' : ''}
                    {formatQty(delta)} {selected?.unitName}
                  </span>
                </div>
              )}

              <p className="flex items-center gap-2 text-[11px] leading-4 text-[#64748b]">
                <Info className="size-3.5 shrink-0" />
                Yang dicatat adalah selisihnya, sehingga riwayat stok tetap bisa ditelusuri.
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
            {saving ? 'Menyimpan...' : 'Simpan Penyesuaian'}
          </button>
        </div>
      </div>
    </div>
  );
}