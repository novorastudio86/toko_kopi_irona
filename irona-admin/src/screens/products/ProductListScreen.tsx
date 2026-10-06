import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleCheck,
  Info,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
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
import { fetchCategories } from '../../services/categories';
import {
  deleteProduct,
  fetchLowStockMap,
  fetchProductList,
  setProductActive,
} from '../../services/products';
import { formatPercent, formatRupiah } from '../../utils/format';
import type { Category } from '../../types/category';
import type { LowStockItem, ProductListItem } from '../../types/product';
import ProductFormModal from './product-form/ProductFormModal';
import ProductDetailModal from './ProductDetailModal';
import { HistoryButton, HistoryModal } from '../../components/HistoryModal';
import { fetchProductHistory } from '../../services/products';
import { productHistoryFields } from './historyFields';
import { LowStockBadge } from './LowStockBadge';
import icPlus from '../../assets/ui/plus.svg';
import icMore from '../../assets/ui/more.svg';

type SortKey = 'name' | 'categoryName' | 'totalCost' | 'sellingPrice' | 'margin';

type Row = ProductListItem & {
  categoryName: string;
  margin: number | null;
  marginPct: number | null;
  lowStock: LowStockItem[];
};

type FormState = { mode: 'create' } | { mode: 'edit'; id: string } | null;

function ChannelTag({ label, muted }: { label: string; muted: boolean }) {
  return (
    <span
      className={`rounded px-1.5 text-[10px] font-medium leading-4 text-white ${
        muted ? 'bg-[#94a3b8]' : 'bg-[#1e293b]'
      }`}
    >
      {label}
    </span>
  );
}

/** Banner peringatan di atas tabel */
function AlertBanner({
  count,
  message,
  linkLabel,
  onLink,
  onDismiss,
}: {
  count: string;
  message: string;
  linkLabel: string;
  onLink: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#e2e8f0] bg-white px-5 py-4 drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e11d48] text-xs font-bold text-white">
          !
        </span>
        <p className="text-sm leading-5 text-[#334155]">
          <span className="font-bold text-[#0f172a]">{count}</span> {message}{' '}
          <button onClick={onLink} className="font-semibold text-[#0f172a] underline underline-offset-2">
            {linkLabel}
          </button>
        </p>
      </div>
      <button onClick={onDismiss} aria-label="Tutup peringatan" className="text-[#94a3b8] hover:text-[#0f172a]">
        <X className="size-4" />
      </button>
    </div>
  );
}

export default function ProductListScreen() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lowStockMap, setLowStockMap] = useState<Map<string, LowStockItem[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // 'default' = resep belum diisi → bahan menipis → sisanya A-Z; klik header kolom untuk urutan lain
  const [sort, setSort] = useState<{ key: SortKey | 'default'; dir: SortDir }>({ key: 'default', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [form, setForm] = useState<FormState>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hideRecipeBanner, setHideRecipeBanner] = useState(false);
  const [hideStockBanner, setHideStockBanner] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const [flash, setFlash] = useState<string | null>(
    (location.state as { flash?: string } | null)?.flash ?? null
  );

  // Pesan sukses hilang otomatis setelah 4 detik
  useEffect(() => {
    if (!flash) return;
    if (location.state) navigate(location.pathname, { replace: true, state: null });
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  // Muat produk, kategori, dan data bahan menipis
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productData, categoryData, lowStock] = await Promise.all([
        fetchProductList(),
        fetchCategories(),
        fetchLowStockMap(),
      ]);
      setProducts(productData);
      setCategories(categoryData);
      setLowStockMap(lowStock);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat produk.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const rows = useMemo<Row[]>(() => {
    return products.map((p) => {
      const hasPrice = p.sellingPrice !== null && p.totalCost !== null && p.sellingPrice > 0;
      const margin = hasPrice ? p.sellingPrice! - p.totalCost! : null;
      return {
        ...p,
        categoryName: categoryNames.get(p.categoryId) ?? '—',
        margin,
        marginPct: margin !== null ? (margin / p.sellingPrice!) * 100 : null,
        lowStock: lowStockMap.get(p.id) ?? [],
      };
    });
  }, [products, categoryNames, lowStockMap]);

  const incompleteCount = rows.filter((r) => r.recipeStatus === 'belum_lengkap').length;
  const lowStockCount = rows.filter((r) => r.lowStock.length > 0).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q)) && (!categoryFilter || r.categoryId === categoryFilter)
    );
  }, [rows, search, categoryFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort.key === 'default') {
      const rank = (r: Row) => (r.recipeStatus === 'belum_lengkap' ? 0 : r.lowStock.length > 0 ? 1 : 2);
      return arr.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'id'));
    }
    const key = sort.key;
    arr.sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      // Nilai kosong (mis. resep belum diisi) selalu di bawah
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp =
        typeof va === 'string' ? va.localeCompare(vb as string, 'id') : (va as number) - (vb as number);
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

  async function handleToggleActive(row: Row) {
    const next = !row.isActive;
    if (
      !next &&
      !window.confirm(
        `Nonaktifkan "${row.name}"? Produk tidak akan bisa dipesan di kasir maupun web customer.`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await setProductActive(row.id, next);
      setProducts((prev) => prev.map((p) => (p.id === row.id ? { ...p, isActive: next } : p)));
      setFlash(`Produk "${row.name}" berhasil ${next ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal mengubah status produk.');
    }
  }

  async function handleDelete(row: Row) {
    if (!window.confirm(`Hapus "${row.name}" secara permanen? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }
    setActionError(null);
    try {
      await deleteProduct(row.id);
      setProducts((prev) => prev.filter((p) => p.id !== row.id));
      setFlash(`Produk "${row.name}" berhasil dihapus.`);
    } catch (err: any) {
      if (err?.code === '23503') {
        setActionError(
          `"${row.name}" sudah memiliki histori transaksi sehingga tidak bisa dihapus. Nonaktifkan saja produk ini.`
        );
      } else {
        setActionError(err?.message ?? 'Gagal menghapus produk.');
      }
    }
  }

  const detailRow = detailId ? rows.find((r) => r.id === detailId) : undefined;

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Daftar Produk"
        info="Kelola menu yang dijual: harga jual, margin terhadap total cost resep, dan kanal penjualannya."
        action={
          <div className="flex items-center gap-3">
            <HistoryButton onClick={() => setHistoryOpen(true)} />
            <button
              onClick={() => setForm({ mode: 'create' })}
              className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]"
            >
              <img src={icPlus} alt="" className="size-4" />
              Tambah Produk
            </button>
          </div>
        }
      />

      {/* Banner peringatan */}
      {!loading && incompleteCount > 0 && !hideRecipeBanner && (
        <AlertBanner
          count={`${incompleteCount} produk belum ada resep.`}
          message="Lengkapi master resep agar estimasi HPP dan pemotongan stok otomatis berjalan optimal."
          linkLabel="Lengkapi sekarang"
          onLink={() => navigate('/product/recipe')}
          onDismiss={() => setHideRecipeBanner(true)}
        />
      )}
      {!loading && lowStockCount > 0 && !hideStockBanner && (
        <AlertBanner
          count={`${lowStockCount} produk memakai bahan baku yang menipis.`}
          message="Segera lakukan stok masuk agar produk tidak kehabisan bahan saat dipesan."
          linkLabel="Lihat di Inventory"
          onLink={() => navigate('/inventory/manage-stock')}
          onDismiss={() => setHideStockBanner(true)}
        />
      )}

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-xs font-medium text-[#0f172a]">
          <CheckCircle2 className="size-4 text-[#059669]" />
          {flash}
        </div>
      )}

      {actionError && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{actionError}</span>
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
        placeholder="Cari nama produk..."
      >
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="w-48 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </SearchToolbar>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <SortableTh label="Nama Produk" sortKey="name" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="pl-6" />
                <SortableTh label="Kategori" sortKey="categoryName" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Total Cost" sortKey="totalCost" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Harga Jual" sortKey="sellingPrice" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Margin" sortKey="margin" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <th className="py-[14px] pr-6 text-right text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat produk...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-red-600">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#94a3b8]">
                    {search || categoryFilter
                      ? 'Tidak ada produk yang cocok dengan pencarian/filter.'
                      : 'Belum ada produk.'}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                paged.map((row, idx) => {
                  const incomplete = row.recipeStatus === 'belum_lengkap';
                  const inactive = !row.isActive;
                  const dimmed = inactive && !incomplete;

                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-[#f1f5f9] first:border-t-0 ${
                        dimmed
                          ? 'bg-[#f8fafc] opacity-80'
                          : idx % 2 === 1
                            ? 'bg-[rgba(248,250,252,0.6)]'
                            : ''
                      }`}
                    >
                      {/* Nama + badge */}
                      <td className="py-4 pl-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`text-sm font-semibold leading-5 ${
                                dimmed ? 'text-[#94a3b8]' : 'text-[#0f172a]'
                              }`}
                            >
                              {row.name}
                            </p>
                            {incomplete && (
                              <span className="inline-flex items-center gap-1 rounded border border-dashed border-[#f43f5e] bg-white px-2 py-[3px] text-xs font-medium leading-4 text-[#e11d48]">
                                <AlertTriangle className="size-3" />
                                Resep Belum Diisi
                              </span>
                            )}
                            {row.lowStock.length > 0 && (
                              <LowStockBadge
                                items={row.lowStock}
                                productUnit={row.unit}
                                onViewInventory={() => navigate('/inventory/manage-stock')}
                              />
                            )}
                            {dimmed && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-2 py-px text-xs font-medium leading-4 text-[#475569]">
                                <span className="size-1.5 rounded-full border border-[#64748b]" />
                                Nonaktif
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            {row.availableOnline && <ChannelTag label="Online" muted={dimmed} />}
                            {row.availableOffline && <ChannelTag label="Offline" muted={dimmed} />}
                          </div>
                        </div>
                      </td>

                      {/* Kategori */}
                      <td className="py-4 text-sm font-medium leading-5 text-[#64748b]">{row.categoryName}</td>

                      {/* Harga: diganti keterangan kalau resep belum diisi */}
                      {incomplete ? (
                        <td colSpan={3} className="py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-[13px] py-[5px] text-xs font-medium leading-4 text-[#64748b]">
                            <Info className="size-3.5" />
                            Isi resep terlebih dahulu di Master Resep
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="py-4 font-mono text-sm leading-5 text-[#64748b]">
                            {row.totalCost !== null ? formatRupiah(row.totalCost) : '—'}
                          </td>
                          <td
                            className={`py-4 font-mono text-sm font-bold leading-5 ${
                              dimmed ? 'text-[#64748b]' : 'text-[#0f172a]'
                            }`}
                          >
                            {row.sellingPrice !== null ? formatRupiah(row.sellingPrice) : '—'}
                          </td>
                          <td className="py-4">
                            {row.margin !== null && row.marginPct !== null ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-mono text-sm font-bold leading-5 ${
                                    dimmed ? 'text-[#64748b]' : 'text-[#0f172a]'
                                  }`}
                                >
                                  {formatRupiah(row.margin)}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold leading-4 text-white ${
                                    dimmed ? 'bg-[#64748b]' : 'bg-[#0f172a]'
                                  }`}
                                >
                                  {formatPercent(row.marginPct)}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono text-sm text-[#94a3b8]">—</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Aksi */}
                      <td className="py-4 pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                            <img src={icMore} alt="Aksi" className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setDetailId(row.id)}>
                              <Info className="mr-2 size-3.5" />
                              Detail Produk
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setForm({ mode: 'edit', id: row.id })}>
                              <Pencil className="mr-2 size-3.5" />
                              Ubah Data
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={incomplete} onClick={() => handleToggleActive(row)}>
                              {row.isActive ? (
                                <>
                                  <Ban className="mr-2 size-3.5" />
                                  Nonaktifkan
                                </>
                              ) : (
                                <>
                                  <CircleCheck className="mr-2 size-3.5" />
                                  Aktifkan
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(row)}>
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
          itemLabel="produk"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {/* Pop up Tambah / Ubah Produk */}
      {form && (
        <ProductFormModal
          productId={form.mode === 'edit' ? form.id : null}
          onClose={() => setForm(null)}
          onSaved={(name, mode) => {
            setForm(null);
            setFlash(`Produk "${name}" berhasil ${mode === 'edit' ? 'diperbarui' : 'ditambahkan'}.`);
            loadData();
          }}
        />
      )}

      {/* Pop up Detail Produk */}
      {detailId && (
        <ProductDetailModal
          productId={detailId}
          categoryName={detailRow?.categoryName ?? '—'}
          lowStockItems={detailRow?.lowStock ?? []}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const id = detailId;
            setDetailId(null);
            setForm({ mode: 'edit', id });
          }}
        />
      )}

      {historyOpen && (
        <HistoryModal
          title="Riwayat Perubahan Produk"
          load={fetchProductHistory}
          fields={productHistoryFields(categoryNames)}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}