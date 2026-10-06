import { useEffect, useState } from 'react';
import { Info, Plus, Trash2, X } from 'lucide-react';
import { savePointRules } from '../../services/rewards';
import { formatRupiah } from '../../utils/format';
import type { PointRules, PointTier } from '../../types/reward';
import { FieldError, FieldLabel, RupiahInput } from '../products/product-form/formUi';
import { calcPoints, describeBreakdown } from './pointCalc';

type Row = { key: number; amount: string; points: string };

type Props = { rules: PointRules; onClose: () => void; onSaved: () => void };

export default function PointRulesModal({ rules, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>(
    rules.tiers.length > 0
      ? rules.tiers.map((t, i) => ({
          key: i,
          amount: String(Math.round(t.minAmount)),
          points: String(t.points),
        }))
      : [{ key: 0, amount: '', points: '' }]
  );
  const [threshold, setThreshold] = useState(
    rules.roundingThreshold > 0 ? String(Math.round(rules.roundingThreshold)) : ''
  );
  const [simulate, setSimulate] = useState('50000');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const tiers: PointTier[] = rows
    .map((r) => ({ minAmount: Number(r.amount) || 0, points: Number(r.points) || 0 }))
    .filter((t) => t.minAmount > 0 && t.points > 0);
  const thresholdNum = Number(threshold) || 0;
  const smallest = tiers.length ? Math.min(...tiers.map((t) => t.minAmount)) : 0;

  const simAmount = Number(simulate) || 0;
  const sim = calcPoints(simAmount, tiers, thresholdNum);
  const examples = [smallest * 0.9, smallest * 1.3, smallest * 1.6, smallest * 5, smallest * 5.5]
    .map((v) => Math.round(v / 1000) * 1000)
    .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i);

  function update(key: number, field: 'amount' | 'points', value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    const filled = rows.filter((r) => r.amount || r.points);
    if (filled.some((r) => !(Number(r.amount) > 0) || !(Number(r.points) > 0))) {
      next.tiers = 'Setiap tingkat wajib diisi nominal dan poin lebih dari 0.';
    } else if (filled.length === 0) {
      next.tiers = 'Minimal harus ada 1 tingkat.';
    } else if (new Set(filled.map((r) => Number(r.amount))).size !== filled.length) {
      next.tiers = 'Nominal tiap tingkat tidak boleh sama.';
    }
    if (thresholdNum >= smallest && smallest > 0) {
      next.threshold = `Batas pembulatan harus di bawah ${formatRupiah(smallest)} (tingkat terkecil).`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await savePointRules(tiers, thresholdNum);
      onSaved();
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan aturan poin.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Aturan Dapat Poin</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Berlaku untuk transaksi member berikutnya. Poin dari transaksi lama tidak dihitung
              ulang.
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

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div className="flex flex-col gap-2">
            <FieldLabel required>Tingkat Poin</FieldLabel>
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs text-[#64748b]">Setiap belanja</span>
                <div className="flex-1">
                  <RupiahInput
                    value={r.amount}
                    onChange={(v) => update(r.key, 'amount', v)}
                    placeholder="10.000"
                  />
                </div>
                <span className="shrink-0 text-xs text-[#64748b]">dapat</span>
                <div className="flex w-32 items-center rounded-xl border border-[#cbd5e1] bg-white pr-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={r.points}
                    onChange={(e) =>
                      update(r.key, 'points', e.target.value.replace(/\D/g, '').slice(0, 5))
                    }
                    placeholder="1"
                    className="w-full bg-transparent px-3 py-[13px] text-sm font-semibold text-[#0f172a] outline-none"
                  />
                  <span className="text-xs text-[#64748b]">poin</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                  disabled={rows.length === 1}
                  aria-label="Hapus tingkat"
                  className="rounded-lg p-2 text-[#94a3b8] hover:bg-[#fff1f2] hover:text-[#e11d48] disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setRows((prev) => [...prev, { key: Date.now(), amount: '', points: '' }])
              }
              className="flex w-fit items-center gap-1 rounded-lg border border-dashed border-[#cbd5e1] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
            >
              <Plus className="size-3.5" />
              Tambah Tingkat
            </button>
            <FieldError message={errors.tiers} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Batas Pembulatan Sisa</FieldLabel>
            <div className="w-64">
              <RupiahInput
                value={threshold}
                onChange={setThreshold}
                hasError={!!errors.threshold}
                placeholder="5.000"
              />
            </div>
            <FieldError message={errors.threshold} />
            <p className="text-[11px] leading-4 text-[#94a3b8]">
              Sisa setelah dipecah ≥ batas ini dihitung 1 tingkat terkecil lagi; di bawahnya
              dibuang. Kosongkan untuk tanpa pembulatan.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">
              Simulasi
            </p>
            <div className="flex items-center gap-3">
              <div className="w-48">
                <RupiahInput value={simulate} onChange={setSimulate} placeholder="50.000" />
              </div>
              <span className="text-sm text-[#64748b]">→</span>
              <span className="font-mono text-lg font-bold text-[#0f172a]">{sim.points} poin</span>
            </div>
            <p className="text-xs text-[#475569]">
              {describeBreakdown(sim.breakdown, sim.leftover)}
            </p>

            {examples.length > 0 && (
              <table className="w-full border-collapse">
                <tbody>
                  {examples.map((amount) => {
                    const r = calcPoints(amount, tiers, thresholdNum);
                    return (
                      <tr key={amount} className="border-t border-[#e2e8f0]">
                        <td className="py-1.5 font-mono text-sm text-[#475569]">
                          {formatRupiah(amount)}
                        </td>
                        <td className="py-1.5 text-sm text-[#64748b]">
                          {describeBreakdown(r.breakdown, r.leftover)}
                        </td>
                        <td className="py-1.5 text-right font-mono text-sm font-bold text-[#0f172a]">
                          {r.points} poin
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-4 text-[#94a3b8]">
            <Info className="mt-px size-3.5 shrink-0" />
            Dasar hitung: nilai produk setelah diskon, tanpa ongkir & biaya layanan. Berlaku online
            & offline, hanya untuk member aktif.
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
            {saving ? 'Menyimpan...' : 'Simpan Aturan'}
          </button>
        </div>
      </div>
    </div>
  );
}
