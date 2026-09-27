import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatRupiahDetail } from '../../utils/format';
import { RupiahInput } from '../products/product-form/formUi';

type Props = { mdrPercent: number; ppnPercent: number; onClose: () => void };

/** Contoh perhitungan potongan payment gateway (ilustratif) */
export default function GatewaySimulationModal({ mdrPercent, ppnPercent, onClose }: Props) {
  const [amount, setAmount] = useState('50000');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const value = Number(amount) || 0;
  const mdr = (value * mdrPercent) / 100;
  const ppn = (mdr * ppnPercent) / 100;
  const cut = mdr + ppn;

  const rows = [
    { label: 'Pembayaran customer', value, bold: false },
    { label: `MDR (${mdrPercent}% × pembayaran)`, value: -mdr, bold: false },
    { label: `PPN ${ppnPercent}% dari MDR`, value: -ppn, bold: false },
    { label: 'Total potongan gateway', value: -cut, bold: true },
    { label: 'Diterima toko', value: value - cut, bold: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              Simulasi Payment Gateway
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Contoh ilustratif, bukan data transaksi.
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
          <div className="w-56">
            <RupiahInput value={amount} onChange={setAmount} placeholder="50.000" />
          </div>
          <div className="flex flex-col rounded-xl border border-[#e2e8f0]">
            {rows.map((r) => (
              <div
                key={r.label}
                className={`flex items-center justify-between border-t border-[#f1f5f9] px-4 py-2.5 text-xs first:border-t-0 ${
                  r.bold ? 'bg-[#f8fafc] font-bold text-[#0f172a]' : 'text-[#475569]'
                }`}
              >
                <span>{r.label}</span>
                <span className="font-mono">
                  {r.value < 0 ? '− ' : ''}
                  {formatRupiahDetail(Math.abs(r.value))}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-4 text-[#94a3b8]">
            Rincian settlement aktual per transaksi ada di Laporan › Cash Flow › Saldo Online.
          </p>
        </div>
      </div>
    </div>
  );
}
