import { useRef, useState, type DragEvent } from 'react';
import { Camera, Info as InfoIcon } from 'lucide-react';
import { createCategory, fetchNextDisplayOrder } from '../../../services/categories';
import type { Category } from '../../../types/category';
import icCheck from '../../../assets/ui/check.svg';
import { FieldError, FieldLabel, inputClass } from './formUi';

export type InfoValues = {
  name: string;
  description: string;
  photoFile: File | null; // foto baru yang dipilih
  photoPreview: string | null; // pratinjau foto baru (blob URL)
  photoUrl: string | null; // foto lama yang sudah tersimpan (mode ubah)
  categoryId: string;
  availableOffline: boolean;
  availableOnline: boolean;
  unit: string;
  sku: string;
  skuTouched: boolean; // true = SKU diketik manual
};

export type InfoErrors = Partial<Record<'name' | 'categoryId' | 'unit' | 'sku' | 'channels', string>>;

export const UNIT_OPTIONS = ['Cup (Gelas)', 'Porsi', 'Pcs', 'Botol', 'Box', 'Pack'];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

function ChannelCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-lg border border-[#e2e8f0] bg-white p-[9px] text-left drop-shadow-[0px_1px_1px_rgba(0,0,0,0.02)] hover:border-[#cbd5e1]"
    >
      <span
        className={`flex size-[18px] shrink-0 items-center justify-center rounded ${
          checked ? 'bg-[#0f172a]' : 'border border-[#cbd5e1] bg-white'
        }`}
      >
        {checked && <img src={icCheck} alt="" className="size-4" />}
      </span>
      <span className="text-xs font-semibold leading-[18px] text-[#0f172a]">{label}</span>
    </button>
  );
}

type Props = {
  values: InfoValues;
  onChange: (patch: Partial<InfoValues>) => void;
  errors: InfoErrors;
  categories: Category[];
  onCategoryCreated: (id: string) => Promise<void>;
  onResetSku: () => void;
};

export function InfoStep({ values, onChange, errors, categories, onCategoryCreated, onResetSku }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Form cepat "+ Buat baru" kategori
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickOrder, setQuickOrder] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const photoSrc = values.photoPreview ?? values.photoUrl;
  // Satuan lama yang tidak ada di daftar (mis. "porsi" dari seed) tetap bisa dipilih
  const unitOptions =
    values.unit && !UNIT_OPTIONS.includes(values.unit) ? [values.unit, ...UNIT_OPTIONS] : UNIT_OPTIONS;

  function acceptFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPhotoError('Format foto harus PNG, JPG, atau WEBP.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError('Ukuran foto maksimal 2 MB.');
      return;
    }
    setPhotoError(null);
    if (values.photoPreview) URL.revokeObjectURL(values.photoPreview);
    onChange({ photoFile: file, photoPreview: URL.createObjectURL(file) });
  }

  function removePhoto() {
    if (values.photoPreview) URL.revokeObjectURL(values.photoPreview);
    onChange({ photoFile: null, photoPreview: null, photoUrl: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  }

  async function openQuickCreate() {
    setQuickOpen(true);
    setQuickName('');
    setQuickError(null);
    try {
      setQuickOrder(String(await fetchNextDisplayOrder()));
    } catch {
      setQuickOrder('');
    }
  }

  async function saveQuickCategory() {
    const order = Number(quickOrder);
    if (!quickName.trim()) {
      setQuickError('Nama kategori wajib diisi.');
      return;
    }
    if (!Number.isInteger(order) || order <= 0) {
      setQuickError('Urutan harus angka bulat lebih dari 0.');
      return;
    }
    setQuickSaving(true);
    setQuickError(null);
    try {
      const id = await createCategory({
        name: quickName.trim(),
        icon: null,
        displayOrder: order,
        showInMenu: true,
        showOnline: false,
      });
      await onCategoryCreated(id);
      setQuickOpen(false);
    } catch (err: any) {
      setQuickError(
        err?.code === '23505' ? `Urutan ${order} sudah dipakai kategori lain.` : err?.message ?? 'Gagal membuat kategori.'
      );
    } finally {
      setQuickSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Nama */}
      <div className="flex flex-col gap-2">
        <FieldLabel required>Nama Produk</FieldLabel>
        <input
          type="text"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Contoh: Es Kopi Susu Irona"
          className={inputClass(!!errors.name)}
        />
        <FieldError message={errors.name} />
      </div>

      {/* Deskripsi */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Deskripsi Produk</FieldLabel>
        <textarea
          rows={3}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Ceritakan rasa, bahan utama, atau keunikan produk ini."
          className={`${inputClass()} resize-none font-normal leading-[22px]`}
        />
      </div>

      {/* Foto | Kategori + Saluran */}
      <div className="flex gap-6">
        <div className="flex flex-1 flex-col gap-2">
          <FieldLabel>Foto Produk</FieldLabel>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) acceptFile(file);
            }}
          />
          {photoSrc ? (
            <div className="relative flex h-[228px] items-center justify-center overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
              <img src={photoSrc} alt="Pratinjau foto produk" className="h-full w-full object-cover" />
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#0f172a] shadow hover:bg-white"
                >
                  Ganti
                </button>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#e11d48] shadow hover:bg-white"
                >
                  Hapus
                </button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex h-[228px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-[26px] transition-colors ${
                dragOver ? 'border-[#0f172a] bg-[#f1f5f9]' : 'border-[#cbd5e1] bg-[rgba(248,250,252,0.6)] hover:border-[#94a3b8]'
              }`}
            >
              <span className="flex size-12 items-center justify-center rounded-full border border-[#e2e8f0] bg-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                <Camera className="size-6 text-[#475569]" />
              </span>
              <p className="pt-3 text-sm font-semibold leading-5 text-[#1e293b]">Unggah Foto Produk</p>
              <p className="pt-1 text-xs leading-4 text-[#64748b]">PNG, JPG, WEBP maks. 2 MB</p>
              <p className="pt-[3px] text-xs font-medium leading-[16.5px] text-[#94a3b8]">(Rasio 1:1 disarankan)</p>
            </div>
          )}
          <FieldError message={photoError} />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          {/* Kategori */}
          <div className="flex flex-col gap-2">
            <FieldLabel
              required
              aside={
                !quickOpen && (
                  <button
                    type="button"
                    onClick={openQuickCreate}
                    className="text-xs font-semibold leading-4 text-[#1e293b] hover:underline"
                  >
                    + Buat baru
                  </button>
                )
              }
            >
              Kategori Produk
            </FieldLabel>
            <select
              value={values.categoryId}
              onChange={(e) => onChange({ categoryId: e.target.value })}
              className={inputClass(!!errors.categoryId)}
            >
              <option value="">Pilih kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.categoryId} />

            {quickOpen && (
              <div className="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <p className="text-xs font-bold uppercase tracking-[0.3px] text-[#475569]">Kategori Baru</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="Nama kategori"
                    className="flex-1 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
                  />
                  <input
                    type="number"
                    min={1}
                    value={quickOrder}
                    onChange={(e) => setQuickOrder(e.target.value)}
                    placeholder="Urutan"
                    className="w-20 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
                  />
                </div>
                <FieldError message={quickError} />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-white"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={saveQuickCategory}
                    disabled={quickSaving}
                    className="rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
                  >
                    {quickSaving ? 'Menyimpan...' : 'Simpan Kategori'}
                  </button>
                </div>
                <p className="text-xs leading-4 text-[#94a3b8]">
                  Tampil di Menu aktif otomatis. Icon dan tampilan online bisa diatur di Daftar Kategori.
                </p>
              </div>
            )}
          </div>

          {/* Saluran penjualan */}
          <div className="flex flex-col gap-2">
            <FieldLabel>Opsi Ketersediaan Saluran Penjualan</FieldLabel>
            <div className="flex flex-col gap-2.5 rounded-xl border border-[#e2e8f0] bg-[rgba(248,250,252,0.5)] p-[13px]">
              <ChannelCheckbox
                checked={values.availableOffline}
                onToggle={() => onChange({ availableOffline: !values.availableOffline })}
                label="Tampil di Menu Kasir / POS"
              />
              <ChannelCheckbox
                checked={values.availableOnline}
                onToggle={() => onChange({ availableOnline: !values.availableOnline })}
                label="Tersedia Online Order"
              />
            </div>
            <FieldError message={errors.channels} />
          </div>
        </div>
      </div>

      {/* Satuan | SKU */}
      <div className="flex gap-6">
        <div className="flex flex-1 flex-col gap-2">
          <FieldLabel required>Satuan Produk</FieldLabel>
          <select
            value={values.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            className={inputClass(!!errors.unit)}
          >
            <option value="">Pilih satuan</option>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <FieldError message={errors.unit} />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <FieldLabel
            required
            aside={
              values.skuTouched ? (
                <button
                  type="button"
                  onClick={onResetSku}
                  className="text-xs font-medium leading-4 text-[#64748b] hover:underline"
                >
                  Kustom · Kembalikan otomatis
                </button>
              ) : (
                <span className="text-xs font-medium leading-4 text-[#94a3b8]">Otomatis</span>
              )
            }
          >
            SKU / Kode Produk
          </FieldLabel>
          <input
            type="text"
            value={values.sku}
            onChange={(e) => onChange({ sku: e.target.value.toUpperCase(), skuTouched: true })}
            placeholder={values.categoryId ? 'Membuat kode...' : 'Pilih kategori dulu'}
            className={`${inputClass(!!errors.sku)} font-mono`}
          />
          <FieldError message={errors.sku} />
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs leading-4 text-[#94a3b8]">
        <InfoIcon className="size-3.5" />
        Nama produk harus unik. SKU dibuat otomatis dari kategori, tapi bisa diganti.
      </p>
    </div>
  );
}