import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { saveAsset } from '../../services/assets';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { fetchNetProfitMonths } from '../../services/finance';
import type { NetProfitMonth } from '../../types/finance';
import type { Asset } from '../../types/asset';
import { FieldError, FieldLabel, RupiahInput, inputClass } from '../products/product-form/formUi';

type Props = { asset: Asset | null; onClose: () => void; onSaved: (name: string, mode: 'create' | 'edit') => void };

export default function AssetFormModal({ asset, onClose, onSaved }: Props) {
  const isEdit = !!asset;
  const today = todayISO();

  const [name, setName] = useState(asset?.name ?? '');
  const [price, setPrice] = useState(asset ? String(Math.round(asset.purchasePrice)) : '');
  const [quantity, setQuantity] = useState(asset ? String(asset.quantity) : '1');
  const [date, setDate] = useState(asset?.purchaseDate ?? today);
  const [notes, setNotes] = useState(asset?.notes ?? '');

  const [saving, setSaving] = useState(false);
  const [profitMonths, setProfitMonths] = useState<NetProfitMonth[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  useEffect(() => {
    // Info saldo BEP bersifat tambahan: kalau gagal dimuat, form tetap bisa dipakai
    fetchNetProfitMonths()
      .then(setProfitMonths)
      .catch(() => setProfitMonths([]));
  }, []);

  const total = Number(price) * Number(quantity);

  // Sisa BEP di bulan tanggal beli (kalau sedang mengubah aset di bulan yang sama, nilai lamanya dikembalikan dulu)
  const bepMonth = profitMonths.find((m) => m.month.slice(0, 7) === date.slice(0, 7));
  const bepRemaining = bepMonth
    ? bepMonth.bepBalance +
      (asset && asset.purchaseDate.slice(0, 7) === date.slice(0, 7) ? asset.totalValue : 0)
    : null;
  const bepShort = bepRemaining !== null && total > 0 && total > bepRemaining;

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!name.trim()) next.name = 'Nama aset wajib diisi.';
    if (!(Number(price) > 0)) next.price = 'Harga per unit wajib diisi.';
    if (!(Number(quantity) > 0)) next.quantity = 'Jumlah harus lebih dari 0.';
    if (!date) next.date = 'Tanggal beli wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveAsset(
        {
          name: name.trim(),
          purchasePrice: Number(price),
          quantity: Number(quantity),
          purchaseDate: date,
          notes: notes.trim() || null,
        },
        asset?.id ?? null
      );
      onSaved(name.trim(), isEdit ? 'edit' : 'create');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan aset.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              {isEdit ? 'Ubah Aset' : 'Tambah Aset'}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Pencatatan inventaris perlengkapan toko, tidak memengaruhi stok bahan baku.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Nama Aset</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Mesin Espresso La Marzocco"
              className={inputClass(!!errors.name)}
            />
            <FieldError message={errors.name} />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-[2] flex-col gap-1.5">
              <FieldLabel required>Harga per Unit</FieldLabel>
              <RupiahInput value={price} onChange={setPrice} hasError={!!errors.price} placeholder="0" />
              <FieldError message={errors.price} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <FieldLabel required>Jumlah</FieldLabel>
              <input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass(!!errors.quantity)}
              />
              <FieldError message={errors.quantity} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Tanggal Beli</FieldLabel>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass(!!errors.date)}
            />
            <FieldError message={errors.date} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Catatan</FieldLabel>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Dibeli di Mebel Sido Makmur, garansi 1 tahun"
              className={inputClass()}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <span className="text-xs font-semibold text-[#475569]">Total Nilai Aset</span>
            <span className="font-mono text-base font-bold text-[#0f172a]">
              {total > 0 ? formatRupiah(total) : '—'}
            </span>
          </div>

          {bepShort && (
            <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-[11px] leading-4 text-[#92400e]">
              ⚠ Saldo BEP tidak mencukupi (sisa {formatRupiah(Math.max(bepRemaining ?? 0, 0))}),
              kekurangan {formatRupiah(total - Math.max(bepRemaining ?? 0, 0))} akan ditanggung saldo
              Owner. Tetap bisa disimpan.
            </p>
          )}

          {!isEdit && (
            <p className="flex items-center gap-2 text-[11px] leading-4 text-[#64748b]">
              <Info className="size-3.5 shrink-0" />
              Aset baru otomatis berstatus Aktif. Perubahan status dilakukan lewat menu Ubah Status.
            </p>
          )}

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
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}