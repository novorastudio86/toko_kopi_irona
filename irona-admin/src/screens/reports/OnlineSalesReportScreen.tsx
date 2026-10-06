import { useEffect, useState } from 'react';
import { Download, Eye, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { SearchToolbar } from '../../components/SearchToolbar';
import { TablePagination } from '../../components/TablePagination';
import { fetchAllSalesRows, fetchSalesRows, fetchSalesSummary } from '../../services/salesReports';
import type { BalanceStatus } from '../../types/finance';
import type { SalesFilters, SalesRow, SalesSummary } from '../../types/salesReport';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import { BALANCE_STATUS_CLASSES, BALANCE_STATUS_LABELS } from '../finance/cashFlowFormat';
import ReportDateFilter from './ReportDateFilter';
import TransactionDetailModal from './TransactionDetailModal';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import { formatDateTime } from './salesReportFormat';

export default function OnlineSalesReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [status, setStatus] = useState<'' | BalanceStatus>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  const [rows, setRows] = useState<SalesRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detail, setDetail] = useState<SalesRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters: SalesFilters = {
    start: range.start,
    end: range.end,
    channel: 'online',
    search: debounced || null,
    balanceStatus: status || null,
  };
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    const f: SalesFilters = JSON.parse(filterKey);
    setLoading(true);
    setError(null);
    Promise.all([fetchSalesRows(f, page, pageSize), fetchSalesSummary(f)])
      .then(([list, sum]) => {
        if (cancelled) return;
        setRows(list.rows);
        setTotal(list.total);
        setSummary(sum);
      })
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat penjualan online.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filterKey, page, pageSize]);

  async function handleExport() {
    setExporting(true);
    try {
      const all = await fetchAllSalesRows(filters);
      await exportToExcel<SalesRow>({
        fileName: `Laporan Penjualan Online ${range.start} sd ${range.end}`,
        title: 'Laporan Penjualan Online',
        subtitle: `Periode ${rangeText(range)}${status ? ` · Status ${BALANCE_STATUS_LABELS[status]}` : ''}`,
        summary: summary
          ? [
              ['Total Order Online', summary.transactions],
              ['Total Nilai Penjualan Online', summary.totalSales],
              ['Total Ongkir Terkumpul', summary.deliveryFee],
              ['Total Biaya Layanan Terkumpul', summary.serviceFee],
              ['Total Penyesuaian Harga Online', summary.priceAdjustment],
            ]
          : undefined,
        sheets: [
          {
            name: 'Penjualan Online',
            rows: all,
            columns: [
              { header: 'No Transaksi', width: 18, value: (r) => r.transactionNumber },
              { header: 'Tanggal', width: 18, value: (r) => formatDateTime(r.orderTime) },
              { header: 'Pelanggan', width: 18, value: (r) => r.customerName },
              { header: 'Jarak (km)', width: 10, type: 'number', value: (r) => r.distanceKm },
              { header: 'Nilai Produk', width: 15, type: 'currency', value: (r) => r.totalAmount },
              { header: 'Ongkir', width: 12, type: 'currency', value: (r) => r.deliveryFee },
              { header: 'Biaya Layanan', width: 13, type: 'currency', value: (r) => r.serviceFee },
              { header: 'Total Bayar', width: 15, type: 'currency', value: (r) => r.totalPaid },
              { header: 'Driver', width: 16, value: (r) => r.driverName },
              { header: 'Alamat', width: 32, value: (r) => r.address },
              {
                header: 'Status Saldo',
                width: 16,
                value: (r) => (r.balanceStatus ? BALANCE_STATUS_LABELS[r.balanceStatus] : ''),
              },
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

  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Laporan Penjualan Online"
        info="Pesanan dari Web Customer. Nilai Produk = total produk setelah diskon; ongkir & biaya layanan dicatat terpisah. Total Bayar = yang dibayar pelanggan lewat Midtrans."
        badge={rangeText(range)}
        action={
          <button
            onClick={handleExport}
            disabled={exporting || loading}
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
          setPage(1);
        }}
      >
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | BalanceStatus);
            setPage(1);
          }}
          className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs outline-none"
          aria-label="Status saldo"
        >
          <option value="">Semua Status Saldo</option>
          <option value="tertahan">Tertahan</option>
          <option value="tersedia">Tersedia</option>
          <option value="dicairkan">Sudah Dicairkan</option>
          <option value="direfund">Direfund</option>
        </select>
      </ReportDateFilter>

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Total Order Online" value={summary.transactions} format="number" />
          <StatCard label="Nilai Penjualan Online" value={summary.totalSales} hint="Nilai produk" />
          <StatCard label="Ongkir Terkumpul" value={summary.deliveryFee} />
          <StatCard label="Biaya Layanan Terkumpul" value={summary.serviceFee} />
          <StatCard
            label="Penyesuaian Harga Online"
            value={summary.priceAdjustment}
            hint="Dari markup produk di Order Online"
          />
        </div>
      )}

      <SearchToolbar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Cari no transaksi / nama pelanggan..."
      />

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>No Transaksi</th>
                <th className={`${thClass} text-left`}>Tanggal</th>
                <th className={`${thClass} text-left`}>Pelanggan</th>
                <th className={`${thClass} text-right`}>Jarak</th>
                <th className={`${thClass} text-right`}>Nilai Produk</th>
                <th className={`${thClass} text-right`}>Ongkir</th>
                <th className={`${thClass} text-right`}>Biaya Layanan</th>
                <th className={`${thClass} text-right`}>Total Bayar</th>
                <th className={`${thClass} text-left`}>Driver</th>
                <th className={`${thClass} text-left`}>Status Saldo</th>
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat pesanan online...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-xs text-[#94a3b8]">
                    Tidak ada pesanan online di periode ini.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[#f1f5f9] first:border-t-0 text-xs text-[#475569]"
                  >
                    <td className="whitespace-nowrap py-3 pl-6 pr-3 font-mono text-[#0f172a]">
                      {r.transactionNumber}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">{formatDateTime(r.orderTime)}</td>
                    <td className="py-3 pr-3">{r.customerName || '—'}</td>
                    <td className="whitespace-nowrap py-3 pr-3 text-right font-mono">
                      {r.distanceKm !== null ? `${r.distanceKm.toLocaleString('id-ID')} km` : '—'}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {formatRupiah(r.totalAmount)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {formatRupiah(r.deliveryFee)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">{formatRupiah(r.serviceFee)}</td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold text-[#0f172a]">
                      {formatRupiah(r.totalPaid)}
                    </td>
                    <td className="py-3 pr-3">{r.driverName ?? '—'}</td>
                    <td className="py-3 pr-3">
                      {r.balanceStatus ? (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${BALANCE_STATUS_CLASSES[r.balanceStatus]}`}
                        >
                          {BALANCE_STATUS_LABELS[r.balanceStatus]}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 pr-6 text-right">
                      <button
                        onClick={() => setDetail(r)}
                        aria-label="Detail pesanan"
                        className="rounded-lg p-1.5 text-[#475569] hover:bg-[#f1f5f9]"
                      >
                        <Eye className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          itemLabel="pesanan"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {detail && <TransactionDetailModal row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
