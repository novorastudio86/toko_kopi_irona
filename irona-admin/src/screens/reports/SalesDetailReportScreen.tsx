import { useEffect, useRef, useState } from 'react';
import { Columns3, Download, Eye, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { SearchToolbar } from '../../components/SearchToolbar';
import { TablePagination } from '../../components/TablePagination';
import { fetchAllSalesRows, fetchSalesRows, fetchSalesSummary } from '../../services/salesReports';
import type { SalesFilters, SalesRow, SalesSummary } from '../../types/salesReport';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { exportToExcel, type ExcelColumn } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import { BALANCE_STATUS_CLASSES, BALANCE_STATUS_LABELS } from '../finance/cashFlowFormat';
import ReportDateFilter from './ReportDateFilter';
import TransactionDetailModal from './TransactionDetailModal';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import {
  CHANNEL_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_LABELS,
  formatDateTime,
  rpDetail,
} from './salesReportFormat';

type ColumnKey =
  | 'number'
  | 'orderTime'
  | 'payTime'
  | 'channel'
  | 'orderType'
  | 'customer'
  | 'total'
  | 'discount'
  | 'deliveryFee'
  | 'totalPaid'
  | 'refund'
  | 'gateway'
  | 'payment'
  | 'balance'
  | 'cashier';

type Column = {
  key: ColumnKey;
  label: string;
  defaultOn: boolean;
  align?: 'right';
  render: (r: SalesRow) => React.ReactNode;
  excel: ExcelColumn<SalesRow>;
};

const COLUMNS: Column[] = [
  {
    key: 'number',
    label: 'No Transaksi',
    defaultOn: true,
    render: (r) => <span className="font-mono text-[#0f172a]">{r.transactionNumber}</span>,
    excel: { header: 'No Transaksi', width: 18, value: (r) => r.transactionNumber },
  },
  {
    key: 'orderTime',
    label: 'Waktu Order',
    defaultOn: true,
    render: (r) => formatDateTime(r.orderTime),
    excel: { header: 'Waktu Order', width: 18, value: (r) => formatDateTime(r.orderTime) },
  },
  {
    key: 'payTime',
    label: 'Waktu Bayar',
    defaultOn: true,
    render: (r) => formatDateTime(r.payTime),
    excel: { header: 'Waktu Bayar', width: 18, value: (r) => formatDateTime(r.payTime) },
  },
  {
    key: 'channel',
    label: 'Channel',
    defaultOn: true,
    render: (r) => (
      <span
        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${r.channel === 'online' ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'bg-[#f1f5f9] text-[#334155]'}`}
      >
        {CHANNEL_LABELS[r.channel]}
      </span>
    ),
    excel: { header: 'Channel', width: 10, value: (r) => CHANNEL_LABELS[r.channel] },
  },
  {
    key: 'orderType',
    label: 'Jenis Order',
    defaultOn: true,
    render: (r) => ORDER_TYPE_LABELS[r.orderType],
    excel: { header: 'Jenis Order', width: 16, value: (r) => ORDER_TYPE_LABELS[r.orderType] },
  },
  {
    key: 'customer',
    label: 'Pelanggan',
    defaultOn: false,
    render: (r) => r.customerName || '—',
    excel: { header: 'Pelanggan', width: 18, value: (r) => r.customerName },
  },
  {
    key: 'total',
    label: 'Total Penjualan',
    defaultOn: true,
    align: 'right',
    render: (r) => <span className="font-mono font-semibold">{formatRupiah(r.totalAmount)}</span>,
    excel: { header: 'Total Penjualan', width: 16, type: 'currency', value: (r) => r.totalAmount },
  },
  {
    key: 'discount',
    label: 'Diskon',
    defaultOn: false,
    align: 'right',
    render: (r) =>
      r.discount ? <span className="font-mono">{formatRupiah(r.discount)}</span> : '—',
    excel: { header: 'Diskon', width: 12, type: 'currency', value: (r) => r.discount },
  },
  {
    key: 'deliveryFee',
    label: 'Ongkir + Layanan',
    defaultOn: false,
    align: 'right',
    render: (r) =>
      r.channel === 'online' ? (
        <span className="font-mono">{formatRupiah(r.deliveryFee + r.serviceFee)}</span>
      ) : (
        '—'
      ),
    excel: {
      header: 'Ongkir + Biaya Layanan',
      width: 16,
      type: 'currency',
      value: (r) => r.deliveryFee + r.serviceFee,
    },
  },
  {
    key: 'totalPaid',
    label: 'Total Dibayar',
    defaultOn: false,
    align: 'right',
    render: (r) => <span className="font-mono">{formatRupiah(r.totalPaid)}</span>,
    excel: { header: 'Total Dibayar', width: 16, type: 'currency', value: (r) => r.totalPaid },
  },
  {
    key: 'refund',
    label: 'Refund',
    defaultOn: false,
    align: 'right',
    render: (r) =>
      r.refund ? <span className="font-mono text-[#be123c]">{formatRupiah(r.refund)}</span> : '—',
    excel: { header: 'Refund', width: 12, type: 'currency', value: (r) => r.refund },
  },
  {
    key: 'gateway',
    label: 'Biaya Gateway',
    defaultOn: false,
    align: 'right',
    render: (r) =>
      r.gatewayMdr + r.gatewayTax > 0 ? (
        <span className="font-mono">{rpDetail(r.gatewayMdr + r.gatewayTax)}</span>
      ) : (
        '—'
      ),
    excel: {
      header: 'Biaya Gateway',
      width: 14,
      type: 'number',
      value: (r) => r.gatewayMdr + r.gatewayTax,
    },
  },
  {
    key: 'payment',
    label: 'Metode Bayar',
    defaultOn: true,
    render: (r) => PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod,
    excel: {
      header: 'Metode Bayar',
      width: 12,
      value: (r) => PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod,
    },
  },
  {
    key: 'balance',
    label: 'Status Saldo',
    defaultOn: true,
    render: (r) =>
      r.balanceStatus ? (
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${BALANCE_STATUS_CLASSES[r.balanceStatus]}`}
        >
          {BALANCE_STATUS_LABELS[r.balanceStatus]}
        </span>
      ) : (
        '—'
      ),
    excel: {
      header: 'Status Saldo',
      width: 16,
      value: (r) => (r.balanceStatus ? BALANCE_STATUS_LABELS[r.balanceStatus] : ''),
    },
  },
  {
    key: 'cashier',
    label: 'Kasir',
    defaultOn: true,
    render: (r) => (r.channel === 'online' ? 'Online' : (r.cashierName ?? '—')),
    excel: {
      header: 'Kasir',
      width: 16,
      value: (r) => (r.channel === 'online' ? 'Online' : r.cashierName),
    },
  },
];

const STORAGE_KEY = 'irona.salesDetail.columns';

function loadColumns(): Set<ColumnKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // penyimpanan browser tidak tersedia: pakai default
  }
  return new Set(COLUMNS.filter((c) => c.defaultOn).map((c) => c.key));
}

export default function SalesDetailReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [timeBasis, setTimeBasis] = useState<'order' | 'pay'>('order');
  const [channel, setChannel] = useState<'' | 'offline' | 'online'>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [visible, setVisible] = useState<Set<ColumnKey>>(loadColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<SalesRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detail, setDetail] = useState<SalesRow | null>(null);

  // Tunda pencarian 300 ms supaya tidak memuat ulang tiap ketikan
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!columnsOpen) return;
    const close = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node))
        setColumnsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [columnsOpen]);

  const filters: SalesFilters = {
    start: range.start,
    end: range.end,
    timeBasis,
    channel: channel || null,
    search: debounced || null,
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
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat detail penjualan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filterKey, page, pageSize]);

  function toggleColumn(key: ColumnKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // abaikan kalau penyimpanan browser tidak tersedia
      }
      return next;
    });
  }

  const shown = COLUMNS.filter((c) => visible.has(c.key));

  async function handleExport() {
    setExporting(true);
    try {
      const all = await fetchAllSalesRows(filters);
      await exportToExcel<SalesRow>({
        fileName: `Detail Penjualan ${range.start} sd ${range.end}`,
        title: 'Detail Penjualan',
        subtitle: `Periode ${rangeText(range)} · Acuan ${timeBasis === 'pay' ? 'Waktu Bayar' : 'Waktu Order'}${channel ? ` · ${CHANNEL_LABELS[channel]}` : ''}`,
        summary: summary
          ? [
              ['Total Penjualan', summary.totalSales],
              ['Total Transaksi', summary.transactions],
              ['Penjualan Bersih', summary.netSales],
              ['Total Pembayaran Diterima', summary.received],
              ['Belum Diterima (di Midtrans)', summary.notReceived],
              ['Total Biaya Gateway', summary.gatewayFeeTotal],
            ]
          : undefined,
        sheets: [{ name: 'Transaksi', rows: all, columns: shown.map((c) => c.excel) }],
      });
    } catch (err: any) {
      setError(err?.message ?? 'Gagal mengekspor.');
    } finally {
      setExporting(false);
    }
  }

  const filterClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';
  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        breadcrumb={['Laporan', 'Laporan Penjualan', 'Detail Penjualan']}
        title="Detail Penjualan"
        info="Daftar semua transaksi. Waktu Bayar pesanan online = saat pembayaran settlement di Midtrans; transaksi kasir waktu bayar = waktu order."
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
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={timeBasis}
            onChange={(e) => {
              setTimeBasis(e.target.value as 'order' | 'pay');
              setPage(1);
            }}
            className={filterClass}
            aria-label="Acuan waktu"
          >
            <option value="order">Acuan: Waktu Order</option>
            <option value="pay">Acuan: Waktu Bayar</option>
          </select>
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as '' | 'offline' | 'online');
              setPage(1);
            }}
            className={filterClass}
            aria-label="Channel"
          >
            <option value="">Semua Channel</option>
            <option value="offline">Offline</option>
            <option value="online">Online</option>
          </select>
        </div>
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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Penjualan" value={summary.totalSales} />
          <StatCard
            label="Total Transaksi"
            value={summary.transactions}
            format="number"
            hint={`Offline ${summary.transactionsOffline} · Online ${summary.transactionsOnline}`}
          />
          <StatCard
            label="Penjualan Bersih"
            value={summary.netSales}
            hint={`Total Penjualan − refund ${formatRupiah(summary.refund)}`}
          />
          <StatCard
            label="Total Pembayaran"
            value={summary.received}
            hint="Sudah diterima (kasir + online yang sudah dicairkan)"
          />
          <StatCard
            label="Belum Diterima"
            value={summary.notReceived}
            hint="Pesanan online yang uangnya masih di Midtrans"
          />
          <StatCard
            label="Total Biaya Gateway"
            value={summary.gatewayFeeTotal}
            hint="MDR 0,7% + PPN 11% dari MDR"
          />
        </div>
      )}

      <SearchToolbar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Cari no transaksi / kasir / pelanggan..."
      >
        <div ref={columnsRef} className="relative">
          <button
            onClick={() => setColumnsOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs font-medium text-[#334155] hover:bg-white"
          >
            <Columns3 className="size-4" />
            Atur Tabel
          </button>
          {columnsOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 flex w-56 flex-col gap-1 rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-lg">
              {COLUMNS.map((c) => (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center gap-2 text-xs text-[#334155]"
                >
                  <input
                    type="checkbox"
                    checked={visible.has(c.key)}
                    onChange={() => toggleColumn(c.key)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </SearchToolbar>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                {shown.map((c, i) => (
                  <th
                    key={c.key}
                    className={`${thClass} ${i === 0 ? 'pl-6' : ''} ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={shown.length + 1}
                    className="py-10 text-center text-xs text-[#94a3b8]"
                  >
                    Memuat transaksi...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={shown.length + 1}
                    className="py-10 text-center text-xs text-[#94a3b8]"
                  >
                    Tidak ada transaksi di periode ini.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-[#f1f5f9] first:border-t-0">
                    {shown.map((c, i) => (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap py-3 pr-3 text-xs text-[#475569] ${i === 0 ? 'pl-6' : ''} ${c.align === 'right' ? 'text-right' : ''}`}
                      >
                        {c.render(r)}
                      </td>
                    ))}
                    <td className="py-3 pr-6 text-right">
                      <button
                        onClick={() => setDetail(r)}
                        aria-label="Detail transaksi"
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
          itemLabel="transaksi"
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
