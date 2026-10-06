import { useEffect, useMemo, useState } from 'react';
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
import { deleteCategory, fetchCategories, fetchCategoryHistory } from '../../services/categories';
import { HistoryButton, HistoryModal } from '../../components/HistoryModal';
import { CATEGORY_HISTORY_FIELDS } from './historyFields';
import { getCategoryIconSrc } from '../../constants/categoryIcons';
import type { Category } from '../../types/category';
import CategoryProductsModal from './CategoryProductsModal';
import CategoryFormModal from './CategoryFormModal';
import icPlus from '../../assets/ui/plus.svg';
import icChevronRight from '../../assets/ui/chevron-right.svg';
import icMore from '../../assets/ui/more.svg';

type SortKey = 'name' | 'displayOrder' | 'productCount';

// Aktif = background gelap tebal, tidak aktif = abu-abu pudar
function ChannelBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs leading-5 ${
        active
          ? 'border-[#0f172a] bg-[#0f172a] font-semibold text-white'
          : 'border-[#e2e8f0] bg-[#f1f5f9] font-medium text-[#94a3b8]'
      }`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${active ? 'bg-white' : 'bg-[#cbd5e1]'}`} />
      {label}
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
  const [productsOf, setProductsOf] = useState<Category | null>(null);
  // null = tertutup, { id: undefined } = tambah, { id } = ubah
  const [formTarget, setFormTarget] = useState<{ id?: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((data) => !cancelled && setCategories(data))
      .catch((err) => !cancelled && setError(err.message ?? 'Gagal memuat kategori.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Pesan sukses dari form modal hilang sendiri setelah 4 detik
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  async function handleDelete(cat: Category) {
    if (!window.confirm(`Hapus kategori "${cat.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setActionError(null);
    try {
      await deleteCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setFlash(`Kategori "${cat.name}" berhasil dihapus.`);
    } catch (err: any) {
      setActionError(
        err?.code === '23503'
          ? `"${cat.name}" masih memiliki produk sehingga tidak bisa dihapus.`
          : err?.message ?? 'Gagal menghapus kategori.'
      );
      setReloadKey((k) => k + 1);
    }
  }

  function handleSort(key: string) {
    const k = key as SortKey;
    setSort((prev) =>
      prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
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
        title="Daftar Kategori"
        info="Modul ini mengatur pengelompokan menu kopi, makanan, dan minuman di Toko Kopi Irona serta tata letak tab kasir POS dan katalog pesanan online."
        action={
          <div className="flex items-center gap-3">
            <HistoryButton onClick={() => setHistoryOpen(true)} />
            <button
              onClick={() => setFormTarget({})}
              className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]"
            >
              <img src={icPlus} alt="" className="size-4" />
              Tambah Kategori
            </button>
          </div>
        }
      />

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-xs font-medium text-[#0f172a]">
          <CheckCircle2 className="size-4 text-[#059669]" />
          {flash}
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {actionError}
        </div>
      )}

      <SearchToolbar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Cari kategori..."
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
                <th className="py-[14px] text-center text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Status
                </th>
                <th className="py-[14px] pr-6 text-right text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat kategori...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-red-600">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && paged.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[#94a3b8]">
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
                          <p className="font-mono text-xs leading-4 text-[#94a3b8]">ID: {cat.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-center font-mono text-sm leading-5 text-[#334155]">
                      {cat.displayOrder}
                    </td>
                    <td className="py-4 text-center">
                      <button
                        type="button"
                        onClick={() => setProductsOf(cat)}
                        className="inline-flex items-center gap-1 font-mono text-sm leading-5 text-[#334155] hover:text-[#0f172a] hover:underline"
                      >
                        {cat.productCount} Produk
                        <img src={icChevronRight} alt="" className="size-3" />
                      </button>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center justify-center gap-2">
                        <ChannelBadge label="POS" active={cat.showInMenu} />
                        <ChannelBadge label="Online" active={cat.showOnline} />
                      </div>
                    </td>
                    <td className="py-4 pr-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                          <img src={icMore} alt="Aksi" className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => setFormTarget({ id: cat.id })}>
                            Ubah
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setProductsOf(cat)}>Lihat Produk</DropdownMenuItem>
                          {/* Hanya kategori kosong yang boleh dihapus; DB juga menolak lewat FK */}
                          <DropdownMenuItem
                            disabled={cat.productCount > 0}
                            title={cat.productCount > 0 ? 'Kosongkan produk di kategori ini dulu' : undefined}
                            onClick={() => handleDelete(cat)}
                          >
                            Hapus
                          </DropdownMenuItem>
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

      <CategoryProductsModal category={productsOf} onClose={() => setProductsOf(null)} />

      {formTarget && (
        <CategoryFormModal
          categoryId={formTarget.id}
          onClose={() => setFormTarget(null)}
          onSaved={(message) => {
            setFormTarget(null);
            setFlash(message);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {historyOpen && (
        <HistoryModal
          title="Riwayat Perubahan Kategori"
          load={fetchCategoryHistory}
          fields={CATEGORY_HISTORY_FIELDS}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}