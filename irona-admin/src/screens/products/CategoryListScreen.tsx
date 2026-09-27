import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
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
import { fetchCategories } from '../../services/categories';
import { getCategoryIconSrc } from '../../constants/categoryIcons';
import type { Category } from '../../types/category';
import icPlus from '../../assets/ui/plus.svg';
import icChevronRight from '../../assets/ui/chevron-right.svg';
import icMore from '../../assets/ui/more.svg';

type SortKey = 'name' | 'displayOrder' | 'productCount';

/** Nama tab di Web Customer: nama online kalau ada, kalau tidak nama kategori */
function onlineLabelOf(c: Category): string {
  return (c.onlineName ?? c.name).trim();
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  const color = active ? 'text-[#1e293b]' : 'text-[#94a3b8]';
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-[#e2e8f0] bg-[#f1f5f9] py-[5px] pl-[11px] pr-4">
      <span className={`size-1.5 shrink-0 rounded-full ${active ? 'bg-[#1e293b]' : 'bg-[#94a3b8]'}`} />
      <span className={`text-center text-[11px] font-semibold leading-4 ${color}`}>
        Tampil di
        <br />
        {label}
      </span>
    </span>
  );
}

export default function CategoryListScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'displayOrder', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const navigate = useNavigate();
  const location = useLocation();
  const [flash, setFlash] = useState<string | null>(
    (location.state as { flash?: string } | null)?.flash ?? null
  );

  // Tampilkan pesan sukses dari form, lalu hapus dari history supaya tidak muncul lagi saat refresh
  useEffect(() => {
    if (!flash) return;
    navigate(location.pathname, { replace: true, state: null });
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((data) => !cancelled && setCategories(data))
      .catch((err) => !cancelled && setError(err.message ?? 'Gagal memuat kategori.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSort(key: string) {
    const k = key as SortKey;
    setSort((prev) =>
      prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }
    );
  }

  // Cari berdasarkan nama kategori maupun nama tab di Web Customer
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.onlineName ?? '').toLowerCase().includes(q)
    );
  }, [categories, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      const cmp =
        typeof va === 'string' ? va.localeCompare(vb as string, 'id') : (va as number) - (vb as number);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-8">
      <PageHeader
        breadcrumb={['Produk & Menu', 'Daftar Kategori']}
        title="Daftar Kategori"
        info="Kelola kategori produk: urutan tampil, visibilitas di menu kasir, dan tab kategori di web customer."
        action={
          <button
            onClick={() => navigate('/product/category/new')}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]"
          >
            <img src={icPlus} alt="" className="size-4" />
            Tambah Kategori
          </button>
        }
      />

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-xs font-medium text-[#0f172a]">
          <CheckCircle2 className="size-4 text-[#059669]" />
          {flash}
        </div>
      )}

      <SearchToolbar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Cari kategori atau tab web..."
      />

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <SortableTh
                  label="Nama Kategori"
                  sortKey="name"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  className="pl-6"
                />
                <SortableTh
                  label="Urutan"
                  sortKey="displayOrder"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  align="center"
                />
                <SortableTh
                  label="Jumlah Produk"
                  sortKey="productCount"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  align="center"
                />
                <th className="py-[14px] text-center text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]">
                  Status
                </th>
                <th className="py-[14px] pr-6 text-right text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat kategori...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-red-600">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && paged.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-[#94a3b8]">
                    {search ? 'Tidak ada kategori yang cocok dengan pencarian.' : 'Belum ada kategori.'}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                paged.map((cat, idx) => (
                  <tr
                    key={cat.id}
                    className={`border-t border-[#f1f5f9] first:border-t-0 ${
                      idx % 2 === 1 ? 'bg-[rgba(248,250,252,0.6)]' : ''
                    }`}
                  >
                    <td className="py-4 pl-6">
                      <div className="flex items-center gap-3">
                        <img src={getCategoryIconSrc(cat.icon)} alt="" className="size-6 shrink-0" />
                        <div>
                          <p className="text-sm font-bold leading-5 text-[#0f172a]">{cat.name}</p>
                          <p className="font-mono text-[11px] leading-4 text-[#94a3b8]">ID: {cat.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <span className="inline-flex min-w-7 justify-center rounded-lg bg-[#f1f5f9] px-2 py-1 font-mono text-sm font-bold leading-5 text-[#334155]">
                        {cat.displayOrder}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-[13px] py-[5px] text-xs font-semibold leading-4 text-[#1e293b]"
                      >
                        {cat.productCount} Produk
                        <img src={icChevronRight} alt="" className="size-3" />
                      </button>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center justify-center gap-2">
                          <StatusBadge label="Menu" active={cat.showInMenu} />
                          <StatusBadge label="Online" active={cat.showOnline} />
                        </div>
                        {cat.showOnline && (
                          <p className="text-[11px] leading-4 text-[#64748b]">
                            Tab web:{' '}
                            <span className="font-['Bitcheese',cursive] text-[12px] text-[#2e2c2c]">
                              {onlineLabelOf(cat)}
                            </span>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 pr-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                          <img src={icMore} alt="Aksi" className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => navigate(`/product/category/${cat.id}/edit`)}>
                            Ubah
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>Lihat Produk</DropdownMenuItem>
                          <DropdownMenuItem disabled>Hapus</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          itemLabel="kategori"
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