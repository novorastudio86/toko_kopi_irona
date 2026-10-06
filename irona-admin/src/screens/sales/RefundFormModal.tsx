import { useEffect, useState } from 'react';
import { Info, Search, X } from 'lucide-react';
import { createRefund, findTransaction } from '../../services/adjustments';
import type { ProductStatus, RefundableTransaction } from '../../types/adjustment';
import { formatRupiah } from '../../utils/format';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';
import { ORDER_TYPE_LABELS, formatDateTime } from './adjustmentFormat';

type Props = {
  onClose: () => void;
  onSaved: (transactionNumber: string) => void;
};

const STATUS_LABELS: Record<string, string> = {
  refund_penuh: 'sudah direfund',
  refund_sebagian: 'sudah direfund sebagian',
  dibatalkan: 'dibatalkan',
};

export default function RefundFormModal({ onClose, onSaved }: Props) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [tx, setTx] = useState<RefundableTransaction | null>(null);
  const [productStatus, setProductStatus] = useState<ProductStatus | ''>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function handleSearch() {
    if (!query.trim()) {
      setErrors({ query: 'Masukkan No Transaksi atau ID Pesanan.' });
      return;
    }
    setSearching(true);
    setErrors({});
    setTx(null);
    try {
      const found = await findTransaction(query);
      if (!found) setErrors({ query: `Transaksi "${query.trim()}" tidak ditemukan.` });
      else if (found.status !== 'selesai')
        setErrors({
          query: `Transaksi ${found.transactionNumber} ${STATUS_LABELS[found.status] ?? found.status}, tidak bisa direfund.`,
        });
      else setTx(found);
    } catch (err: any) {
      setErrors({ query: err?.message ?? 'Gagal mencari transaksi.' });
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!tx) next.query = 'Cari transaksi yang akan direfund.';
    if (!productStatus) next.productStatus = 'Pilih status produk.';
    if (!reason.trim()) next.reason = 'Alasan refund wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !tx || !productStatus) return;

    const ok = window.confirm(
      `Refund ${tx.transactionNumber} sebesar ${formatRupiah(tx.totalAmount)}? Catatan refund tidak bisa diubah atau dihapus.`
    );
    if (!ok) return;

    setSaving(true);
    try {
      await createRefund(tx.id, productStatus, reason.trim());
      onSaved(tx.transactionNumber);
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal mencatat refund.' });
    } finally {
      setSaving(false);
    }
  }

  const statusOptions: { value: ProductStatus; title: string; desc: string }[] = [
    {
      value: 'belum_dibuat',
      title: 'Salah Order (Belum Dibuat)',
      desc: 'Produk belum dibuat — stok bahan dikembalikan.',
    },
    {
      value: 'sudah_dibuat',
      title: 'Sudah Dibuat',
      desc: 'Bahan sudah terpakai — stok tidak dikembalikan.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Refund Transaksi</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Refund selalu 1 transaksi utuh sebesar total transaksi.
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
            <FieldLabel required>No Transaksi / ID Pesanan</FieldLabel>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Contoh: TRX-260927-0042"
                className={`${inputClass(!!errors.query)} font-mono`}
                autoFocus
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-4 text-xs font-semibold text-[#0f172a] hover:bg-[#f8fafc] disabled:opacity-60"
              >
                <Search className="size-4" />
                {searching ? 'Mencari...' : 'Cari'}
              </button>
            </div>
            <FieldError message={errors.query} />
            <p className="text-[11px] text-[#94a3b8]">
              Channel (offline/online) terdeteksi otomatis dari transaksinya.
            </p>
          </div>

          {tx && (
            <div className="flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold text-[#0f172a]">
                    {tx.transactionNumber}
                  </p>
                  <p className="text-[11px] text-[#64748b]">
                    {formatDateTime(tx.transactionDate)} · {ORDER_TYPE_LABELS[tx.orderType]} ·{' '}
                    {tx.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    tx.channel === 'online'
                      ? 'bg-[#eff6ff] text-[#1d4ed8]'
                      : 'bg-[#e2e8f0] text-[#334155]'
                  }`}
                >
                  {tx.channel === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>

              <p className="text-xs text-[#334155]">
                <span className="text-[#64748b]">Pelanggan: </span>
                <span className="font-semibold">{tx.customerName || '—'}</span>
                {tx.isMember && (
                  <span className="ml-1.5 rounded bg-[#0f172a] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Member
                  </span>
                )}
              </p>

              <div className="flex flex-col gap-1 border-t border-[#e2e8f0] pt-3">
                {tx.items.length === 0 && (
                  <p className="text-[11px] text-[#94a3b8]">Tidak ada rincian produk.</p>
                )}
                {tx.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-[#334155]">
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                    <span className="font-mono">{formatRupiah(item.lineTotal)}</span>
                  </div>
                ))}
                {tx.discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-[#64748b]">
                    <span>Diskon</span>
                    <span className="font-mono">-{formatRupiah(tx.discountAmount)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold text-[#0f172a]">
                  <span>Nominal Refund</span>
                  <span className="font-mono">{formatRupiah(tx.totalAmount)}</span>
                </div>
              </div>

              {tx.isMember && (
                <p className="flex items-start gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] leading-4 text-[#475569]">
                  <Info className="mt-px size-3.5 shrink-0" />
                  <span>
                    Total Belanja & Poin akan disesuaikan otomatis
                    {tx.pointsEarned > 0 ? ` (poin ditarik ${tx.pointsEarned}).` : '.'}
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Status Produk</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProductStatus(opt.value)}
                  className={`rounded-xl border px-3 py-2.5 text-left ${
                    productStatus === opt.value
                      ? 'border-[#0f172a] bg-[#f8fafc] ring-1 ring-[#0f172a]'
                      : errors.productStatus
                        ? 'border-[#f43f5e]'
                        : 'border-[#cbd5e1] hover:bg-[#f8fafc]'
                  }`}
                >
                  <p className="text-xs font-bold text-[#0f172a]">{opt.title}</p>
                  <p className="pt-0.5 text-[11px] leading-4 text-[#64748b]">{opt.desc}</p>
                </button>
              ))}
            </div>
            <FieldError message={errors.productStatus} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Alasan</FieldLabel>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Contoh: Pelanggan salah pilih menu, minta ganti"
              className={`${inputClass(!!errors.reason)} resize-none`}
            />
            <FieldError message={errors.reason} />
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
            disabled={saving || !tx}
            className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}
