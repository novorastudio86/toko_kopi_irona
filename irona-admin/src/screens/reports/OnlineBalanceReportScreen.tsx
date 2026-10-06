import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Download, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchOnlineBalance } from '../../services/finance';
import { fetchOnlineOrderSettings } from '../../services/onlineOrder';
import type { BalanceStatus, OnlineBalanceRow } from '../../types/finance';
import { formatRupiah, formatRupiahDetail } from '../../utils/format';
import { parseLocalDate, toLocalISO, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import {
  BALANCE_STATUS_CLASSES,
  BALANCE_STATUS_LABELS,
  formatDate,
  formatDateTime,
} from '../finance/cashFlowFormat';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';

const STATUSES: BalanceStatus[] = ['tertahan', 'tersedia', 'dicairkan', 'direfund'];

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 text-xs ${bold ? 'border-t border-dashed border-[#cbd5e1] pt-2 font-bold text-[#0f172a]' : 'text-[#475569]'}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export default function OnlineBalanceReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [status, setStatus] = useState<'' | BalanceStatus>('');

  const [rows, setRows] = useState<OnlineBalanceRow[]>([]);
  const [rates, setRates] = useState({ mdr: 0.7, ppn: 11 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [list, settings] = await Promise.all([
          fetchOnlineBalance(),
          fetchOnlineOrderSettings(),
        ]);
        if (cancelled) return;
        setRows(list);
        setRates({ mdr: settings.mdrPercent, ppn: settings.ppnPercent });
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Gagal memuat laporan saldo online.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pesanan di rentang tanggal (tanggal transaksi), status saat ini
  const inRange = rows.filter((r) => {
    const d = toLocalISO(new Date(r.transactionDate));
    return d >= range.start && d <= range.end;
  });
  const filtered = status ? inRange.filter((r) => r.status === status) : inRange;
  const counted = filtered.filter((r) => r.status !== 'direfund');
  const gross = counted.reduce((s, r) => s + r.grossAmount, 0);
  const fees = counted.reduce((s, r) => s + r.gatewayMdr + r.gatewayTax, 0);
  const net = counted.reduce((s, r) => s + r.netAmount, 0);
  const byStatus = (s: BalanceStatus) =>
    inRange.filter((r) => r.status === s).reduce((sum, r) => sum + r.netAmount, 0);

  const sorted = [...filtered].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const periodText = rangeText(range);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<OnlineBalanceRow>({
        fileName: `Laporan Saldo Online ${range.start} sd ${range.end}`,
        title: 'Laporan Cash Flow — Saldo Online',
        subtitle: `Periode ${periodText}${status ? ` · Status ${BALANCE_STATUS_LABELS[status]}` : ''}`,
        summary: [
          ['Total Nominal Transaksi (bruto)', gross],
          [`Total Potongan Gateway (MDR ${rates.mdr}% + PPN ${rates.ppn}%)`, fees],
          ['Total Bersih Diterima', net],
          ['Tertahan', byStatus('tertahan')],
          ['Tersedia', byStatus('tersedia')],
          ['Sudah Dicairkan', byStatus('dicairkan')],
        ],
        sheets: [
          {
            name: 'Rincian Saldo Online',
            rows: sorted,
            columns: [
              { header: 'No Transaksi', width: 18, value: (r) => r.transactionNumber },
              {
                header: 'Tanggal',
                width: 12,
                type: 'date',
                value: (r) => parseLocalDate(toLocalISO(new Date(r.transactionDate))),
              },
              {
                header: 'Nominal Transaksi',
                width: 18,
                type: 'currency',
                value: (r) => r.grossAmount,
              },
              {
                header: `MDR (${rates.mdr}%)`,
                width: 14,
                type: 'number',
                value: (r) => r.gatewayMdr,
              },
              {
                header: `PPN dari MDR (${rates.ppn}%)`,
                width: 18,
                type: 'number',
                value: (r) => r.gatewayTax,
              },
              { header: 'Nominal Bersih', width: 16, type: 'number', value: (r) => r.netAmount },
              { header: 'Status', width: 16, value: (r) => BALANCE_STATUS_LABELS[r.status] },
              { header: 'Settlement', width: 18, value: (r) => formatDateTime(r.settledAt) },
              {
                header: 'Tersedia / Dicairkan',
                width: 20,
                value: (r) =>
                  r.disbursedDate
                    ? `Dicairkan ${formatDate(r.disbursedDate)}`
                    : `Tersedia ${formatDate(r.availableDate)}`,
              },
            ],
          },
        ],
      });
    } catch (err: any) {
      setError(err?.message ?? 'Gagal mengekspor laporan.');
    } finally {
      setExporting(false);
    }
  }

  const thClass =
    'py-[14px] text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Laporan Cash Flow — Saldo Online"
        info="Pesanan Web Customer yang dibayar lewat payment gateway (Midtrans). Nominal bersih = nominal transaksi − MDR − PPN atas MDR. Tersedia = 3 hari kerja setelah settlement; Sudah Dicairkan dicatat admin di Keuangan › Cash Flow."
        badge={periodText}
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
          className="w-48 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs outline-none"
          aria-label="Status"
        >
          <option value="">Semua Status ({inRange.length})</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {BALANCE_STATUS_LABELS[s]} ({inRange.filter((r) => r.status === s).length})
            </option>
          ))}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Nominal Transaksi" value={gross} hint="Bruto, sebelum potongan" />
        <StatCard
          label="Total Potongan Gateway"
          value={fees}
          hint={`MDR ${rates.mdr}% + PPN ${rates.ppn}% dari MDR`}
        />
        <StatCard label="Total Bersih Diterima" value={net} tone="dark" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(['tertahan', 'tersedia', 'dicairkan'] as BalanceStatus[]).map((s) => (
          <div
            key={s}
            className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-white px-4 py-3"
          >
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${BALANCE_STATUS_CLASSES[s]}`}
            >
              {BALANCE_STATUS_LABELS[s]}
            </span>
            <span className="font-mono text-sm font-bold text-[#0f172a]">
              {formatRupiahDetail(byStatus(s))}
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>No Transaksi</th>
                <th className={`${thClass} text-left`}>Tanggal</th>
                <th className={`${thClass} text-right`}>Nominal</th>
                <th className={`${thClass} text-right`}>MDR ({rates.mdr}%)</th>
                <th className={`${thClass} text-right`}>PPN MDR ({rates.ppn}%)</th>
                <th className={`${thClass} text-right`}>Bersih</th>
                <th className={`${thClass} pl-4 text-left`}>Status</th>
                <th className={`${thClass} pr-6 text-left`}>Settlement / Dicairkan</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat laporan...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-[#94a3b8]">
                    Belum ada transaksi online di periode ini.
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => {
                  const isOpen = open.has(r.id);
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={`border-t border-[#f1f5f9] ${isOpen ? 'bg-[rgba(248,250,252,0.7)]' : ''}`}
                      >
                        <td className="py-3 pl-4 pr-3">
                          <button
                            onClick={() =>
                              setOpen((prev) => {
                                const next = new Set(prev);
                                if (next.has(r.id)) next.delete(r.id);
                                else next.add(r.id);
                                return next;
                              })
                            }
                            className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 font-mono text-xs text-[#0f172a] hover:bg-[#f1f5f9]"
                          >
                            {isOpen ? (
                              <ChevronDown className="size-3.5 text-[#64748b]" />
                            ) : (
                              <ChevronRight className="size-3.5 text-[#64748b]" />
                            )}
                            {r.transactionNumber}
                          </button>
                        </td>
                        <td className="py-3 pr-3 text-xs text-[#475569]">
                          {formatDateTime(r.transactionDate)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-xs">
                          {formatRupiah(r.grossAmount)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-xs text-[#be123c]">
                          {formatRupiahDetail(r.gatewayMdr)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-xs text-[#be123c]">
                          {formatRupiahDetail(r.gatewayTax)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-xs font-semibold">
                          {formatRupiahDetail(r.netAmount)}
                        </td>
                        <td className="py-3 pl-4 pr-3">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${BALANCE_STATUS_CLASSES[r.status]}`}
                          >
                            {BALANCE_STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td className="py-3 pr-6 text-xs text-[#475569]">
                          {r.disbursedDate
                            ? `Dicairkan ${formatDate(r.disbursedDate)}`
                            : `Tersedia ${formatDate(r.availableDate)}`}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-[rgba(248,250,252,0.7)]">
                          <td colSpan={8} className="px-6 pb-4 pt-1">
                            <div className="flex max-w-md flex-col gap-1.5 rounded-xl border border-[#e2e8f0] bg-white p-4">
                              <DetailRow
                                label="Nominal transaksi"
                                value={formatRupiah(r.grossAmount)}
                              />
                              <DetailRow
                                label={`MDR ${rates.mdr}% × ${formatRupiah(r.grossAmount)}`}
                                value={`−${formatRupiahDetail(r.gatewayMdr)}`}
                              />
                              <DetailRow
                                label={`PPN ${rates.ppn}% × MDR`}
                                value={`−${formatRupiahDetail(r.gatewayTax)}`}
                              />
                              <DetailRow
                                label="Nominal bersih diterima"
                                value={formatRupiahDetail(r.netAmount)}
                                bold
                              />
                              <p className="pt-2 text-[11px] leading-4 text-[#64748b]">
                                Settlement {formatDateTime(r.settledAt)} · Tersedia ditarik{' '}
                                {formatDate(r.availableDate)} (3 hari kerja)
                                {r.disbursedDate
                                  ? ` · Dicairkan ${formatDate(r.disbursedDate)}`
                                  : ''}
                                {r.customerName ? ` · Pelanggan ${r.customerName}` : ''}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={sorted.length}
          itemLabel="transaksi"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
