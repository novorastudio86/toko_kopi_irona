import { useEffect, useMemo, useState } from 'react';
import { Info, Settings2, X } from 'lucide-react';
import { fetchRecipeSources } from '../../../services/products';
import { fetchRacikanDetail, fetchUnits, saveRacikan } from '../../../services/recipes';
import { formatRupiah, formatRupiahDetail } from '../../../utils/format';
import type { RecipeRow, RecipeSource } from '../../../types/product';
import type { UnitOption } from '../../../types/recipe';
import { CheckboxOption, FieldError, FieldLabel, PercentChips, inputClass } from '../product-form/formUi';
import { RecipeRowsEditor, newRow } from './RecipeRowsEditor';

type Mode = 'batch' | 'made_to_order';

const MODE_CARDS: { value: Mode; title: string; description: string }[] = [
  { value: 'batch', title: 'Batch', description: 'Dibuat terjadwal, memiliki pencatatan stok tersendiri' },
  { value: 'made_to_order', title: 'Made to Order', description: 'Dibuat langsung saat pemesanan produk' },
];

type Props = {
  racikanId?: string | null;
  onClose: () => void;
  onSaved: (name: string) => void;
};

export default function RacikanFormModal({ racikanId = null, onClose, onSaved }: Props) {
  const isEdit = !!racikanId;

  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [mode, setMode] = useState<Mode>('batch');
  const [rows, setRows] = useState<RecipeRow[]>([newRow()]);
  const [yieldQty, setYieldQty] = useState('');
  const [totalOutput, setTotalOutput] = useState('');
  const [minStock, setMinStock] = useState('');
  const [cashierCanProduce, setCashierCanProduce] = useState(false);
  const [addCostPct, setAddCostPct] = useState<number | null>(10);

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [sources, setSources] = useState<RecipeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [unitList, srcs] = await Promise.all([fetchUnits(), fetchRecipeSources()]);
        if (cancelled) return;
        setUnits(unitList);
        setSources(srcs);

        if (racikanId) {
          const detail = await fetchRacikanDetail(racikanId);
          if (cancelled || !detail) return;
          setName(detail.name);
          setUnitId(detail.unitId);
          setMode(detail.productionMode);
          setYieldQty(String(detail.yieldQty));
          setTotalOutput(String(detail.totalOutputQty));
          setMinStock(detail.minStockAlert !== null ? String(detail.minStockAlert) : '');
          setCashierCanProduce(detail.cashierCanProduce);
          setAddCostPct(detail.addCostPercentage);
          setRows(
            detail.components.length > 0
              ? detail.components.map((c) => ({
                  rowId: crypto.randomUUID(),
                  sourceKey: `${c.type}:${c.id}`,
                  quantity: String(c.quantity),
                }))
              : [newRow()]
          );
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
  }, [racikanId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.key, s])), [sources]);
  const unitName = units.find((u) => u.id === unitId)?.name ?? '';

  const validRows = rows.filter((r) => r.sourceKey && Number(r.quantity) > 0);
  const costPerBatch = validRows.reduce(
    (sum, r) => sum + Number(r.quantity) * (sourceMap.get(r.sourceKey)?.unitPrice ?? 0),
    0
  );
  const addCostValue = costPerBatch * ((addCostPct ?? 0) / 100);
  const totalCostPerBatch = costPerBatch + addCostValue;
  const costPerPorsi = Number(yieldQty) > 0 ? totalCostPerBatch / Number(yieldQty) : null;
  const pricePerUnit = Number(totalOutput) > 0 ? totalCostPerBatch / Number(totalOutput) : null;

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!name.trim()) next.name = 'Nama racikan wajib diisi.';
    if (!unitId) next.unit = 'Pilih satuan acuan.';
    if (validRows.length === 0) next.rows = 'Tambahkan minimal satu bahan dengan takarannya.';
    if (!(Number(yieldQty) > 0)) next.yield = 'Yield harus lebih dari 0.';
    if (!(Number(totalOutput) > 0)) next.output = 'Total hasil produksi harus lebih dari 0.';
    if (mode === 'batch' && !(Number(minStock) > 0)) next.minStock = 'Alert stok minimum wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveRacikan(
        {
          name: name.trim(),
          unitId,
          productionMode: mode,
          yieldQty: Number(yieldQty),
          totalOutputQty: Number(totalOutput),
          addCostPercentage: addCostPct ?? 0,
          minStockAlert: mode === 'batch' ? Number(minStock) : null,
          cashierCanProduce: mode === 'batch' && cashierCanProduce,
          components: validRows.map((r) => {
            const source = sourceMap.get(r.sourceKey)!;
            return { type: source.type, id: source.id, quantity: Number(r.quantity), unitId: source.unitId };
          }),
        },
        racikanId
      );
      onSaved(name.trim());
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan racikan.' });
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
              {isEdit ? 'Ubah Resep Racikan' : 'Tambah Resep Racikan'}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Definisikan formulasi bahan setengah jadi yang dibuat in-house
            </p>
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
              {/* Identitas */}
              <div className="flex gap-4">
                <div className="flex flex-[2] flex-col gap-1.5">
                  <FieldLabel required>Nama Racikan</FieldLabel>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Sirup Gula Aren Irona"
                    className={inputClass(!!errors.name)}
                  />
                  <FieldError message={errors.name} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel required>Satuan Acuan</FieldLabel>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className={inputClass(!!errors.unit)}
                  >
                    <option value="">Pilih satuan</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.unit} />
                </div>
              </div>

              {/* Mode produksi */}
              <div className="flex flex-col gap-2">
                <FieldLabel required>Mode Produksi</FieldLabel>
                <div className="flex gap-3">
                  {MODE_CARDS.map((card) => {
                    const selected = mode === card.value;
                    return (
                      <button
                        key={card.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setMode(card.value)}
                        className={`flex flex-1 flex-col gap-1.5 rounded-xl text-left transition-colors ${
                          selected
                            ? 'border-2 border-[#0f172a] bg-[rgba(248,250,252,0.7)] p-4 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]'
                            : 'border border-[#e2e8f0] bg-white p-[17px] opacity-70 hover:opacity-100'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`size-3.5 rounded-full ${
                              selected ? 'border-4 border-[#0f172a] bg-white' : 'border border-[#cbd5e1] bg-white'
                            }`}
                          />
                          <span className="text-sm font-bold text-[#0f172a]">{card.title}</span>
                        </span>
                        <span className="text-xs leading-5 text-[#475569]">{card.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Komposisi */}
              <RecipeRowsEditor
                title={mode === 'batch' ? 'Komposisi Racikan (Batch)' : 'Komposisi Racikan (Per Batch Acuan)'}
                rows={rows}
                onChange={setRows}
                sources={sources}
                excludeKey={racikanId ? `racikan:${racikanId}` : undefined}
              />
              <FieldError message={errors.rows} />

              {/* Parameter batch */}
              <div className="flex flex-col gap-3.5 rounded-xl border border-[#e2e8f0] bg-[rgba(248,250,252,0.5)] p-[17px]">
                <p className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2.5 text-xs font-bold uppercase tracking-[0.3px] text-[#0f172a]">
                  <Settings2 className="size-3.5" />
                  Parameter Batch &amp; Target
                </p>
                <div className="flex gap-3.5">
                  <div className="flex flex-1 flex-col gap-1">
                    <FieldLabel required>Yield</FieldLabel>
                    <div className="flex items-center rounded-lg border border-[#cbd5e1] bg-white pr-3">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={yieldQty}
                        onChange={(e) => setYieldQty(e.target.value)}
                        className="w-full bg-transparent px-[15px] py-[9px] text-sm font-semibold text-[#0f172a] outline-none"
                      />
                      <span className="text-xs font-medium text-[#64748b]">porsi</span>
                    </div>
                    <p className="text-xs leading-4 text-[#64748b]">
                      Dipakai untuk kalkulasi cost per porsi saji
                    </p>
                    <FieldError message={errors.yield} />
                  </div>

                  <div className="flex flex-1 flex-col gap-1">
                    <FieldLabel required>Total Hasil Produksi</FieldLabel>
                    <div className="flex items-center rounded-lg border border-[#cbd5e1] bg-white">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={totalOutput}
                        onChange={(e) => setTotalOutput(e.target.value)}
                        className="w-full bg-transparent px-[15px] py-[9px] text-sm font-semibold text-[#0f172a] outline-none"
                      />
                      <span className="self-stretch border-l border-[#e2e8f0] bg-[#f8fafc] px-3 py-[11px] text-xs font-semibold text-[#334155]">
                        {unitName || '-'}
                      </span>
                    </div>
                    <p className="text-xs leading-4 text-[#64748b]">
                      Satuan hasil produksi yang jadi acuan stok
                    </p>
                    <FieldError message={errors.output} />
                  </div>

                  {mode === 'batch' && (
                    <div className="flex flex-1 flex-col gap-1">
                      <FieldLabel required>Alert Stok Minimum</FieldLabel>
                      <div className="flex items-center rounded-lg border border-[#cbd5e1] bg-white">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={minStock}
                          onChange={(e) => setMinStock(e.target.value)}
                          className="w-full bg-transparent px-[15px] py-[9px] text-sm font-semibold text-[#0f172a] outline-none"
                        />
                        <span className="self-stretch border-l border-[#e2e8f0] bg-[#f8fafc] px-3 py-[11px] text-xs font-semibold text-[#334155]">
                          {unitName || '-'}
                        </span>
                      </div>
                      <p className="text-xs leading-4 text-[#64748b]">
                        Peringatan restock jika sisa racikan di bawah batas ini
                      </p>
                      <FieldError message={errors.minStock} />
                    </div>
                  )}
                </div>

                {mode === 'batch' && (
                  <div className="border-t border-[#e2e8f0] pt-3">
                    <CheckboxOption
                      checked={cashierCanProduce}
                      onToggle={() => setCashierCanProduce((v) => !v)}
                      title="Izinkan Kasir Update Stok"
                      description="Kasir bisa mencatat produksi racikan ini lewat Kasir App dengan menyertakan alasannya."
                    />
                  </div>
                )}
              </div>

              {/* Add cost & kalkulasi */}
              <div className="flex flex-col gap-4 rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] p-[17px]">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                  <div>
                    <p className="text-xs font-semibold text-[#1e293b]">Persentase Add Cost</p>
                    <p className="text-xs leading-5 text-[#64748b]">(Penyusutan / Biaya Masak)</p>
                  </div>
                  <PercentChips options={[10, 20, 30]} value={addCostPct} onChange={setAddCostPct} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col rounded-lg border border-[#e2e8f0] bg-white p-[11px]">
                    <span className="text-xs leading-4 text-[#64748b]">Cost per Batch (Bahan)</span>
                    <span className="font-mono text-sm font-bold text-[#0f172a]">{formatRupiah(costPerBatch)}</span>
                  </div>
                  <div className="flex flex-col rounded-lg border border-[#e2e8f0] bg-white p-[11px]">
                    <span className="text-xs leading-4 text-[#64748b]">Add Cost ({addCostPct ?? 0}%)</span>
                    <span className="font-mono text-sm font-bold text-[#047857]">+{formatRupiah(addCostValue)}</span>
                  </div>
                  <div className="flex flex-col rounded-lg border border-[#cbd5e1] bg-white p-[11px]">
                    <span className="text-xs leading-4 text-[#64748b]">Total Cost per Batch</span>
                    <span className="font-mono text-sm font-extrabold text-[#0f172a]">
                      {formatRupiah(totalCostPerBatch)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col rounded-lg border border-[#e2e8f0] bg-white p-[11px]">
                    <span className="text-xs leading-4 text-[#64748b]">Cost per Porsi</span>
                    <span className="font-mono text-sm font-bold text-[#0f172a]">
                      {costPerPorsi !== null ? formatRupiah(costPerPorsi) : '-'}{' '}
                      <span className="text-xs font-normal text-[#64748b]">/ porsi</span>
                    </span>
                  </div>
                  <div className="flex flex-col rounded-lg border border-[#e2e8f0] bg-white p-[11px]">
                    <span className="text-xs leading-4 text-[#64748b]">HPP</span>
                    <span className="font-mono text-sm font-bold text-[#0f172a]">
                      {pricePerUnit !== null ? formatRupiahDetail(pricePerUnit) : '-'}{' '}
                      <span className="text-xs font-normal text-[#64748b]">/ {unitName || '-'}</span>
                    </span>
                  </div>
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