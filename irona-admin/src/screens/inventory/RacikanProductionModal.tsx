import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { fetchRecipeComponents } from '../../services/recipes';
import { fetchBatchRacikan, fetchMaterialStockMap, recordRacikanProduction, type BatchRacikanOption } from '../../services/stock';
import { formatQty } from '../../utils/format';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';

type ComponentNeed = {
  key: string;
  name: string;
  unitName: string;
  needed: number;
  available: number;
  enough: boolean;
};

type Props = { onClose: () => void; onSaved: (name: string) => void };

export default function RacikanProductionModal({ onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [racikanList, setRacikanList] = useState<BatchRacikanOption[]>([]);
  const [racikanId, setRacikanId] = useState('');
  const [batchQty, setBatchQty] = useState('1');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');

  const [components, setComponents] = useState<{ type: 'bahan_baku' | 'racikan'; id: string; quantity: number }[]>([]);
  const [materialStock, setMaterialStock] = useState<Map<string, { name: string; unitName: string; stock: number }>>(
    new Map()
  );

  const [loading, setLoading] = useState(true);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    Promise.all([fetchBatchRacikan(), fetchMaterialStockMap()])
      .then(([list, stock]) => {
        setRacikanList(list);
        setMaterialStock(stock);
      })
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat data.' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!racikanId) {
      setComponents([]);
      return;
    }
    let cancelled = false;
    setLoadingComponents(true);
    fetchRecipeComponents('racikan', racikanId)
      .then((data) => !cancelled && setComponents(data))
      .catch((err) => !cancelled && setErrors({ form: err?.message ?? 'Gagal memuat komponen racikan.' }))
      .finally(() => !cancelled && setLoadingComponents(false));
    return () => {
      cancelled = true;
    };
  }, [racikanId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const racikan = racikanList.find((r) => r.id === racikanId);
  const batches = Number(batchQty);

  const needs = useMemo<ComponentNeed[]>(() => {
    if (!(batches > 0)) return [];
    return components.map((c) => {
      const needed = c.quantity * batches;
      const source =
        c.type === 'bahan_baku'
          ? materialStock.get(c.id)
          : (() => {
              const r = racikanList.find((item) => item.id === c.id);
              return r ? { name: r.name, unitName: r.unitName, stock: r.currentStock } : undefined;
            })();
      const available = source?.stock ?? 0;
      return {
        key: `${c.type}:${c.id}`,
        name: source?.name ?? '(item tidak ditemukan)',
        unitName: source?.unitName ?? '',
        needed,
        available,
        enough: available >= needed,
      };
    });
  }, [components, batches, materialStock, racikanList]);

  const allEnough = needs.length > 0 && needs.every((n) => n.enough);

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!racikanId) next.racikan = 'Pilih racikan yang diproduksi.';
    if (!(batches > 0)) next.batch = 'Jumlah batch harus lebih dari 0.';
    if (needs.length === 0 && racikanId) next.racikan = 'Racikan ini belum punya komponen resep.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await recordRacikanProduction({
        racikanId,
        batchQty: batches,
        movementDate: date,
        notes: notes.trim() || null,
      });
      onSaved(racikan?.name ?? 'Racikan');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal mencatat produksi racikan.' });
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
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Produksi Racikan</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Bahan penyusun dipotong otomatis, stok racikan bertambah sesuai hasil produksi.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {loading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat data...</p>
          ) : racikanList.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-center text-xs text-[#64748b]">
              Belum ada racikan Batch. Buat dulu di Master Resep, pilih Mode Produksi "Batch".
            </p>
          ) : (
            <>
              <div className="flex gap-4">
                <div className="flex flex-[2] flex-col gap-1.5">
                  <FieldLabel required>Racikan</FieldLabel>
                  <select
                    value={racikanId}
                    onChange={(e) => setRacikanId(e.target.value)}
                    className={inputClass(!!errors.racikan)}
                  >
                    <option value="">Pilih racikan</option>
                    {racikanList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (stok {formatQty(r.currentStock)} {r.unitName})
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.racikan} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel required>Jumlah Batch</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={batchQty}
                    onChange={(e) => setBatchQty(e.target.value)}
                    className={inputClass(!!errors.batch)}
                  />
                  <FieldError message={errors.batch} />
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

              {/* Kebutuhan bahan */}
              {racikanId && (
                <div className="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#334155]">
                    Kebutuhan Bahan untuk {batches > 0 ? formatQty(batches) : '—'} Batch
                  </p>
                  {loadingComponents ? (
                    <p className="py-2 text-xs text-[#94a3b8]">Memuat komponen...</p>
                  ) : needs.length === 0 ? (
                    <p className="py-2 text-xs text-[#94a3b8]">Isi jumlah batch untuk melihat kebutuhan bahan.</p>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase text-[#64748b]">
                          <th className="py-1.5 text-left">Bahan</th>
                          <th className="py-1.5 text-right">Dibutuhkan</th>
                          <th className="py-1.5 text-right">Stok Tersedia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {needs.map((n) => (
                          <tr key={n.key} className="border-t border-[#e2e8f0]">
                            <td className="py-2 text-xs text-[#1e293b]">{n.name}</td>
                            <td className="py-2 text-right font-mono text-xs text-[#0f172a]">
                              {formatQty(n.needed)} {n.unitName}
                            </td>
                            <td className="py-2 text-right">
                              <span
                                className={`inline-flex items-center gap-1 font-mono text-xs ${
                                  n.enough ? 'text-[#475569]' : 'font-bold text-[#dc2626]'
                                }`}
                              >
                                {!n.enough && <AlertTriangle className="size-3" />}
                                {formatQty(n.available)} {n.unitName}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <FieldLabel>Catatan</FieldLabel>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Produksi pagi, dibuat oleh Barista A"
                  className={inputClass()}
                />
              </div>

              {racikan && batches > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                  <span className="text-xs font-semibold text-[#475569]">Hasil produksi masuk ke stok</span>
                  <span className="font-mono text-base font-bold text-[#0f172a]">
                    +{formatQty(batches)} batch {racikan.name}
                  </span>
                </div>
              )}

              <p className="flex items-center gap-2 text-[11px] leading-4 text-[#64748b]">
                <Info className="size-3.5 shrink-0" />
                Jika ada bahan yang stoknya kurang, penyimpanan akan ditolak dan tidak ada stok yang berubah.
              </p>

              {errors.form && (
                <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
                  {errors.form}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
          <span className="text-[11px] text-[#64748b]">
            {racikanId && needs.length > 0 && !allEnough ? 'Ada bahan yang stoknya tidak mencukupi.' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || racikanList.length === 0}
              className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan Produksi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}