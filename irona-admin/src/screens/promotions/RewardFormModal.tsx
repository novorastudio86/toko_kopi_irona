import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchProductOptions } from '../../services/promotions';
import { saveReward } from '../../services/rewards';
import { formatRupiah } from '../../utils/format';
import type { ProductOption } from '../../types/promotion';
import type { Reward } from '../../types/reward';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';

type Props = {
  reward: Reward | null;
  onClose: () => void;
  onSaved: (name: string, mode: 'create' | 'edit') => void;
};

export default function RewardFormModal({ reward, onClose, onSaved }: Props) {
  const isEdit = !!reward;
  const [name, setName] = useState(reward?.name ?? '');
  const [productId, setProductId] = useState(reward?.productId ?? '');
  const [points, setPoints] = useState(reward ? String(reward.pointsRequired) : '');
  const [stock, setStock] = useState(reward ? String(reward.stock) : '');
  const [notes, setNotes] = useState(reward?.notes ?? '');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    fetchProductOptions()
      .then(setProducts)
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat produk.' }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const categories = [...new Set(products.map((p) => p.categoryName))].sort((a, b) =>
    a.localeCompare(b, 'id')
  );

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!name.trim()) next.name = 'Nama reward wajib diisi.';
    if (!productId) next.product = 'Pilih produk reward.';
    if (!(Number(points) > 0)) next.points = 'Poin diperlukan harus lebih dari 0.';
    if (stock === '') next.stock = 'Stok penukaran wajib diisi.';
    else if (reward && Number(stock) < reward.pendingCount)
      next.stock = `Masih ada ${reward.pendingCount} kode menunggu ditukar, stok minimal ${reward.pendingCount}.`;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveReward(
        {
          name: name.trim(),
          productId,
          pointsRequired: Number(points),
          stock: Number(stock),
          notes: notes.trim() || null,
        },
        reward?.id ?? null
      );
      onSaved(name.trim(), isEdit ? 'edit' : 'create');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan reward.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              {isEdit ? 'Ubah Reward' : 'Tambah Reward'}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Hadiah yang bisa ditukar member dengan poin di Web Customer.
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
            <FieldLabel required>Nama Reward</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Gratis Es Kopi Susu"
              className={inputClass(!!errors.name)}
            />
            <FieldError message={errors.name} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Produk</FieldLabel>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={inputClass(!!errors.product)}
            >
              <option value="">Pilih produk</option>
              {categories.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {products
                    .filter((p) => p.categoryName === cat)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.sellingPrice > 0 ? ` — ${formatRupiah(p.sellingPrice)}` : ''}
                        {!p.isActive ? ' (nonaktif)' : ''}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <FieldError message={errors.product} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Poin Diperlukan</FieldLabel>
              <div
                className={`flex w-48 items-center rounded-xl border bg-white pr-4 ${errors.points ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'}`}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={points}
                  onChange={(e) => setPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="20"
                  className="w-full bg-transparent px-[17px] py-[13px] text-sm font-semibold text-[#0f172a] outline-none"
                />
                <span className="text-sm text-[#64748b]">poin</span>
              </div>
              <FieldError message={errors.points} />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Stok Penukaran</FieldLabel>
              <div
                className={`flex w-48 items-center rounded-xl border bg-white pr-4 ${errors.stock ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'}`}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={stock}
                  onChange={(e) => setStock(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="50"
                  className="w-full bg-transparent px-[17px] py-[13px] text-sm font-semibold text-[#0f172a] outline-none"
                />
                <span className="text-sm text-[#64748b]">pcs</span>
              </div>
              <FieldError message={errors.stock} />
            </div>
          </div>

          <p className="-mt-2 text-[11px] leading-4 text-[#94a3b8]">
            Stok berkurang saat kode ditukar di kasir. Kode yang sudah diklaim tapi belum ditukar
            ikut mencadangkan stok, jadi member tidak bisa klaim kalau stok sudah habis.
            {reward && reward.pendingCount > 0 && (
              <span className="font-semibold text-[#b45309]">
                {' '}
                Saat ini {reward.pendingCount} kode menunggu ditukar.
              </span>
            )}
          </p>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Catatan</FieldLabel>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Ukuran regular, tidak bisa digabung promo lain"
              className={inputClass()}
            />
          </div>

          <p className="rounded-lg bg-[#f8fafc] px-3 py-2.5 text-[11px] leading-4 text-[#64748b]">
            Setelah member klaim, poinnya langsung terpotong dan ia mendapat kode unik yang berlaku
            1 hari. Kode ditukar di kasir; lewat 1 hari otomatis hangus dan poin tidak kembali.
          </p>

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
            {saving ? 'Menyimpan...' : 'Simpan Reward'}
          </button>
        </div>
      </div>
    </div>
  );
}
