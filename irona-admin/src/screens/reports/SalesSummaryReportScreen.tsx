import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Download, Info, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { fetchSalesSummary } from '../../services/salesReports';
import type { SalesSummary } from '../../types/salesReport';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import { rpDetail } from './salesReportFormat';

/** Ikon info yang membuka popup penjelasan rumus */
function InfoPopup({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Cara hitung"
        className="rounded-full p-0.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
      >
        <Info className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-[#334155] bg-[#0f172a] p-3 text-[11px] leading-4 text-[#e2e8f0] shadow-xl">
          {text}
        </div>
      )}
    </div>
  );
}

type Step = { label: string; value: number; info: string; op?: string };

export default function SalesSummaryReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [data, setData] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSalesSummary({ start: range.start, end: range.end })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat ringkasan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const potongan = data ? data.discount + data.rewardRedeem : 0;
  const steps: Step[] = data
    ? [
        {
          label: 'Pendapatan Total',
          value: data.grossRevenue,
          info: 'Total nilai produk yang tercatat sistem sebelum potongan apa pun (belum tentu uang yang diterima). Tidak termasuk transaksi yang dibatalkan.',
        },
        {
          label: 'Biaya Potongan',
          value: potongan,
          op: '−',
          info: 'Diskon & voucher (Promosi › Diskon) + penukaran poin reward. Penukaran reward baru tercatat setelah Kasir App tersedia.',
        },
        {
          label: 'Total Penjualan',
          value: data.totalSales,
          op: '=',
          info: 'Jumlah yang dibayar pelanggan untuk produk: Pendapatan Total − Biaya Potongan. Ongkir & biaya layanan pesanan online tidak termasuk (dilaporkan terpisah).',
        },
        {
          label: 'Penjualan Bersih',
          value: data.netSales,
          op: '− refund',
          info: 'Total Penjualan − Refund (Penjualan › Penyesuaian Transaksi) dari transaksi di periode ini.',
        },
        {
          label: 'Total Laba Kotor',
          value: data.grossProfit,
          op: '− MDR',
          info: 'Penjualan Bersih − biaya gateway pesanan online (MDR 0,7% + PPN 11% dari MDR), porsi untuk nilai produk. Transaksi kasir (tunai/QRIS cetak) tanpa potongan.',
        },
      ]
    : [];

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      const rows: [string, number, boolean?][] = [
        ['Pendapatan Total', data.grossRevenue],
        ['Biaya Potongan (diskon & voucher)', data.discount],
        ['Biaya Potongan (penukaran poin)', data.rewardRedeem],
        ['Total Penjualan', data.totalSales],
        ['Refund', data.refund],
        ['Penjualan Bersih', data.netSales],
        ['Biaya Gateway (porsi produk)', data.gatewayFeeProducts],
        ['Total Laba Kotor', data.grossProfit],
        ['Jumlah Transaksi', data.transactions, true],
        ['Produk Terjual', data.products, true],
        ['Ongkir Terkumpul (online)', data.deliveryFee],
        ['Biaya Layanan Terkumpul (online)', data.serviceFee],
      ];
      await exportToExcel<[string, number, boolean?]>({
        fileName: `Ringkasan Penjualan ${range.start} sd ${range.end}`,
        title: 'Ringkasan Penjualan',
        subtitle: `Periode ${rangeText(range)}`,
        sheets: [
          {
            name: 'Ringkasan',
            rows,
            columns: [
              { header: 'Komponen', width: 38, value: (r) => r[0] },
              {
                header: 'Nilai (Rp)',
                width: 20,
                type: 'currency',
                value: (r) => (r[2] ? null : r[1]),
              },
              { header: 'Jumlah', width: 12, type: 'number', value: (r) => (r[2] ? r[1] : null) },
            ],
          },
        ],
      });
    } catch (err: any) {
      setError(err?.message ?? 'Gagal mengekspor.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        breadcrumb={['Laporan', 'Laporan Penjualan', 'Ringkasan Penjualan']}
        title="Ringkasan Penjualan"
        info="Alur perhitungan penjualan dari pendapatan kotor sampai laba kotor. Klik ikon (i) di tiap kartu untuk cara hitungnya."
        badge={rangeText(range)}
        action={
          <button
            onClick={handleExport}
            disabled={exporting || loading || !data}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-50"
          >
            <Download className="size-4" />
            {exporting ? 'Mengekspor...' : 'Ekspor Laporan'}
          </button>
        }
      />

      <ReportDateFilter
        preset={preset}
        range={range}
        today={today}
        onChange={(p, r) => {
          setPreset(p);
          setRange(r);
        }}
      />

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Alur: Pendapatan → Laba Kotor */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-[25px]">
        <h3 className="text-base font-bold text-[#0f172a]">Alur Penjualan</h3>
        <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[repeat(9,auto)]">
          {loading && (
            <p className="py-8 text-center text-xs text-[#94a3b8] md:col-span-9">Memuat...</p>
          )}
          {!loading &&
            steps.map((s, i) => (
              <div key={s.label} className="contents">
                {i > 0 && (
                  <div className="hidden items-center justify-center md:flex">
                    <ChevronRight className="size-4 text-[#cbd5e1]" />
                  </div>
                )}
                <div
                  className={`flex min-w-[160px] flex-col gap-1 rounded-xl border p-4 ${
                    i === steps.length - 1
                      ? 'border-[#0f172a] bg-[#0f172a] text-white'
                      : 'border-[#e2e8f0] bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-[0.5px] ${i === steps.length - 1 ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}
                    >
                      {s.label}
                    </span>
                    <InfoPopup text={s.info} />
                  </div>
                  <span className="font-mono text-lg font-bold">
                    {s.op === '−' ? '−' : ''}
                    {formatRupiah(s.value)}
                  </span>
                  {s.op && s.op !== '−' && s.op !== '=' && (
                    <span
                      className={`text-[10px] ${i === steps.length - 1 ? 'text-[#cbd5e1]' : 'text-[#94a3b8]'}`}
                    >
                      {s.op === '− refund'
                        ? `setelah refund ${formatRupiah(data?.refund ?? 0)}`
                        : `setelah biaya gateway ${rpDetail(data?.gatewayFeeProducts ?? 0)}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </section>

      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Jumlah Transaksi"
            value={data.transactions}
            format="number"
            hint={`Offline ${data.transactionsOffline} · Online ${data.transactionsOnline}`}
          />
          <StatCard label="Refund" value={data.refund} />
          <StatCard
            label="Ongkir Terkumpul"
            value={data.deliveryFee}
            hint="Pesanan online, di luar Total Penjualan"
          />
          <StatCard
            label="Biaya Layanan Terkumpul"
            value={data.serviceFee}
            hint="Pesanan online, di luar Total Penjualan"
          />
        </div>
      )}
    </div>
  );
}
