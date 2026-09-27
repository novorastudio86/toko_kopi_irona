import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Pencil, RefreshCcw, Trash2, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '../../components/PageHeader';
import { SearchToolbar } from '../../components/SearchToolbar';
import { SortableTh, type SortDir } from '../../components/SortableTh';
import { TablePagination } from '../../components/TablePagination';
import { deleteAsset, fetchAssets } from '../../services/assets';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { fetchOpenMonths, isPeriodLocked } from '../../services/finance';
import type { Asset, AssetStatus } from '../../types/asset';
import AssetFormModal from './AssetFormModal';
import AssetStatusModal from './AssetStatusModal';
import { AssetStatusBadge, AssetStatusLegend, STATUS_LABELS } from './AssetStatusBadge';
import icPlus from '../../assets/ui/plus.svg';
import icMore from '../../assets/ui/more.svg';

type SortKey = 'name' | 'purchaseDate' | 'purchasePrice' | 'quantity' | 'totalValue' | 'status';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AssetListScreen() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | AssetStatus>('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'purchaseDate',
    dir: 'desc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formState, setFormState] = useState<{ asset: Asset | null } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Asset | null>(null);
  // Tutup buku: aset di bulan yang sudah ditutup hanya bisa diubah statusnya
  const [today] = useState(todayISO);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const locked = (a: Asset) => isPeriodLocked(a.purchaseDate, today, openMonths);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, open] = await Promise.all([fetchAssets(), fetchOpenMonths()]);
      setAssets(list);
      setOpenMonths(open);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat data aset.');
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

  const totalValue = assets.reduce((sum, a) => sum + a.totalValue, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter(
      (a) =>
        (!q || a.name.toLowerCase().includes(q)) && (!statusFilter || a.status === statusFilter)
    );
  }, [assets, search, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      const cmp =
        typeof va === 'string'
          ? va.localeCompare(vb as string, 'id')
          : (va as number) - (vb as number);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleSort(key: string) {
    const k = key as SortKey;
    setSort((prev) =>
      prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }
    );
  }

  async function handleDelete(asset: Asset) {
    if (
      !window.confirm(
        `Hapus "${asset.name}" secara permanen? Gunakan ini hanya untuk input yang keliru — barang rusak/hilang cukup diubah statusnya.`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await deleteAsset(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setFlash(`Aset "${asset.name}" berhasil dihapus.`);
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal menghapus aset.');
    }
  }

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        breadcrumb={['Inventori Bahan', 'Aset Barang']}
        title="Aset"
        info="Pencatatan inventaris perlengkapan & peralatan toko. Bersifat administratif, tidak memengaruhi stok bahan baku."
        badge={loading ? undefined : `${assets.length} aset · ${formatRupiah(totalValue)}`}
        action={
          <button
            onClick={() => setFormState({ asset: null })}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]"
          >
            <img src={icPlus} alt="" className="size-4" />
            Tambah Aset
          </button>
        }
      />

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-xs font-medium text-[#0f172a]">
          <CheckCircle2 className="size-4 text-[#059669]" />
          {flash}
        </div>
      )}

      {(error || actionError) && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error ?? actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      <SearchToolbar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Cari nama aset..."
      >
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as '' | AssetStatus);
              setPage(1);
            }}
            className="w-56 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
          >
            <option value="">Semua Status ({assets.length})</option>
            {(Object.keys(STATUS_LABELS) as AssetStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]} ({assets.filter((a) => a.status === s).length})
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
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
          <table className="w-full min-w-[920px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <SortableTh
                  label="Nama Aset"
                  sortKey="name"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  className="pl-6"
                />
                <SortableTh
                  label="Tanggal Beli"
                  sortKey="purchaseDate"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Harga"
                  sortKey="purchasePrice"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Jumlah"
                  sortKey="quantity"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  align="center"
                />
                <SortableTh
                  label="Total Nilai"
                  sortKey="totalValue"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Status"
                  sortKey="status"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  align="center"
                />
                <th className="py-[14px] pr-6 text-right text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat data aset...
                  </td>
                </tr>
              )}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#94a3b8]">
                    {search || statusFilter
                      ? 'Tidak ada aset yang cocok.'
                      : 'Belum ada aset tercatat.'}
                  </td>
                </tr>
              )}

              {!loading &&
                paged.map((asset) => {
                  const inactive = asset.status !== 'aktif';
                  return (
                    <tr
                      key={asset.id}
                      className={`border-t border-[#f1f5f9] first:border-t-0 ${inactive ? 'bg-[#fcfcfd]' : ''}`}
                    >
                      <td className="py-4 pl-6 text-xs font-semibold text-[#0f172a]">
                        {asset.name}
                      </td>
                      <td className="py-4 text-xs font-medium text-[#475569]">
                        {formatDate(asset.purchaseDate)}
                      </td>
                      <td className="py-4 font-mono text-xs text-[#475569]">
                        {formatRupiah(asset.purchasePrice)}
                      </td>
                      <td className="py-4 text-center text-xs font-medium text-[#0f172a]">
                        {asset.quantity} unit
                      </td>
                      <td className="py-4 font-mono text-xs font-bold text-[#0f172a]">
                        {formatRupiah(asset.totalValue)}
                      </td>
                      <td className="py-4 text-center">
                        <AssetStatusBadge status={asset.status} />
                      </td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setFormState({ asset })}
                            disabled={locked(asset)}
                            aria-label="Ubah aset"
                            title={
                              locked(asset)
                                ? 'Terkunci: bulan pembelian sudah tutup buku, hanya bisa diubah statusnya'
                                : 'Ubah aset'
                            }
                            className="rounded-lg border border-[#e2e8f0] p-[7px] text-[#475569] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                              <img src={icMore} alt="Aksi" className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setStatusTarget(asset)}>
                                <RefreshCcw className="mr-2 size-3.5" />
                                Ubah Status
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={locked(asset)}
                                onClick={() => handleDelete(asset)}
                              >
                                <Trash2 className="mr-2 size-3.5" />
                                Hapus
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
          total={sorted.length}
          itemLabel="aset"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <AssetStatusLegend />

      <p className="text-[11px] leading-4 text-[#94a3b8]">
        Ubah & Hapus hanya tersedia selama bulan Tanggal Beli belum tutup buku (otomatis saat ganti
        bulan; bisa dibuka kembali di Keuangan › Cash Flow). Setelah itu koreksi lewat Ubah Status.
        Pembelian aset otomatis memotong saldo BEP di Keuangan › Cash Flow.
      </p>

      {formState && (
        <AssetFormModal
          asset={formState.asset}
          onClose={() => setFormState(null)}
          onSaved={(name, mode) => {
            setFormState(null);
            setFlash(`Aset "${name}" berhasil ${mode === 'edit' ? 'diperbarui' : 'ditambahkan'}.`);
            loadData();
          }}
        />
      )}

      {statusTarget && (
        <AssetStatusModal
          asset={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSaved={(name, status) => {
            setStatusTarget(null);
            setFlash(`Status aset "${name}" diubah menjadi ${STATUS_LABELS[status]}.`);
            loadData();
          }}
        />
      )}
    </div>
  );
}
