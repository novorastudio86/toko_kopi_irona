import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { setCustomerActive } from '../../services/customers';
import type { Customer } from '../../types/customer';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';

type Props = { customer: Customer; onClose: () => void; onSaved: (message: string) => void };

export default function CustomerStatusModal({ customer, onClose, onSaved }: Props) {
  const activate = !customer.isActive;
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  function handleNext() {
    if (!reason.trim()) {
      setErrors({ reason: 'Alasan wajib diisi.' });
      return;
    }
    setErrors({});
    setConfirming(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setCustomerActive(customer.id, activate, reason.trim());
      onSaved(`${customer.name} berhasil ${activate ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err: any) {
      setConfirming(false);
      setErrors({ form: err?.message ?? 'Gagal mengubah status.' });
    } finally {
      setSaving(false);
    }
  }

  const title = activate ? 'Aktifkan Member' : 'Nonaktifkan Member';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">{title}</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              {customer.name} · {customer.phoneNumber}
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

        <div className="flex flex-col gap-4 p-6">
          <p className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-xs leading-5 text-[#475569]">
            {activate
              ? `${customer.name} bisa login lagi di Web Customer, dan ${customer.pointsBalance} poinnya kembali bisa dipakai.`
              : `${customer.name} tidak bisa login di Web Customer. ${customer.pointsBalance} poinnya dibekukan (tidak hilang) dan kembali normal kalau diaktifkan lagi.`}
          </p>

          {confirming ? (
            <p className="text-sm leading-6 text-[#334155]">
              Yakin {activate ? 'mengaktifkan' : 'menonaktifkan'}{' '}
              <span className="font-bold">{customer.name}</span>?
              <span className="block text-xs text-[#64748b]">Alasan: "{reason.trim()}"</span>
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Alasan</FieldLabel>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  activate ? 'Contoh: Sudah konfirmasi via WA' : 'Contoh: Nomor tidak aktif'
                }
                className={inputClass(!!errors.reason)}
              />
              <FieldError message={errors.reason} />
            </div>
          )}

          {errors.form && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {errors.form}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
          <button
            onClick={confirming ? () => setConfirming(false) : onClose}
            disabled={saving}
            className="rounded border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            {confirming ? 'Kembali' : 'Batal'}
          </button>
          <button
            onClick={confirming ? handleSave : handleNext}
            disabled={saving}
            className={`rounded px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
              activate ? 'bg-[#0f172a] hover:bg-[#1e293b]' : 'bg-[#e11d48] hover:bg-[#be123c]'
            }`}
          >
            {saving
              ? 'Menyimpan...'
              : confirming
                ? `Ya, ${activate ? 'Aktifkan' : 'Nonaktifkan'}`
                : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>
  );
}
