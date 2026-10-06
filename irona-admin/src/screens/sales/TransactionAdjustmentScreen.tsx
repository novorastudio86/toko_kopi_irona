import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, FlaskConical, Undo2, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '../../components/PageHeader';
import { SearchToolbar } from '../../components/SearchToolbar';
import { SortableTh, type SortDir } from '../../components/SortableTh';
import { TablePagination } from '../../components/TablePagination';
import { fetchAdjustments } from '../../services/adjustments';
import type { Adjustment, AdjustmentType, Channel } from '../../types/adjustment';
import { formatRupiah } from '../../utils/format';
import { toLocalISO } from '../../utils/date';
import AdjustmentDetailModal from './AdjustmentDetailModal';
import RefundFormModal from './RefundFormModal';
import TryErrorFormModal from './TryErrorFormModal';
import { AdjustmentTypeBadge, ProductStatusBadge } from './AdjustmentBadges';
import { formatDateTime } from './adjustmentFormat';
import icPlus from '../../assets/ui/plus.svg';

type SortKey = 'createdAt' | 'adjustmentType' | 'reference';

export default function TransactionAdjustmentScreen() {
  const [items, setItems] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | AdjustmentType>('');
  const [channelFilter, setChannelFilter] = useState<'' | Channel>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'createdAt',
    dir: 'desc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [activeForm, setActiveForm] = useState<AdjustmentType | null>(null);
  const [detail, setDetail] = useState<Adjustment | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchAdjustments());
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat penyesuaian transaksi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      const day = toLocalISO(new Date(a.createdAt));
      return (
        (!q ||
          a.reference.toLowerCase().includes(q) ||
          (a.notes ?? '').toLowerCase().includes(q) ||
          (a.customerName ?? '').toLowerCase().includes(q)) &&
        (!typeFilter || a.adjustmentType === typeFilter) &&
        // Try & Error tidak punya channel: hanya tampil saat filter "Semua Channel"
        (!channelFilter || a.channel === channelFilter) &&
        (!startDate || day >= startDate) &&
        (!endDate || day <= endDate)
      );
    });
  }, [items, search, typeFilter, channelFilter, startDate, endDate]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const cmp = String(a[sort.key]).localeCompare(String(b[sort.key]), 'id');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const refundTotal = filtered
    .filter((a) => a.adjustmentType === 'refund')
    .reduce((s, a) => s + a.amount, 0);
  const tneTotal = filtered
    .filter((a) => a.adjustmentType === 'try_error')
    .reduce((s, a) => s + a.amount, 0);

  function handleSort(key: string) {
    const k = key as SortKey;
    setSort((prev) =>
      prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }
    );
  }

  const hasFilter = !!(search || typeFilter || channelFilter || startDate || endDate);
  const thClass =
    'py-[14px] text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]';
  const filterClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Penyesuaian Transaksi"
        info="Catat refund transaksi dan try & error produk. Catatan bersifat final (tidak bisa diubah atau dihapus) supaya jejak stok, poin member, dan keuangan tetap konsisten."
        badge={loading ? undefined : `${items.length} catatan`}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] outline-none hover:bg-[#1e293b]">
              <img src={icPlus} alt="" className="size-4" />
              Tambah Penyesuaian
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setActiveForm('refund')}>
                <Undo2 className="mr-2 size-3.5" />
                Refund Transaksi
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveForm('try_error')}>
                <FlaskConical className="mr-2 size-3.5" />
                Try & Error Produk
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-xs font-medium text-[#0f172a]">
          <CheckCircle2 className="size-4 text-[#059669]" />
          {flash}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">
            Total Refund {hasFilter ? '(sesuai filter)' : ''}
          </p>
          <p className="pt-1 font-mono text-xl font-bold text-[#0f172a]">
            {formatRupiah(refundTotal)}
          </p>
          <p className="text-[11px] text-[#94a3b8]">Mengurangi pendapatan kotor</p>
        </div>
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">
            Total Biaya Try & Error {hasFilter ? '(sesuai filter)' : ''}
          </p>
          <p className="pt-1 font-mono text-xl font-bold text-[#0f172a]">
            {formatRupiah(tneTotal)}
          </p>
          <p className="text-[11px] text-[#94a3b8]">Dicatat sebagai biaya (Fixed Cost)</p>
        </div>
      </div>

      <SearchToolbar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Cari no transaksi, produk, atau keterangan..."
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as '' | AdjustmentType);
              setPage(1);
            }}
            className={`${filterClass} w-40`}
          >
            <option value="">Semua Tipe</option>
            <option value="refund">Refund</option>
            <option value="try_error">Try & Error</option>
          </select>
          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value as '' | Channel);
              setPage(1);
            }}
            className={`${filterClass} w-36`}
          >
            <option value="">Semua Channel</option>
            <option value="offline">Offline</option>
            <option value="online">Online</option>
          </select>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className={filterClass}
              aria-label="Dari tanggal"
            />
            <span className="text-xs text-[#94a3b8]">–</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className={filterClass}
              aria-label="Sampai tanggal"
            />
          </div>
          <button
            onClick={() => {
              setSearch('');
              setTypeFilter('');
              setChannelFilter('');
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
            className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs font-medium text-[#475569] hover:bg-white"
          >
            Reset
          </button>
        </div>
      </SearchToolbar>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <SortableTh
                  label="Tanggal"
                  sortKey="createdAt"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  className="pl-6"
                />
                <SortableTh
                  label="Tipe"
                  sortKey="adjustmentType"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Referensi"
                  sortKey="reference"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <th className={`${thClass} text-left`}>Status Produk</th>
                <th className={`${thClass} text-left`}>Keterangan</th>
                <th className={`${thClass} pr-3 text-right`}>Nominal</th>
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat penyesuaian...
                  </td>
                </tr>
              )}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#94a3b8]">
                    {hasFilter
                      ? 'Tidak ada catatan yang cocok.'
                      : 'Belum ada penyesuaian transaksi.'}
                  </td>
                </tr>
              )}

              {!loading &&
                paged.map((a) => (
                  <tr key={a.id} className="border-t border-[#f1f5f9] first:border-t-0">
                    <td className="py-4 pl-6 pr-3 text-sm text-[#475569]">
                      {formatDateTime(a.createdAt)}
                    </td>
                    <td className="py-4 pr-3">
                      <AdjustmentTypeBadge type={a.adjustmentType} />
                    </td>
                    <td className="py-4 pr-3">
                      <span
                        className={`text-sm font-semibold text-[#0f172a] ${a.adjustmentType === 'refund' ? 'font-mono' : ''}`}
                      >
                        {a.reference}
                      </span>
                      <span className="block pt-0.5 text-xs text-[#94a3b8]">
                        {a.adjustmentType === 'refund'
                          ? `${a.channel === 'online' ? 'Online · ID Pesanan' : 'Offline · No Transaksi'}${a.customerName ? ` · ${a.customerName}` : ''}`
                          : a.tneType === 'racikan_baru'
                            ? 'Bahan baku manual'
                            : a.tneType === 'resep_racikan'
                              ? 'Dari resep racikan'
                              : 'Dari resep produk'}
                      </span>
                    </td>
                    <td className="py-4 pr-3">
                      {a.productStatus ? (
                        <ProductStatusBadge status={a.productStatus} />
                      ) : (
                        <span className="text-sm text-[#94a3b8]">-</span>
                      )}
                    </td>
                    <td className="max-w-[260px] py-4 pr-3 text-sm text-[#475569]">
                      <span className="line-clamp-2">{a.notes || '-'}</span>
                    </td>
                    <td className="py-4 pr-3 text-right font-mono text-sm font-bold text-[#0f172a]">
                      {formatRupiah(a.amount)}
                    </td>
                    <td className="py-4 pr-6 text-right">
                      <button
                        onClick={() => setDetail(a)}
                        className="text-sm font-medium text-[#334155] underline hover:text-[#0f172a]"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={sorted.length}
          itemLabel="catatan"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <p className="text-[11px] leading-4 text-[#94a3b8]">
        Refund Salah Order mengembalikan stok bahan yang terpotong saat transaksi; Sudah Dibuat
        tidak mengembalikan stok. Refund transaksi member otomatis menarik poin & total belanjanya.
        Try & Error hanya memotong stok bahan, tanpa menambah stok hasil.
      </p>

      {activeForm === 'refund' && (
        <RefundFormModal
          onClose={() => setActiveForm(null)}
          onSaved={(number) => {
            setActiveForm(null);
            setFlash(`Refund transaksi ${number} berhasil dicatat.`);
            loadData();
          }}
        />
      )}

      {activeForm === 'try_error' && (
        <TryErrorFormModal
          onClose={() => setActiveForm(null)}
          onSaved={(label) => {
            setActiveForm(null);
            setFlash(`Try & error "${label}" berhasil dicatat.`);
            loadData();
          }}
        />
      )}

      {detail && <AdjustmentDetailModal adjustment={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
