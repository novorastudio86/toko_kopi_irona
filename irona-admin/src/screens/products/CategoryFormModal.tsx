import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { ModalShell } from '../../components/ModalShell';
import { CATEGORY_ICONS } from '../../constants/categoryIcons';
import {
  createCategory,
  fetchCategoryById,
  fetchNextDisplayOrder,
  updateCategory,
} from '../../services/categories';
import { CheckboxOption, FieldError, FieldLabel, inputClass } from './product-form/formUi';

type Props = {
  /** undefined = tambah baru, string = ubah kategori */
  categoryId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
};

type Errors = { name?: string; displayOrder?: string; form?: string };

export default function CategoryFormModal({ categoryId, onClose, onSaved }: Props) {
  const isEdit = !!categoryId;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [displayOrder, setDisplayOrder] = useState('');
  const [showInMenu, setShowInMenu] = useState(true);
  const [showOnline, setShowOnline] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (categoryId) {
          const cat = await fetchCategoryById(categoryId);
          if (cancelled) return;
          if (!cat) {
            setErrors({ form: 'Kategori tidak ditemukan atau sudah dihapus.' });
            return;
          }
          setName(cat.name);
          setIcon(cat.icon);
          setDisplayOrder(String(cat.displayOrder));
          setShowInMenu(cat.showInMenu);
          setShowOnline(cat.showOnline);
        } else {
          const next = await fetchNextDisplayOrder();
          if (!cancelled) setDisplayOrder(String(next));
        }
      } catch (err: any) {
        if (!cancelled) setErrors({ form: err?.message ?? 'Gagal memuat data kategori.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = 'Nama kategori wajib diisi.';
    const order = Number(displayOrder);
    if (!displayOrder.trim() || !Number.isInteger(order) || order <= 0) {
      next.displayOrder = 'Urutan tampil harus berupa angka bulat lebih dari 0.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = { name: name.trim(), icon, displayOrder: order, showInMenu, showOnline };

    setSaving(true);
    try {
      if (categoryId) await updateCategory(categoryId, input);
      else await createCategory(input);
      onSaved(`Kategori "${input.name}" berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`);
    } catch (err: any) {
      if (err?.code === '23505') {
        setErrors({ displayOrder: `Urutan ${order} sudah dipakai kategori lain. Gunakan angka lain.` });
      } else {
        setErrors({ form: err?.message ?? 'Gagal menyimpan kategori.' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell open onBackdropClick={saving ? undefined : onClose} panelClassName="max-w-3xl" labelledBy="category-form-title">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 pb-5 pt-5">
          <h2 id="category-form-title" className="text-base font-bold leading-6 text-[#0f172a]">
            {isEdit ? 'Ubah Kategori' : 'Tambah Kategori'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded p-1 text-[#64748b] hover:text-[#0f172a]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {loading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat data...</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Nama Kategori</FieldLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Mocktail Coffee"
                  className={inputClass(!!errors.name)}
                />
                <FieldError message={errors.name} />
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>Icon Kategori</FieldLabel>
                <div className="grid grid-cols-5 gap-3">
                  {Object.entries(CATEGORY_ICONS).map(([key, meta]) => {
                    const selected = icon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        title={meta.label}
                        aria-pressed={selected}
                        onClick={() => setIcon(selected ? null : key)}
                        className={`flex h-14 items-center justify-center rounded-xl transition-colors ${
                          selected
                            ? 'border-2 border-[#0f172a] bg-[#f1f5f9]'
                            : 'border border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                        }`}
                      >
                        <img src={meta.src} alt={meta.label} className="size-6" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Urutan Tampil</FieldLabel>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className={`${inputClass(!!errors.displayOrder)} font-mono`}
                />
                <FieldError message={errors.displayOrder} />
              </div>

              <div className="flex flex-col gap-3 border-t border-[#e2e8f0] pt-4">
                <CheckboxOption
                  checked={showInMenu}
                  onToggle={() => setShowInMenu((v) => !v)}
                  title="Tampil di Menu Kasir / POS"
                  description="Tampilkan pada antarmuka kasir saat melayani pesanan offline."
                />
                <CheckboxOption
                  checked={showOnline}
                  onToggle={() => setShowOnline((v) => !v)}
                  title="Tampil di Online Order"
                  description="Kategori dapat diakses pelanggan di web catalog & agregator online."
                />
              </div>

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
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-md bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Kategori'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
