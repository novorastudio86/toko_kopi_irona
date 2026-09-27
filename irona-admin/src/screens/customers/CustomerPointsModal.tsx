import { useEffect, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { adjustCustomerPoints } from '../../services/customers';
import type { Customer } from '../../types/customer';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';

type Props = { customer: Customer; onClose: () => void; onSaved: (message: string) => void };

export default function CustomerPointsModal({ customer, onClose, onSaved }: Props) {
  const [direction, setDirection] = useState<'tambah' | 'kurang'>('tambah');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const points = Number(amount) || 0;
  const delta = direction === 'tambah' ? points : -points;
  const newBalance = customer.pointsBalance + delta;

  function handleNext() {
    const next: Record<string, string | undefined> = {};
    if (!(points > 0)) next.amount = 'Jumlah poin wajib diisi.';
    else if (newBalance < 0)
      next.amount = `Saldo poin hanya ${customer.pointsBalance}, tidak bisa dikurangi ${points}.`;
    if (!reason.trim()) next.reason = 'Alasan wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length === 0) setConfirming(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const balance = await adjustCustomerPoints(customer.id, delta, reason.trim());
      onSaved(
        `Poin ${customer.name} ${delta > 0 ? 'ditambah' : 'dikurangi'} ${points}. Saldo sekarang ${balance} poin.`
      );
    } catch (err: any) {
      setConfirming(false);
      setErrors({ form: err?.message ?? 'Gagal menyesuaikan poin.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Sesuaikan Poin</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              {customer.name} · saldo sekarang{' '}
              <span className="font-bold text-[#0f172a]">{customer.pointsBalance} poin</span>
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

        {confirming ? (
          <div className="flex flex-col gap-3 p-6">
            <p className="text-sm leading-6 text-[#334155]">
              {direction === 'tambah' ? 'Tambah' : 'Kurangi'}{' '}
              <span className="font-bold">{points} poin</span> untuk{' '}
              <span className="font-bold">{customer.name}</span>?
            </p>
            <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 font-mono text-sm">
              <span className="text-[#64748b]">{customer.pointsBalance}</span>
              <span className={delta > 0 ? 'text-[#059669]' : 'text-[#e11d48]'}>
                {delta > 0 ? '+' : '−'} {points}
              </span>
              <span className="font-bold text-[#0f172a]">= {newBalance} poin</span>
            </div>
            <p className="text-xs text-[#64748b]">Alasan: "{reason.trim()}"</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-2">
              {(['tambah', 'kurang'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold ${
                    direction === d
                      ? 'border-[#0f172a] bg-[#0f172a] text-white'
                      : 'border-[#cbd5e1] bg-white text-[#334155]'
                  }`}
                >
                  {d === 'tambah' ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
                  {d === 'tambah' ? 'Tambah Poin' : 'Kurangi Poin'}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Jumlah Poin</FieldLabel>
              <input
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className={inputClass(!!errors.amount)}
              />
              <FieldError message={errors.amount} />
              {points > 0 && (
                <p
                  className={`text-[11px] ${newBalance < 0 ? 'text-[#e11d48]' : 'text-[#64748b]'}`}
                >
                  Saldo setelahnya: <span className="font-bold">{newBalance} poin</span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Alasan</FieldLabel>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Kompensasi pesanan terlambat"
                className={inputClass(!!errors.reason)}
              />
              <FieldError message={errors.reason} />
            </div>

            {errors.form && (
              <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
                {errors.form}
              </p>
            )}
          </div>
        )}

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
            className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : confirming ? 'Ya, Simpan' : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>
  );
}
