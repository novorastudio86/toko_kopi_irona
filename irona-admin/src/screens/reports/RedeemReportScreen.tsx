import { useCallback, useEffect, useState } from 'react';
import { Download, Search, Undo2, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { cancelRewardClaim, fetchRedeemReport } from '../../services/rewards';
import type { ClaimStatus, RedeemReportRow } from '../../types/reward';
import { todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import { CLAIM_STATUS_LABELS, ClaimStatusBadge } from '../promotions/RewardClaimsModal';
import ReportDateFilter from './ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from './reportRange';
import { formatDateTime } from './salesReportFormat';

export default function RedeemReportScreen() {
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | ClaimStatus>('');

  const [rows, setRows] = useState<RedeemReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchRedeemReport(range.start, range.end));
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat laporan.');
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(timer);
  }, [flash]);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      (!q ||
        r.customerName.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.rewardName.toLowerCase().includes(q))
  );
  // Klaim yang dibatalkan poinnya kembali, jadi tidak dihitung sebagai poin ditukar
  const counted = filtered.filter((r) => r.status !== 'dibatalkan');
  const totalPoints = counted.reduce((s, r) => s + r.pointsUsed, 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleCancel(r: RedeemReportRow) {
    const reason = window.prompt(
      `Batalkan klaim ${r.code} milik ${r.customerName}? ${r.pointsUsed} poin akan dikembalikan.\n\nAlasan pembatalan:`,
      'Tidak jadi pesan'
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setError('Alasan pembatalan wajib diisi.');
      return;
    }
    setCancellingId(r.id);
    setError(null);
    try {
      const balance = await cancelRewardClaim(r.id, reason.trim());
      await load();
      setFlash(
        `Klaim ${r.code} dibatalkan. ${r.pointsUsed} poin kembali ke ${r.customerName} (saldo ${balance}).`
      );
    } catch (err: any) {
      setError(err?.message ?? 'Gagal membatalkan klaim.');
    } finally {
      setCancellingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<RedeemReportRow>({
        fileName: `Laporan Redeem Point ${range.start} sd ${range.end}`,
        title: 'Laporan Redeem Point',
        subtitle: `Periode ${rangeText(range)}${status ? ` · ${CLAIM_STATUS_LABELS[status]}` : ''}`,
        summary: [
          ['Total Poin Ditukar', `${totalPoints.toLocaleString('id-ID')} poin`],
          ['Total Transaksi Redeem', String(counted.length)],
          ['Dibatalkan', String(filtered.length - counted.length)],
        ],
        sheets: [
          {
            name: 'Redeem',
            rows: filtered,
            columns: [
              { header: 'Tanggal Redeem', width: 18, value: (r) => formatDateTime(r.claimedAt) },
              { header: 'Kode', width: 12, value: (r) => r.code },
              { header: 'Nama Customer', width: 22, value: (r) => r.customerName },
              { header: 'No HP', width: 16, value: (r) => r.phoneNumber },
              { header: 'Item Ditukar', width: 26, value: (r) => r.rewardName },
              { header: 'Poin', width: 8, type: 'number', value: (r) => r.pointsUsed },
              { header: 'Status', width: 16, value: (r) => CLAIM_STATUS_LABELS[r.status] },
              { header: 'Alasan Batal', width: 22, value: (r) => r.cancelReason ?? '' },
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

  const filterClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';
  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Laporan Redeem Point"
        info="Semua klaim reward member. Klaim yang masih Menunggu Ditukar bisa dibatalkan (poin kembali ke member). Klaim yang dibatalkan tidak dihitung di total poin ditukar."
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari customer / kode..."
              className={`${filterClass} w-52 pl-8`}
              aria-label="Cari customer"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            className={filterClass}
            aria-label="Status"
          >
            <option value="">Semua Status</option>
            {(Object.keys(CLAIM_STATUS_LABELS) as ClaimStatus[]).map((s) => (
              <option key={s} value={s}>
                {CLAIM_STATUS_LABELS[s]}
              </option>
            ))}
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
      {flash && (
        <div className="rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] px-4 py-3 text-xs text-[#047857]">
          {flash}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Poin Ditukar"
          value={totalPoints}
          format="number"
          hint="Tidak termasuk klaim yang dibatalkan"
        />
        <StatCard
          label="Total Transaksi Redeem"
          value={counted.length}
          format="number"
          hint={
            filtered.length - counted.length
              ? `${filtered.length - counted.length} klaim dibatalkan`
              : undefined
          }
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Tanggal Redeem</th>
                <th className={`${thClass} text-left`}>Nama Customer</th>
                <th className={`${thClass} text-left`}>Item Ditukar</th>
                <th className={`${thClass} text-right`}>Poin</th>
                <th className={`${thClass} text-left`}>Status</th>
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-[#94a3b8]">
                    {rows.length ? 'Klaim tidak ditemukan.' : 'Belum ada redeem di periode ini.'}
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => (
                  <tr key={r.id} className="border-t border-[#f1f5f9] text-xs first:border-t-0">
                    <td className="py-3 pl-6 pr-3">
                      <p className="text-[#0f172a]">{formatDateTime(r.claimedAt)}</p>
                      <p className="font-mono text-[11px] text-[#94a3b8]">{r.code}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-[#0f172a]">{r.customerName}</p>
                      <p className="font-mono text-[11px] text-[#94a3b8]">{r.phoneNumber}</p>
                    </td>
                    <td className="py-3 pr-3 text-[#475569]">{r.rewardName}</td>
                    <td className="py-3 pr-3 text-right font-mono">{r.pointsUsed}</td>
                    <td className="py-3 pr-3">
                      <ClaimStatusBadge status={r.status} />
                      {r.status === 'dibatalkan' && r.cancelReason && (
                        <p className="mt-1 text-[11px] text-[#94a3b8]">{r.cancelReason}</p>
                      )}
                      {r.status === 'sudah_ditukar' && r.redeemedAt && (
                        <p className="mt-1 text-[11px] text-[#94a3b8]">
                          {formatDateTime(r.redeemedAt)}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-6 text-right">
                      {r.status === 'menunggu' && (
                        <button
                          onClick={() => handleCancel(r)}
                          disabled={cancellingId !== null}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-2 py-1 text-[11px] font-semibold text-[#475569] hover:border-[#fecdd3] hover:text-[#e11d48] disabled:opacity-50"
                        >
                          <Undo2 className="size-3" />
                          {cancellingId === r.id ? 'Membatalkan...' : 'Batalkan'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
          itemLabel="klaim"
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
