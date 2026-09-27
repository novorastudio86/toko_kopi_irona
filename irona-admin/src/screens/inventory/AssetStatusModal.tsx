import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { updateAssetStatus } from '../../services/assets';
import type { Asset, AssetStatus } from '../../types/asset';
import { AssetStatusBadge, STATUS_LABELS } from './AssetStatusBadge';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';

const OPTIONS: AssetStatus[] = ['aktif', 'rusak', 'dijual', 'hilang'];

type Props = { asset: Asset; onClose: () => void; onSaved: (name: string, status: AssetStatus) => void };

export default function AssetStatusModal({ asset, onClose, onSaved }: Props) {
  const [status, setStatus] = useState<AssetStatus>(asset.status);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (status === asset.status) next.status = 'Pilih status yang berbeda dari sekarang.';
    if (!note.trim()) next.note = 'Catatan alasan wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await updateAssetStatus(asset.id, status, note.trim());
      onSaved(asset.name, status);
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal mengubah status aset.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Ubah Status Aset</h2>
            <p className="text-xs leading-4 text-[#64748b]">{asset.name}</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            Status sekarang:
            <AssetStatusBadge status={asset.status} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Status Baru</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  disabled={option === asset.status}
                  className={`flex items-center justify-center rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                    status === option
                      ? 'border-2 border-[#0f172a] bg-[#f8fafc] text-[#0f172a]'
                      : 'border border-[#cbd5e1] bg-white text-[#475569] hover:border-[#94a3b8] disabled:opacity-50'
                  }`}
                >
                  {STATUS_LABELS[option]}
                </button>
              ))}
            </div>
            <FieldError message={errors.status} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Catatan Alasan</FieldLabel>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: AC bocor, perlu servis"
              className={inputClass(!!errors.note)}
            />
            <FieldError message={errors.note} />
            <p className="text-[11px] leading-4 text-[#94a3b8]">
              Catatan ini tersimpan di riwayat aset agar perubahan bisa ditelusuri.
            </p>
          </div>

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
            {saving ? 'Menyimpan...' : 'Simpan Status'}
          </button>
        </div>
      </div>
    </div>
  );
}