import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { setProductActive } from '../../services/products';
import { FieldError, FieldLabel, inputClass } from './product-form/formUi';

type Props = {
  product: { id: string; name: string; isActive: boolean };
  onClose: () => void;
  onSaved: () => void;
};

/** Pop up ubah status produk: nonaktifkan wajib alasan (tercatat di riwayat), aktifkan cukup konfirmasi */
export default function ProductStatusModal({ product, onClose, onSaved }: Props) {
  const activate = !product.isActive;
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activate && !reason.trim()) {
      setError('Alasan wajib diisi.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await setProductActive(product.id, activate, reason);
      onSaved();
    } catch (err: any) {
      setFormError(err?.message ?? `Gagal ${activate ? 'mengaktifkan' : 'menonaktifkan'} produk.`);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={handleSave}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              {activate ? 'Aktifkan Produk' : 'Nonaktifkan Produk'}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">{product.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {activate ? (
            <p className="text-sm leading-6 text-[#334155]">
              Yakin mengaktifkan <span className="font-bold">{product.name}</span>?
              <span className="block text-xs text-[#64748b]">
                Produk akan kembali bisa dipesan di kasir maupun web customer.
              </span>
            </p>
          ) : (
            <>
              <p className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-xs leading-5 text-[#475569]">
                Produk tidak akan bisa dipesan di kasir maupun web customer. Alasannya tercatat di riwayat perubahan.
              </p>
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Alasan</FieldLabel>
                <input
                  type="text"
                  autoFocus
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setError(undefined);
                  }}
                  placeholder="Contoh: Baileys habis dari supplier"
                  className={inputClass(!!error)}
                />
                <FieldError message={error} />
              </div>
            </>
          )}
          {formError && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {formError}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            {activate ? 'Tidak' : 'Batal'}
          </button>
          <button
            type="submit"
            autoFocus={activate}
            disabled={saving}
            className={`rounded px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
              activate ? 'bg-[#0f172a] hover:bg-[#1e293b]' : 'bg-[#e11d48] hover:bg-[#be123c]'
            }`}
          >
            {saving ? 'Menyimpan...' : activate ? 'Ya, Aktifkan' : 'Nonaktifkan'}
          </button>
        </div>
      </form>
    </div>
  );
}
