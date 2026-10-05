import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchStockCycle } from '../../services/trendReports';
import type { StockCycleRow } from '../../types/trendReport';
import { parseLocalDate, todayISO } from '../../utils/date';
import ReportDateFilter from '../reports/ReportDateFilter';
import { presetRange, rangeText, type DatePreset, type DateRange } from '../reports/reportRange';
import { MATERIAL_TYPE_LABELS, formatQty } from '../reports/inventoryReportFormat';

type Status = 'cepat' | 'normal' | 'lambat';

/** Batas status dari Estimasi Hari Bertahan (berapa hari stok rata-rata habis terpakai) */
const FAST_MAX_DAYS = 30;
const NORMAL_MAX_DAYS = 90;

const STATUS_LABELS: Record<Status, string> = {
  cepat: 'Cepat',
  normal: 'Normal',
  lambat: 'Lambat',
};
const STATUS_CLASSES: Record<Status, string> = {
  cepat: 'bg-[#ecfdf5] text-[#047857]',
  normal: 'bg-[#eff6ff] text-[#1d4ed8]',
  lambat: 'bg-[#fef3c7] text-[#92400e]',
};

function statusOf(r: StockCycleRow): Status {
  if (r.daysCover === null) return 'lambat';
  if (r.daysCover <= FAST_MAX_DAYS) return 'cepat';
  if (r.daysCover <= NORMAL_MAX_DAYS) return 'normal';
  return 'lambat';
}

const ratioText = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}×`;

const daysText = (n: number | null) =>
  n === null ? 'Tidak terpakai' : `${n.toLocaleString('id-ID', { maximumFractionDigits: 0 })} hari`;

export default function StockCycleScreen() {
  const navigate = useNavigate();
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => presetRange('this_month', todayISO()));
  const [materialType, setMaterialType] = useState<'' | 'tetap' | 'menyusut'>('');
  const [search, setSearch] = useState('');

  const [rows, setRows] = useState<StockCycleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStockCycle(range.start, range.end)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat analisa.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const days =
    Math.round(
      (parseLocalDate(range.end).getTime() - parseLocalDate(range.start).getTime()) / 86400000
    ) + 1;
  const q = search.trim().toLowerCase();
  // Default: rasio terendah dulu (bahan lambat/berisiko di atas); tidak terpakai paling atas
  const filtered = rows
    .filter(
      (r) =>
        (!materialType || r.materialType === materialType) &&
        (!q || r.name.toLowerCase().includes(q))
    )
    .sort((a, b) => (a.turnover ?? -1) - (b.turnover ?? -1) || a.name.localeCompare(b.name));

  // Kartu ringkasan: hanya bahan aktif yang punya rasio
  const rated = filtered.filter((r) => r.isActive && r.turnover !== null);
  const avgTurnover = rated.length
    ? rated.reduce((s, r) => s + (r.turnover ?? 0), 0) / rated.length
    : null;
  const fastest = rated.reduce<StockCycleRow | null>(
    (best, r) => (!best || (r.turnover ?? 0) > (best.turnover ?? 0) ? r : best),
    null
  );
  const slowest = rated.reduce<StockCycleRow | null>(
    (worst, r) => (!worst || (r.turnover ?? 0) < (worst.turnover ?? 0) ? r : worst),
    null
  );
  const riskCount = filtered.filter(
    (r) => r.materialType === 'menyusut' && statusOf(r) === 'lambat'
  ).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const filterClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';
  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        breadcrumb={['Analisa Tren & Margin', 'Perputaran Stok']}
        title="Perputaran Stok"
        info={`Seberapa cepat bahan baku terpakai. Terpakai = pemakaian dari Kelola Stok (penjualan dikurangi refund, bahan produksi racikan, Try & Error; penyesuaian tidak dihitung). Rasio = Terpakai ÷ rata-rata stok (awal + akhir) / 2. Estimasi Hari Bertahan = jumlah hari periode ÷ rasio. Status: Cepat ≤ ${FAST_MAX_DAYS} hari, Normal ≤ ${NORMAL_MAX_DAYS} hari, Lambat > ${NORMAL_MAX_DAYS} hari atau tidak terpakai.`}
        badge={`${rangeText(range)} · ${days} hari`}
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
              placeholder="Cari nama bahan..."
              className={`${filterClass} w-48 pl-8`}
              aria-label="Cari nama bahan"
            />
          </div>
          <select
            value={materialType}
            onChange={(e) => {
              setMaterialType(e.target.value as typeof materialType);
              setPage(1);
            }}
            className={filterClass}
            aria-label="Jenis bahan"
          >
            <option value="">Semua Jenis Bahan</option>
            <option value="tetap">Barang Tetap</option>
            <option value="menyusut">Bahan Menyusut</option>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-[#0f172a] bg-[#0f172a] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#94a3b8]">
            Rata-rata Rasio Perputaran
          </p>
          <p className="font-mono text-lg font-bold text-white">{ratioText(avgTurnover)}</p>
          <p className="text-[11px] text-[#94a3b8]">{rated.length} bahan aktif</p>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">
            Tercepat Perputarannya
          </p>
          <p className="truncate text-base font-bold text-[#0f172a]">{fastest?.name ?? '—'}</p>
          {fastest && (
            <p className="font-mono text-[11px] text-[#047857]">
              {ratioText(fastest.turnover)} · {daysText(fastest.daysCover)}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">
            Terlambat Perputarannya
          </p>
          <p className="truncate text-base font-bold text-[#0f172a]">{slowest?.name ?? '—'}</p>
          {slowest && (
            <p className="font-mono text-[11px] text-[#92400e]">
              {ratioText(slowest.turnover)} · {daysText(slowest.daysCover)}
            </p>
          )}
        </div>
      </div>

      {riskCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-xs text-[#92400e]">
          <AlertTriangle className="size-4 shrink-0" />
          {riskCount} bahan menyusut perputarannya lambat — berisiko rusak/susut sebelum
          termanfaatkan. Baris ditandai kuning.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Nama Bahan</th>
                <th className={`${thClass} text-left`}>Jenis Bahan</th>
                <th className={`${thClass} text-right`}>Stok Awal</th>
                <th className={`${thClass} text-right`}>Terpakai</th>
                <th className={`${thClass} text-right`}>Rata-rata Stok</th>
                <th className={`${thClass} text-right`}>Rasio Perputaran</th>
                <th className={`${thClass} text-right`}>Estimasi Hari Bertahan</th>
                <th className={`${thClass} text-left`}>Status</th>
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-[#94a3b8]">
                    {rows.length ? 'Bahan tidak ditemukan.' : 'Belum ada bahan baku.'}
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => {
                  const status = statusOf(r);
                  const risk = r.materialType === 'menyusut' && status === 'lambat';
                  return (
                    <tr
                      key={r.rawMaterialId}
                      className={`border-t border-[#f1f5f9] text-xs first:border-t-0 ${risk ? 'bg-[#fffbeb]' : ''}`}
                    >
                      <td className="py-3 pl-6 pr-3">
                        <span className="font-semibold text-[#0f172a]">{r.name}</span>
                        {!r.isActive && (
                          <span className="ml-1.5 rounded-full border border-dashed border-[#94a3b8] px-1.5 py-0.5 text-[10px] font-bold text-[#64748b]">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.materialType === 'menyusut' ? 'bg-[#fdf2f8] text-[#9d174d]' : 'bg-[#f1f5f9] text-[#475569]'}`}
                        >
                          {MATERIAL_TYPE_LABELS[r.materialType]}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right font-mono">
                        {formatQty(r.openingStock)} {r.unitName}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono">
                        {formatQty(r.used)} {r.unitName}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono">
                        {formatQty(r.avgStock)} {r.unitName}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono font-semibold text-[#0f172a]">
                        {ratioText(r.turnover)}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono">{daysText(r.daysCover)}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[status]}`}
                        >
                          {risk && <AlertTriangle className="size-3" />}
                          {STATUS_LABELS[status]}
                        </span>
                      </td>
                      <td className="py-3 pr-6 text-right">
                        <button
                          onClick={() =>
                            navigate(`/inventory/manage-stock?q=${encodeURIComponent(r.name)}`)
                          }
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
                        >
                          Kartu Stok
                          <ExternalLink className="size-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
          itemLabel="bahan"
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
