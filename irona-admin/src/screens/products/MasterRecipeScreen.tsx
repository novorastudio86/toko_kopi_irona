import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Package,
  Pencil,
  Plus,
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
import { fetchRecipeSources } from '../../services/products';
import {
  deleteRacikan,
  fetchRacikanLowStockMap,
  fetchRecipeComponents,
  fetchRecipeHistory,
  fetchRecipeList,
} from '../../services/recipes';
import { HistoryButton, HistoryModal } from '../../components/HistoryModal';
import { RECIPE_HISTORY_FIELDS } from './historyFields';
import { formatPercent, formatQty, formatRupiah, formatRupiahDetail } from '../../utils/format';
import type { LowStockItem, RecipeSource } from '../../types/product';
import type { RecipeComponentRow, RecipeListItem } from '../../types/recipe';
import ProductRecipeModal from './recipe-form/ProductRecipeModal';
import RacikanFormModal from './recipe-form/RacikanFormModal';
import { LowStockBadge } from './LowStockBadge';
import icMore from '../../assets/ui/more.svg';

type SortKey = 'name' | 'componentCount' | 'cost' | 'totalCost';
type TypeFilter = '' | 'produk' | 'racikan';

type Row = RecipeListItem & { lowStock: LowStockItem[] };

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

/** Kartu angka di baris expand (Cost, Add Cost, dst) */
function SummaryCard({ label, badge, value }: { label: string; badge?: string; value: string }) {
  return (
    <div className="flex min-w-[130px] flex-1 flex-col justify-between rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="text-xs leading-4 text-[#64748b]">{label}</span>
        {badge && (
          <span className="rounded bg-[#e2e8f0] px-1.5 py-0.5 text-xs font-bold leading-4 text-[#334155]">
            {badge}
          </span>
        )}
      </div>
      <span className="pt-1 font-mono text-sm font-bold leading-5 text-[#0f172a]">{value}</span>
    </div>
  );
}

function SourceBadge({ type }: { type: 'bahan_baku' | 'racikan' }) {
  return type === 'racikan' ? (
    <span className="rounded border border-[#94a3b8] bg-[#f8fafc] px-[7px] py-px text-xs leading-4 text-[#334155]">
      Racikan
    </span>
  ) : (
    <span className="rounded border border-[#cbd5e1] bg-[#f1f5f9] px-[7px] py-px text-xs leading-4 text-[#475569]">
      Bahan Baku
    </span>
  );
}

export default function MasterRecipeScreen() {
  const navigate = useNavigate();

  const [items, setItems] = useState<RecipeListItem[]>([]);
  const [sources, setSources] = useState<RecipeSource[]>([]);
  const [lowStockMap, setLowStockMap] = useState<Map<string, LowStockItem[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [sort, setSort] = useState<{ key: SortKey | 'default'; dir: SortDir }>({ key: 'default', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [componentCache, setComponentCache] = useState<Record<string, RecipeComponentRow[]>>({});
  const [loadingComponents, setLoadingComponents] = useState<string | null>(null);

  const [recipeModal, setRecipeModal] = useState<{ productId: string | null } | null>(null);
  const [racikanModal, setRacikanModal] = useState<{ racikanId: string | null } | null>(null);
  const [hideRecipeBanner, setHideRecipeBanner] = useState(false);
  const [hideStockBanner, setHideStockBanner] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, srcs, lowStock] = await Promise.all([
        fetchRecipeList(),
        fetchRecipeSources(),
        fetchRacikanLowStockMap(),
      ]);
      setItems(list);
      setSources(srcs);
      setLowStockMap(lowStock);
      setComponentCache({});
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat master resep.');
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

  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.key, s])), [sources]);

  const rows = useMemo<Row[]>(
    () =>
      items.map((item) => ({
        ...item,
        lowStock: item.recipeType === 'racikan' ? (lowStockMap.get(item.id) ?? []) : [],
      })),
    [items, lowStockMap]
  );

  const incompleteProducts = rows.filter((r) => r.recipeType === 'produk' && r.recipeStatus === 'belum_lengkap');
  const lowStockRacikan = rows.filter((r) => r.lowStock.length > 0).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) => (!q || r.name.toLowerCase().includes(q)) && (!typeFilter || r.recipeType === typeFilter)
    );
  }, [rows, search, typeFilter]);

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

  async function toggleExpand(row: Row) {
    if (expanded === row.id) {
      setExpanded(null);
      return;
    }
    setExpanded(row.id);
    if (componentCache[row.id]) return;

    setLoadingComponents(row.id);
    try {
      const raw = await fetchRecipeComponents(row.recipeType, row.id);
      const mapped: RecipeComponentRow[] = raw.map((c) => {
        const source = sourceMap.get(`${c.type}:${c.id}`);
        const unitPrice = source?.unitPrice ?? 0;
        return {
          key: `${c.type}:${c.id}`,
          type: c.type,
          name: source?.name ?? '(bahan nonaktif)',
          quantity: c.quantity,
          unitName: source?.unitName ?? '',
          unitPrice,
          subtotal: c.quantity * unitPrice,
        };
      });
      setComponentCache((prev) => ({ ...prev, [row.id]: mapped }));
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal memuat komponen resep.');
    } finally {
      setLoadingComponents(null);
    }
  }

  async function handleDeleteRacikan(row: Row) {
    if (!window.confirm(`Hapus racikan "${row.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setActionError(null);
    try {
      await deleteRacikan(row.id);
      setFlash(`Racikan "${row.name}" berhasil dihapus.`);
      loadData();
    } catch (err: any) {
      if (err?.code === '23503') {
        setActionError(
          `Racikan "${row.name}" masih dipakai di resep produk atau racikan lain, jadi tidak bisa dihapus.`
        );
      } else {
        setActionError(err?.message ?? 'Gagal menghapus racikan.');
      }
    }
  }

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Master Resep"
        info="Formula produk dan racikan. Biaya bahan selalu mengikuti harga pembelian terkini di Inventory."
        action={
          <div className="flex items-center gap-3">
            <HistoryButton onClick={() => setHistoryOpen(true)} />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]">
                <Plus className="size-4" />
                Tambah Resep
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[340px] p-2">
                <DropdownMenuItem
                  disabled={incompleteProducts.length === 0}
                  onClick={() => setRecipeModal({ productId: null })}
                  className="items-start gap-3 rounded-lg p-3"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                    <Package className="size-4" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#0f172a]">Tambah Resep Produk</span>
                      {incompleteProducts.length === 0 && (
                        <span className="shrink-0 rounded bg-[#f1f5f9] px-2 py-0.5 text-xs font-semibold text-[#475569]">
                          ✓ Semua Terisi
                        </span>
                      )}
                    </span>
                    <span className="whitespace-normal text-xs leading-5 text-[#64748b]">
                      {incompleteProducts.length === 0
                        ? 'Semua menu produk yang butuh formula sudah memiliki master resep aktif.'
                        : 'Hubungkan bahan baku & hitung HPP otomatis untuk menu minuman/makanan jadi di POS kasir.'}
                    </span>
                  </span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setRacikanModal({ racikanId: null })}
                  className="items-start gap-3 rounded-lg p-3"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                    <Boxes className="size-4" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[#0f172a]">Tambah Resep Racikan</span>
                    <span className="whitespace-normal text-xs leading-5 text-[#64748b]">
                      Formulasi bahan setengah jadi/pre-mix in-house (misal: Sirup Gula Aren Organik, Blend
                      Espresso).
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {!loading && incompleteProducts.length > 0 && !hideRecipeBanner && (
        <AlertBanner
          count={`${incompleteProducts.length} produk belum ada resep.`}
          message="Lengkapi master resep agar estimasi HPP dan pemotongan stok otomatis berjalan optimal."
          linkLabel="Lengkapi sekarang"
          onLink={() => setRecipeModal({ productId: null })}
          onDismiss={() => setHideRecipeBanner(true)}
        />
      )}
      {!loading && lowStockRacikan > 0 && !hideStockBanner && (
        <AlertBanner
          count={`${lowStockRacikan} racikan bahan bakunya menipis.`}
          message="Bahan baku penyusun racikan berikut sudah di bawah batas minimum, segera restok."
          linkLabel="Lihat di Kelola Stok"
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
        placeholder="Cari nama produk/racikan..."
      >
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as TypeFilter);
            setPage(1);
          }}
          className="w-44 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
        >
          <option value="">Semua Tipe</option>
          <option value="produk">Produk</option>
          <option value="racikan">Racikan</option>
        </select>
      </SearchToolbar>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className="w-12" />
                <SortableTh label="Nama" sortKey="name" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <th className="py-[14px] text-center text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Tipe
                </th>
                <SortableTh
                  label="Jumlah Bahan"
                  sortKey="componentCount"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  align="center"
                />
                <SortableTh label="Cost" sortKey="cost" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <th className="py-[14px] text-left text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Add Cost
                </th>
                <SortableTh
                  label="Total Cost"
                  sortKey="totalCost"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <th className="py-[14px] pr-6 text-right text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat master resep...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-red-600">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    {search || typeFilter ? 'Tidak ada resep yang cocok.' : 'Belum ada resep.'}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                paged.map((row) => {
                  const isOpen = expanded === row.id;
                  const components = componentCache[row.id];
                  const isProduct = row.recipeType === 'produk';
                  const incomplete = row.recipeStatus === 'belum_lengkap';
                  const margin =
                    row.sellingPrice !== null && row.sellingPrice > 0 ? row.sellingPrice - row.totalCost : null;
                  // Penanda baris yang dibuka: hitam default, merah kalau ada badge alert
                  const marker = isOpen
                    ? incomplete || row.lowStock.length > 0
                      ? 'shadow-[inset_4px_0_0_#e11d48]'
                      : 'shadow-[inset_4px_0_0_#0f172a]'
                    : '';

                  return (
                    <>
                      <tr
                        key={row.id}
                        className={`border-t border-[#f1f5f9] first:border-t-0 ${isOpen ? 'bg-[rgba(248,250,252,0.7)]' : ''}`}
                      >
                        <td className={`py-4 pl-4 ${marker}`}>
                          <button
                            onClick={() => toggleExpand(row)}
                            aria-label={isOpen ? 'Tutup rincian' : 'Lihat rincian'}
                            className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                          >
                            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold leading-5 text-[#0f172a]">{row.name}</span>
                            {incomplete && (
                              <span className="rounded border border-dashed border-[#f43f5e] bg-white px-2 py-[3px] text-xs font-medium leading-4 text-[#e11d48]">
                                Resep Belum Diisi
                              </span>
                            )}
                            {row.lowStock.length > 0 && (
                              <LowStockBadge
                                items={row.lowStock}
                                productUnit={row.unit ?? 'batch'}
                                onViewInventory={() => navigate('/inventory/manage-stock')}
                              />
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          {isProduct ? (
                            <span className="rounded bg-[#1e293b] px-2 py-0.5 text-xs font-medium leading-4 text-white">
                              Produk
                            </span>
                          ) : (
                            <span className="rounded border border-[#cbd5e1] bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium leading-4 text-[#334155]">
                              Racikan
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-center text-sm text-[#475569]">{row.componentCount} Bahan</td>
                        <td className="py-4 font-mono text-sm text-[#64748b]">{formatRupiah(row.cost)}</td>
                        <td className="py-4 text-sm text-[#475569]">
                          {formatQty(row.addCostPercentage)}%{' '}
                          <span className="font-mono text-[#64748b]">
                            (+{formatRupiah(row.cost * (row.addCostPercentage / 100))})
                          </span>
                        </td>
                        <td className="py-4 font-mono text-sm font-bold text-[#0f172a]">
                          {formatRupiah(row.totalCost)}
                        </td>
                        <td className="py-4 pr-6 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                              <img src={icMore} alt="Aksi" className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {isProduct ? (
                                <DropdownMenuItem onClick={() => setRecipeModal({ productId: row.id })}>
                                  <Pencil className="mr-2 size-3.5" />
                                  {incomplete ? 'Isi Resep' : 'Ubah Resep'}
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem onClick={() => setRacikanModal({ racikanId: row.id })}>
                                    <Pencil className="mr-2 size-3.5" />
                                    Ubah Racikan
                                  </DropdownMenuItem>
                                  {row.productionMode === 'batch' && (
                                    <DropdownMenuItem onClick={() => navigate('/inventory/manage-stock')}>
                                      <Boxes className="mr-2 size-3.5" />
                                      Lihat di Kelola Stok
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteRacikan(row)}>
                                    <Trash2 className="mr-2 size-3.5" />
                                    Hapus
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${row.id}-detail`} className="border-t border-[#e2e8f0] bg-[#f8fafc]">
                          <td colSpan={8} className="px-12 py-3">
                            <div className="flex flex-col gap-3 rounded-lg border border-[#cbd5e1] bg-white p-[17px] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                              {/* Judul breakdown */}
                              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2.5">
                                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.6px] text-[#0f172a]">
                                  <Info className="size-4" />
                                  {isProduct
                                    ? `Breakdown Komposisi Bahan & Racikan (Porsi per 1 ${row.unit ?? 'Porsi'})`
                                    : 'Breakdown Formula Racikan (In-House)'}
                                </p>
                                <span className="font-mono text-xs leading-4 text-[#64748b]">
                                  {isProduct
                                    ? `SKU: ${row.sku ?? '-'}`
                                    : `ID Racikan: ${row.id.slice(0, 8).toUpperCase()}`}
                                </span>
                              </div>

                              {/* Meta racikan */}
                              {!isProduct && (
                                <div className="flex flex-wrap items-center gap-2 rounded border border-[#e2e8f0] bg-[#f8fafc] p-[9px]">
                                  <span className="rounded bg-[#0f172a] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.25px] text-white">
                                    {row.productionMode === 'batch' ? 'Batch' : 'Made to Order'}
                                  </span>
                                  <span className="text-sm text-[#cbd5e1]">•</span>
                                  <span className="rounded border border-[#cbd5e1] bg-[#f1f5f9] px-[9px] py-[3px] text-xs leading-4 text-[#64748b]">
                                    Yield:{' '}
                                    <span className="font-bold text-[#0f172a]">
                                      {formatQty(row.yieldQty ?? 0)} Porsi
                                    </span>
                                  </span>
                                  <span className="rounded border border-[#cbd5e1] bg-[#f1f5f9] px-[9px] py-[3px] text-xs leading-4 text-[#64748b]">
                                    Total Produksi:{' '}
                                    <span className="font-bold text-[#0f172a]">
                                      {formatQty(row.totalOutputQty ?? 0)} {row.unit ?? ''}
                                    </span>
                                  </span>
                                  {row.cashierCanProduce && (
                                    <span className="ml-auto rounded border border-[#cbd5e1] bg-[#e2e8f0] px-[9px] py-[3px] text-xs font-semibold leading-4 text-[#1e293b]">
                                      Kasir bisa update stok
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Tabel komponen */}
                              {loadingComponents === row.id && (
                                <p className="py-4 text-center text-sm text-[#94a3b8]">Memuat komponen...</p>
                              )}

                              {components && components.length === 0 && (
                                <p className="rounded border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-center text-sm text-[#64748b]">
                                  Resep belum diisi.
                                </p>
                              )}

                              {components && components.length > 0 && (
                                <table className="w-full border-collapse">
                                  <thead className="border-b border-[#e2e8f0]">
                                    <tr className="text-xs font-bold uppercase leading-4 text-[#64748b]">
                                      <th className="px-2 py-1.5 text-left">Nama Bahan</th>
                                      <th className="px-2 py-1.5 text-left">Sumber</th>
                                      <th className="px-2 py-1.5 text-left">Takaran</th>
                                      <th className="px-2 py-1.5 text-left">Harga Satuan</th>
                                      <th className="px-2 py-1.5 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {components.map((c) => (
                                      <tr key={c.key} className="border-t border-[#f1f5f9] first:border-t-0">
                                        <td className="px-2 py-2.5 text-sm text-[#1e293b]">{c.name}</td>
                                        <td className="px-2 py-2">
                                          <SourceBadge type={c.type} />
                                        </td>
                                        <td className="px-2 py-2.5 text-sm text-[#1e293b]">
                                          {formatQty(c.quantity)} {c.unitName}
                                        </td>
                                        <td className="px-2 py-2.5 font-mono text-sm text-[#475569]">
                                          {formatRupiahDetail(c.unitPrice)} / {c.unitName}
                                        </td>
                                        <td className="px-2 py-2.5 text-right font-mono text-sm text-[#1e293b]">
                                          {formatRupiah(c.subtotal)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}

                              {/* Kartu ringkasan */}
                              <div className="flex flex-wrap gap-2.5 border-t border-[#cbd5e1] pt-4">
                                <SummaryCard label="Cost" value={formatRupiah(row.cost)} />
                                <SummaryCard
                                  label="Add Cost"
                                  badge={`${formatQty(row.addCostPercentage)}%`}
                                  value={`+${formatRupiah(row.cost * (row.addCostPercentage / 100))}`}
                                />
                                <SummaryCard label="Total Cost" value={formatRupiah(row.totalCost)} />

                                {isProduct ? (
                                  <>
                                    <SummaryCard
                                      label="Desired Cost"
                                      badge={
                                        row.desiredCostPercentage !== null
                                          ? `${formatQty(row.desiredCostPercentage)}%`
                                          : undefined
                                      }
                                      value={
                                        row.desiredCostPercentage
                                          ? formatRupiah(row.totalCost / (row.desiredCostPercentage / 100))
                                          : '-'
                                      }
                                    />
                                    <SummaryCard
                                      label="Harga Jual"
                                      value={row.sellingPrice !== null ? formatRupiah(row.sellingPrice) : '-'}
                                    />
                                    <SummaryCard
                                      label="Margin"
                                      badge={
                                        margin !== null
                                          ? formatPercent((margin / row.sellingPrice!) * 100)
                                          : undefined
                                      }
                                      value={margin !== null ? formatRupiah(margin) : '-'}
                                    />
                                  </>
                                ) : (
                                  <>
                                    <SummaryCard
                                      label="Cost per Porsi"
                                      value={row.yieldQty ? formatRupiah(row.totalCost / row.yieldQty) : '-'}
                                    />
                                    <SummaryCard
                                      label={`Harga per ${row.unit ?? 'Satuan'}`}
                                      value={
                                        row.totalOutputQty
                                          ? formatRupiahDetail(row.totalCost / row.totalOutputQty)
                                          : '-'
                                      }
                                    />
                                  </>
                                )}
                              </div>

                              <p className="flex items-center gap-1.5 text-xs leading-4 text-[#64748b]">
                                <Info className="size-3.5" />
                                Biaya bahan otomatis dikalkulasi berdasarkan harga beli stok inventory terkini.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={sorted.length}
          itemLabel="resep"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {/* Form resep produk */}
      {recipeModal && (
        <ProductRecipeModal
          products={incompleteProducts}
          productId={recipeModal.productId}
          onClose={() => setRecipeModal(null)}
          onSaved={(name) => {
            setRecipeModal(null);
            setFlash(`Resep "${name}" berhasil disimpan.`);
            loadData();
          }}
        />
      )}

      {/* Form resep racikan */}
      {racikanModal && (
        <RacikanFormModal
          racikanId={racikanModal.racikanId}
          onClose={() => setRacikanModal(null)}
          onSaved={(name) => {
            setRacikanModal(null);
            setFlash(`Racikan "${name}" berhasil disimpan.`);
            loadData();
          }}
        />
      )}

      {historyOpen && (
        <HistoryModal
          title="Riwayat Perubahan Resep"
          load={fetchRecipeHistory}
          fields={RECIPE_HISTORY_FIELDS}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}