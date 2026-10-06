import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Pencil, Power, Trash2, X } from 'lucide-react';
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
import { deletePromotion, fetchPromotions, setPromotionActive } from '../../services/promotions';
import type { Channel, Promotion, PromotionStatus } from '../../types/promotion';
import DiscountDetailModal from './DiscountDetailModal';
import DiscountFormModal from './DiscountFormModal';
import { PromotionStatusBadge } from './PromotionStatusBadge';
import {
  CHANNEL_LABELS,
  TYPE_LABELS,
  formatCriteria,
  formatDate,
  formatTargetValue,
} from './discountFormat';
import icPlus from '../../assets/ui/plus.svg';
import icMore from '../../assets/ui/more.svg';

type SortKey = 'name' | 'channel' | 'promoType' | 'discountValue' | 'startDate' | 'status';

export default function DiscountListScreen() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'' | Channel>('');
  const [statusFilter, setStatusFilter] = useState<'' | PromotionStatus>('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'startDate',
    dir: 'desc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formState, setFormState] = useState<{ promotion: Promotion | null } | null>(null);
  const [detail, setDetail] = useState<Promotion | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchPromotions());
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat diskon.');
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

  const count = (fn: (p: Promotion) => boolean) => items.filter(fn).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q)) &&
        (!channelFilter || p.channel === channelFilter) &&
        (!statusFilter || p.status === statusFilter)
    );
  }, [items, search, channelFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      const cmp =
        typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb), 'id');
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

  async function handleToggle(p: Promotion) {
    const activate = p.status === 'nonaktif';
    setActionError(null);
    try {
      await setPromotionActive(p.id, activate);
      setFlash(`Diskon "${p.name}" ${activate ? 'diaktifkan' : 'dinonaktifkan'}.`);
      loadData();
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal mengubah status diskon.');
    }
  }

  async function handleDelete(p: Promotion) {
    if (!window.confirm(`Hapus diskon "${p.name}" secara permanen?`)) return;
    setActionError(null);
    try {
      await deletePromotion(p.id);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      setFlash(`Diskon "${p.name}" berhasil dihapus.`);
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal menghapus diskon.');
    }
  }

  const thClass =
    'py-[14px] text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';
  const filterClass =
    'w-44 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Diskon"
        info="Atur potongan harga produk (offline/online) dan potongan ongkir (online). Kalau beberapa diskon memenuhi syarat, hanya potongan terbesar yang dipakai."
        badge={
          loading
            ? undefined
            : `${count((p) => p.status === 'aktif')} aktif · ${count((p) => p.status === 'nonaktif')} nonaktif · ${count((p) => p.status === 'kedaluwarsa')} kedaluwarsa`
        }
        action={
          <button
            onClick={() => setFormState({ promotion: null })}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]"
          >
            <img src={icPlus} alt="" className="size-4" />
            Tambah Diskon
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
        placeholder="Cari nama diskon..."
      >
        <div className="flex items-center gap-2">
          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value as '' | Channel);
              setPage(1);
            }}
            className={filterClass}
          >
            <option value="">Semua Channel ({items.length})</option>
            <option value="offline">Offline ({count((p) => p.channel === 'offline')})</option>
            <option value="online">Online ({count((p) => p.channel === 'online')})</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as '' | PromotionStatus);
              setPage(1);
            }}
            className={filterClass}
          >
            <option value="">Semua Status ({items.length})</option>
            <option value="aktif">Aktif ({count((p) => p.status === 'aktif')})</option>
            <option value="nonaktif">Nonaktif ({count((p) => p.status === 'nonaktif')})</option>
            <option value="kedaluwarsa">
              Kedaluwarsa ({count((p) => p.status === 'kedaluwarsa')})
            </option>
          </select>
          <button
            onClick={() => {
              setSearch('');
              setChannelFilter('');
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
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <SortableTh
                  label="Nama Diskon"
                  sortKey="name"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  className="pl-6"
                />
                <SortableTh
                  label="Channel"
                  sortKey="channel"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Tipe"
                  sortKey="promoType"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Sasaran & Nilai"
                  sortKey="discountValue"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Periode Berlaku"
                  sortKey="startDate"
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
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat diskon...
                  </td>
                </tr>
              )}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#94a3b8]">
                    {search || channelFilter || statusFilter
                      ? 'Tidak ada diskon yang cocok.'
                      : 'Belum ada diskon.'}
                  </td>
                </tr>
              )}

              {!loading &&
                paged.map((p) => {
                  const expired = p.status === 'kedaluwarsa';
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-[#f1f5f9] first:border-t-0 ${expired ? 'bg-[#fcfcfd]' : ''}`}
                    >
                      <td className="py-4 pl-6 pr-3">
                        <button onClick={() => setDetail(p)} className="text-left">
                          <span
                            className={`text-xs font-semibold hover:underline ${expired ? 'text-[#64748b]' : 'text-[#0f172a]'}`}
                          >
                            {p.name}
                          </span>
                          <span className="block pt-0.5 text-[11px] text-[#94a3b8]">
                            {p.targetCustomer === 'member' ? 'Member' : 'Semua'} ·{' '}
                            {formatCriteria(p)}
                          </span>
                        </button>
                      </td>
                      <td className="py-4 pr-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            p.channel === 'online'
                              ? 'bg-[#eff6ff] text-[#1d4ed8]'
                              : 'bg-[#f1f5f9] text-[#334155]'
                          }`}
                        >
                          {CHANNEL_LABELS[p.channel]}
                        </span>
                      </td>
                      <td className="py-4 pr-3">
                        <span className="inline-flex rounded-md border border-[#cbd5e1] bg-white px-2 py-0.5 text-[10px] font-bold text-[#334155]">
                          {TYPE_LABELS[p.promoType]}
                          {p.channel === 'online' && p.promoType === 'manual' ? ' · Voucher' : ''}
                        </span>
                      </td>
                      <td className="py-4 pr-3 font-mono text-xs font-bold text-[#0f172a]">
                        {formatTargetValue(p)}
                      </td>
                      <td className="py-4 pr-3 text-xs text-[#475569]">
                        {formatDate(p.startDate)}
                        <span className="block text-[11px] text-[#94a3b8]">
                          s/d {formatDate(p.endDate)}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        <PromotionStatusBadge status={p.status} isUpcoming={p.isUpcoming} />
                      </td>
                      <td className="py-4 pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                            <img src={icMore} alt="Aksi" className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setDetail(p)}>
                              <Eye className="mr-2 size-3.5" />
                              Detail
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={expired}
                              onClick={() => setFormState({ promotion: p })}
                            >
                              <Pencil className="mr-2 size-3.5" />
                              Ubah
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={expired} onClick={() => handleToggle(p)}>
                              <Power className="mr-2 size-3.5" />
                              {p.status === 'nonaktif' ? 'Aktifkan' : 'Nonaktifkan'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={expired || p.usedCount > 0 || p.claimCount > 0}
                              onClick={() => handleDelete(p)}
                            >
                              <Trash2 className="mr-2 size-3.5" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
          itemLabel="diskon"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <p className="text-[11px] leading-4 text-[#94a3b8]">
        Diskon Kedaluwarsa jadi arsip permanen — Ubah & Hapus dinonaktifkan. Diskon yang sudah
        pernah dipakai/diklaim tidak bisa dihapus, cukup dinonaktifkan.
      </p>

      {formState && (
        <DiscountFormModal
          promotion={formState.promotion}
          onClose={() => setFormState(null)}
          onSaved={(name, mode) => {
            setFormState(null);
            setFlash(
              `Diskon "${name}" berhasil ${mode === 'edit' ? 'diperbarui' : 'ditambahkan'}.`
            );
            loadData();
          }}
        />
      )}

      {detail && <DiscountDetailModal promotion={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
