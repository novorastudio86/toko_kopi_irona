import { Info } from 'lucide-react';
import { formatPercent, formatRupiah } from '../../../utils/format';
import { FieldError, FieldLabel, PercentChips, RupiahInput } from './formUi';

type Props = {
  totalCost: number;
  desiredPct: number | null;
  onDesiredPctChange: (value: number | null) => void;
  sellingPrice: string;
  onSellingPriceChange: (digits: string) => void;
  errors: { desiredPct?: string; sellingPrice?: string };
};

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  const color = tone === 'positive' ? 'text-[#059669]' : tone === 'negative' ? 'text-[#e11d48]' : 'text-[#0f172a]';
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-white p-4">
      <span className="text-xs font-medium text-[#64748b]">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

export function PricingStep({
  totalCost,
  desiredPct,
  onDesiredPctChange,
  sellingPrice,
  onSellingPriceChange,
  errors,
}: Props) {
  const recommended = desiredPct && desiredPct > 0 ? totalCost / (desiredPct / 100) : null;
  const price = Number(sellingPrice) || 0;
  const hasPrice = price > 0;
  const marginRp = price - totalCost;

  return (
    <div className="flex flex-col gap-5">
      {/* Total cost */}
      <div className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.5px] text-[#0f172a]">
            Total Cost
            <span className="rounded border border-[#e2e8f0] bg-white px-1.5 text-[11px] font-semibold normal-case tracking-normal text-[#475569]">
              Otomatis
            </span>
          </p>
          <p className="text-xs text-[#64748b]">Total biaya produksi per porsi dari langkah sebelumnya</p>
        </div>
        <span className="text-2xl font-extrabold text-[#0f172a]">{formatRupiah(totalCost)}</span>
      </div>

      {/* Desired cost */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-[#0f172a]">Persentase Desired Cost</p>
          <p className="text-xs text-[#64748b]">Target beban modal pokok terhadap harga jual produk</p>
        </div>
        <PercentChips options={[10, 20, 25, 30]} value={desiredPct} onChange={onDesiredPctChange} />
        <FieldError message={errors.desiredPct} />
      </div>

      {/* Rekomendasi */}
      <div className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold uppercase tracking-[0.5px] text-[#0f172a]">Harga Jual Rekomendasi</p>
          <p className="text-xs text-[#64748b]">Total Cost ÷ Desired Cost</p>
        </div>
        <span className="text-2xl font-extrabold text-[#0f172a]">
          {recommended !== null ? formatRupiah(recommended) : '-'}
        </span>
      </div>

      {/* Harga ditetapkan */}
      <div className="flex flex-col gap-2">
        <FieldLabel required>Harga Jual Ditetapkan</FieldLabel>
        <RupiahInput
          value={sellingPrice}
          onChange={onSellingPriceChange}
          hasError={!!errors.sellingPrice}
          placeholder="Contoh: 18.000"
        />
        <FieldError message={errors.sellingPrice} />
      </div>

      {/* Analisis */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
        <p className="text-sm font-bold uppercase tracking-[0.5px] text-[#0f172a]">Analisis Margin &amp; Beban Pokok</p>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Cost Ratio (%)" value={hasPrice ? formatPercent((totalCost / price) * 100) : '-'} />
          <MetricCard
            label="Margin (%)"
            value={hasPrice ? formatPercent((marginRp / price) * 100) : '-'}
            tone={hasPrice ? (marginRp >= 0 ? 'positive' : 'negative') : undefined}
          />
          <MetricCard
            label="Margin (Rp)"
            value={hasPrice ? formatRupiah(marginRp) : '-'}
            tone={hasPrice && marginRp < 0 ? 'negative' : undefined}
          />
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-[#e2e8f0] bg-white p-4 text-xs leading-5 text-[#475569]">
        <Info className="mt-0.5 size-4 shrink-0" />
        Harga ini yang dipakai di Kasir dan Web Customer, belum termasuk service charge/PB1 outlet.
      </p>
    </div>
  );
}