import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Coins, MessageCircle, Power, Trash2, X } from 'lucide-react';
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
import { deleteCustomer, fetchCustomers, whatsappLink } from '../../services/customers';
import { formatRupiah } from '../../utils/format';
import type { Customer } from '../../types/customer';
import CustomerDetailModal from './CustomerDetailModal';
import CustomerPointsModal from './CustomerPointsModal';
import CustomerStatusModal from './CustomerStatusModal';
import icMore from '../../assets/ui/more.svg';

type SortKey =
  | 'name'
  | 'phoneNumber'
  | 'totalTransactions'
  | 'totalSpent'
  | 'pointsBalance'
  | 'lastTransactionAt'
  | 'isActive';
type StatusFilter = '' | 'aktif' | 'nonaktif';

/** "3 hari lalu" / "2 bulan lalu" — memudahkan cari member yang lama tidak order */
function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'hari ini';
  if (days === 1) return 'kemarin';
  if (days < 30) return `${days} hari lalu`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} bulan lalu` : `${Math.floor(months / 12)} tahun lalu`;
}

export default function CustomerListScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'lastTransactionAt',
    dir: 'desc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [detail, setDetail] = useState<Customer | null>(null);
  const [pointsFor, setPointsFor] = useState<Customer | null>(null);
  const [statusFor, setStatusFor] = useState<Customer | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await fetchCustomers());
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat data member.');
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

  const activeCount = customers.filter((c) => c.isActive).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return customers.filter(
      (c) =>
        (!q ||
          c.name.toLowerCase().includes(q) ||
          (qDigits && c.phoneNumber.replace(/\D/g, '').includes(qDigits))) &&
        (!statusFilter || (statusFilter === 'aktif' ? c.isActive : !c.isActive))
    );
  }, [customers, search, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      // Member yang belum pernah transaksi selalu di paling bawah untuk kolom Transaksi Terakhir
      if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
      const cmp =
        typeof va === 'number'
          ? va - (vb as number)
          : typeof va === 'boolean'
            ? Number(va) - Number(vb)
            : String(va).localeCompare(String(vb), 'id');
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

  async function handleDelete(c: Customer) {
    if (
      !window.confirm(
        `Hapus member "${c.name}"? Data member dan riwayat poinnya akan dihapus permanen.`
      )
    )
      return;
    setActionError(null);
    try {
      await deleteCustomer(c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      setFlash(`Member "${c.name}" berhasil dihapus.`);
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal menghapus member.');
    }
  }

  function afterAction(message: string) {
    setPointsFor(null);
    setStatusFor(null);
    setFlash(message);
    loadData();
  }

  const thClass =
    'py-[14px] text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Daftar Membership"
        info="Member mendaftar sendiri dari Web Customer. Di sini admin memantau transaksi & poin, menyesuaikan poin, dan menonaktifkan member."
        badge={loading ? undefined : `${customers.length} member · ${activeCount} aktif`}
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
        placeholder="Cari nama atau no. telepon..."
      >
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="w-48 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
          >
            <option value="">Semua Status ({customers.length})</option>
            <option value="aktif">Aktif ({activeCount})</option>
            <option value="nonaktif">Nonaktif ({customers.length - activeCount})</option>
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
          <table className="w-full min-w-[1080px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <SortableTh
                  label="Nama"
                  sortKey="name"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  className="pl-6"
                />
                <SortableTh
                  label="No. Telp"
                  sortKey="phoneNumber"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Total Transaksi"
                  sortKey="totalTransactions"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  align="center"
                />
                <SortableTh
                  label="Total Belanja"
                  sortKey="totalSpent"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Poin"
                  sortKey="pointsBalance"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  align="center"
                />
                <SortableTh
                  label="Transaksi Terakhir"
                  sortKey="lastTransactionAt"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Status"
                  sortKey="isActive"
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
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat data member...
                  </td>
                </tr>
              )}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    {search || statusFilter
                      ? 'Tidak ada member yang cocok.'
                      : 'Belum ada member. Member mendaftar sendiri dari Web Customer.'}
                  </td>
                </tr>
              )}

              {!loading &&
                paged.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t border-[#f1f5f9] first:border-t-0 ${c.isActive ? '' : 'bg-[#fcfcfd]'}`}
                  >
                    <td className="py-4 pl-6">
                      <button onClick={() => setDetail(c)} className="text-left">
                        <span
                          className={`text-sm font-semibold hover:underline ${c.isActive ? 'text-[#0f172a]' : 'text-[#64748b]'}`}
                        >
                          {c.name}
                        </span>
                        {c.totalTransactions === 0 && (
                          <span className="ml-1.5 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-xs font-bold text-[#1d4ed8]">
                            Member Baru
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-4 font-mono text-sm text-[#475569]">{c.phoneNumber}</td>
                    <td className="py-4 text-center text-sm font-medium text-[#0f172a]">
                      {c.totalTransactions}
                    </td>
                    <td className="py-4 font-mono text-sm font-bold text-[#0f172a]">
                      {formatRupiah(c.totalSpent)}
                    </td>
                    <td className="py-4 text-center font-mono text-sm font-bold text-[#0f172a]">
                      {c.pointsBalance}
                    </td>
                    <td className="py-4 text-sm text-[#475569]">
                      {c.lastTransactionAt ? (
                        <>
                          {new Date(c.lastTransactionAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                          <span className="block text-xs text-[#94a3b8]">
                            {relativeDays(c.lastTransactionAt)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[#94a3b8]">—</span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {c.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-[#0f172a] px-2.5 py-0.5 text-xs font-bold text-white">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold text-[#475569]">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-4 pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={whatsappLink(c.phoneNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Hubungi via WhatsApp"
                          className="rounded-lg border border-[#e2e8f0] p-[7px] text-[#059669] hover:bg-[#f0fdf4]"
                        >
                          <MessageCircle className="size-3.5" />
                        </a>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                            <img src={icMore} alt="Aksi" className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setPointsFor(c)}>
                              <Coins className="mr-2 size-3.5" />
                              Sesuaikan Poin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFor(c)}>
                              <Power className="mr-2 size-3.5" />
                              {c.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={c.allTransactions > 0}
                              onClick={() => handleDelete(c)}
                              title={
                                c.allTransactions > 0
                                  ? 'Sudah punya transaksi — nonaktifkan saja'
                                  : undefined
                              }
                            >
                              <Trash2 className="mr-2 size-3.5" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
          itemLabel="member"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <p className="text-[11px] leading-4 text-[#94a3b8]">
        Total Transaksi & Belanja hanya dari transaksi resmi — transaksi dibatalkan dan refund penuh
        tidak dihitung, refund sebagian mengurangi Total Belanja. Belanja = nilai produk, tanpa
        ongkir/biaya layanan. Member yang sudah punya transaksi tidak bisa dihapus, cukup
        dinonaktifkan.
      </p>

      {detail && <CustomerDetailModal customer={detail} onClose={() => setDetail(null)} />}
      {pointsFor && (
        <CustomerPointsModal
          customer={pointsFor}
          onClose={() => setPointsFor(null)}
          onSaved={afterAction}
        />
      )}
      {statusFor && (
        <CustomerStatusModal
          customer={statusFor}
          onClose={() => setStatusFor(null)}
          onSaved={afterAction}
        />
      )}
    </div>
  );
}
