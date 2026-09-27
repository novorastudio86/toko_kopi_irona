import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { saveStoreProfile, uploadStoreLogo } from '../../services/receipt';
import type { StoreProfile } from '../../types/receipt';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';

type Props = { profile: StoreProfile; onClose: () => void; onSaved: (p: StoreProfile) => void };

export default function StoreProfileModal({ profile, onClose, onSaved }: Props) {
  const [form, setForm] = useState<StoreProfile>(profile);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const set =
    (k: keyof StoreProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran logo maksimal 2 MB.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadStoreLogo(file);
      setForm((prev) => ({ ...prev, logoUrl: url }));
    } catch (err: any) {
      setError(err?.message ?? 'Gagal mengunggah logo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.storeName.trim()) {
      setError('Nama toko wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveStoreProfile(form);
      onSaved(form);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan data toko.');
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
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Data Toko</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Ditampilkan di struk. Tampil-tidaknya diatur lewat toggle.
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
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc]">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="size-full object-contain" />
              ) : (
                <span className="text-[10px] text-[#94a3b8]">Belum ada logo</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
                >
                  <ImagePlus className="size-3.5" />
                  {uploading ? 'Mengunggah...' : form.logoUrl ? 'Ganti Logo' : 'Unggah Logo'}
                </button>
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, logoUrl: null }))}
                    className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:text-[#e11d48]"
                  >
                    <Trash2 className="size-3.5" />
                    Hapus
                  </button>
                )}
              </div>
              <p className="text-[11px] leading-4 text-[#94a3b8]">
                JPG/PNG/WEBP, maks 2 MB. Printer thermal mencetak hitam-putih — pakai logo yang
                kontras.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleLogo(e.target.files?.[0])}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Nama Toko</FieldLabel>
            <input
              value={form.storeName}
              onChange={set('storeName')}
              placeholder="Irona Kopi"
              className={inputClass()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Alamat</FieldLabel>
            <textarea
              rows={2}
              value={form.address}
              onChange={set('address')}
              placeholder="Jl. ..."
              className={`${inputClass()} resize-none font-normal`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>No. Telepon</FieldLabel>
              <input
                value={form.phone}
                onChange={set('phone')}
                placeholder="0812-..."
                className={inputClass()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Email</FieldLabel>
              <input
                value={form.email}
                onChange={set('email')}
                placeholder="halo@ironakopi.id"
                className={inputClass()}
              />
            </div>
          </div>

          <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">
            Media Sosial
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Instagram</FieldLabel>
              <input
                value={form.socialInstagram}
                onChange={set('socialInstagram')}
                placeholder="@ironakopi"
                className={inputClass()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Facebook</FieldLabel>
              <input
                value={form.socialFacebook}
                onChange={set('socialFacebook')}
                placeholder="Irona Kopi"
                className={inputClass()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Twitter / X</FieldLabel>
              <input
                value={form.socialTwitter}
                onChange={set('socialTwitter')}
                placeholder="@ironakopi"
                className={inputClass()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>YouTube</FieldLabel>
              <input
                value={form.socialYoutube}
                onChange={set('socialYoutube')}
                placeholder="Irona Kopi"
                className={inputClass()}
              />
            </div>
          </div>

          <FieldError message={error} />
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
            disabled={saving || uploading}
            className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Data Toko'}
          </button>
        </div>
      </div>
    </div>
  );
}
