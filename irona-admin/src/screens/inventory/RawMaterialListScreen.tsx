import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleCheck,
  Package,
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
import {
  deleteRawMaterial,
  fetchRawMaterials,
  setRawMaterialActive,
} from '../../services/rawMaterials';
import { formatQty, formatRupiahDetail } from '../../utils/format';
import type { RawMaterialListItem } from '../../types/rawMaterial';
import icPlus from '../../assets/ui/plus.svg';
import icMore from '../../assets/ui/more.svg';
import RawMaterialFormModal from './RawMaterialFormModal';
import { Info } from 'lucide-react'; // tambahkan ke daftar import lucide yang sudah ada
import RawMaterialDetailModal from './RawMaterialDetailModal';

type SortKey = 'name' | 'materialType' | 'unitName' | 'currentStock' | 'unitPrice' | 'minStockAlert';
type TypeFilter = '' | 'tetap' | 'menyusut';

function TypeBadge({ type, muted }: { type: 'tetap' | 'menyusut'; muted: boolean }) {
  if (type === 'menyusut') {
    return (
      <span
        className={`rounded px-2 py-0.5 text-xs font-bold uppercase leading-4 tracking-[0.25px] ${
          muted ? 'border border-[#cbd5e1] bg-[#f1f5f9] text-[#64748b]' : 'bg-[#0f172a] text-white'
        }`}
      >
        Menyusut
      </span>
    );
  }
  return (
    <span
      className={`rounded border px-2.5 py-[3px] text-xs font-bold uppercase leading-4 ${
        muted ? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#94a3b8]' : 'border-[#94a3b8] bg-white text-[#1e293b]'
      }`}
    >
      Tetap
    </span>
  );
}

export default function RawMaterialListScreen() {
  const [materials, setMaterials] = useState<RawMaterialListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formState, setFormState] = useState<{ id: string | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMaterials(await fetchRawMaterials());
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat bahan baku.');
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
    return materials.filter(
      (m) => (!q || m.name.toLowerCase().includes(q)) && (!typeFilter || m.materialType === typeFilter)
    );
  }, [materials, search, typeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp =
        typeof va === 'string' ? va.localeCompare(vb as string, 'id') : (va as number) - (vb as number);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const lowStockCount = materials.filter(
    (m) => m.isActive && m.minStockAlert > 0 && m.currentStock <= m.minStockAlert
  ).length;

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleSort(key: string) {
    const k = key as SortKey;
    setSort((prev) =>
      prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }
    );
  }

  async function handleToggleActive(row: RawMaterialListItem) {
    const next = !row.isActive;
    if (
      !next &&
      !window.confirm(
        `Nonaktifkan "${row.name}"? Bahan ini tidak akan bisa dipilih lagi di resep dan stok masuk.`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await setRawMaterialActive(row.id, next);
      setMaterials((prev) => prev.map((m) => (m.id === row.id ? { ...m, isActive: next } : m)));
      setFlash(`Bahan "${row.name}" berhasil ${next ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal mengubah status bahan baku.');
    }
  }

  async function handleDelete(row: RawMaterialListItem) {
    if (!window.confirm(`Hapus "${row.name}" secara permanen? Tindakan ini tidak bisa dibatalkan.`)) return;
    setActionError(null);
    try {
      await deleteRawMaterial(row.id);
      setMaterials((prev) => prev.filter((m) => m.id !== row.id));
      setFlash(`Bahan "${row.name}" berhasil dihapus.`);
    } catch (err: any) {
      if (err?.code === '23503') {
        setActionError(
          `"${row.name}" masih dipakai di resep atau riwayat stok, jadi tidak bisa dihapus. Nonaktifkan saja bahan ini.`
        );
      } else {
        setActionError(err?.message ?? 'Gagal menghapus bahan baku.');
      }
    }
  }

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Daftar Bahan Baku"
        info="Master bahan baku: satuan dasar, harga per satuan dari pembelian terakhir, dan batas stok minimum."
        badge={loading ? undefined : `${materials.length} Bahan`}
        action={
          <button
            onClick={() => setFormState({ id: null })}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <img src={icPlus} alt="" className="size-4" />
            Tambah Bahan Baku
          </button>
        }
      />

      {!loading && lowStockCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-5 py-4 drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e11d48] text-xs font-bold text-white">
            !
          </span>
          <p className="text-sm leading-5 text-[#334155]">
            <span className="font-bold text-[#0f172a]">{lowStockCount} bahan baku menipis.</span> Stoknya sudah
            di bawah batas minimum — segera lakukan stok masuk di Kelola Stok.
          </p>
        </div>
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
        placeholder="Cari nama bahan..."
      >
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as TypeFilter);
            setPage(1);
          }}
          className="w-56 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
        >
          <option value="">Semua Jenis</option>
          <option value="tetap">Bahan Tetap</option>
          <option value="menyusut">Bahan Menyusut</option>
        </select>
      </SearchToolbar>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <SortableTh label="Nama Bahan" sortKey="name" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="pl-6" />
                <SortableTh label="Jenis Bahan" sortKey="materialType" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Satuan Dasar" sortKey="unitName" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Stok Saat Ini" sortKey="currentStock" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Harga per Satuan" sortKey="unitPrice" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Alert Stok Minimum" sortKey="minStockAlert" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <th className="py-[14px] pr-6 text-right text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat bahan baku...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-red-600">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#94a3b8]">
                    {search || typeFilter ? 'Tidak ada bahan yang cocok.' : 'Belum ada bahan baku.'}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                paged.map((row, idx) => {
                  const inactive = !row.isActive;
                  const isLow = row.isActive && row.minStockAlert > 0 && row.currentStock <= row.minStockAlert;

                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-[#f1f5f9] first:border-t-0 ${
                        inactive ? 'bg-[#f8fafc]' : idx % 2 === 1 ? 'bg-[rgba(248,250,252,0.6)]' : ''
                      }`}
                    >
                      <td className="py-4 pl-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-bold leading-5 ${inactive ? 'text-[#94a3b8]' : 'text-[#0f172a]'}`}
                          >
                            {row.name}
                          </span>
                          {inactive && (
                            <span className="rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-2.5 py-[3px] text-xs leading-4 text-[#64748b]">
                              Nonaktif
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <TypeBadge type={row.materialType} muted={inactive} />
                        </div>
                      </td>

                      <td className={`py-4 font-mono text-sm ${inactive ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                        {row.unitName}
                      </td>

                      <td className="py-4">
                        <div className="flex items-center gap-1.5">
                          {isLow && <AlertTriangle className="size-3.5 shrink-0 text-[#dc2626]" />}
                          <span
                            className={`text-sm ${
                              inactive
                                ? 'text-[#94a3b8]'
                                : isLow
                                  ? 'font-bold text-[#dc2626]'
                                  : 'text-[#0f172a]'
                            }`}
                          >
                            {formatQty(row.currentStock)} {row.unitName}
                          </span>
                        </div>
                      </td>

                      <td className={`py-4 text-sm ${inactive ? 'text-[#94a3b8]' : 'text-[#1e293b]'}`}>
                        {row.unitPrice !== null ? `${formatRupiahDetail(row.unitPrice)} / ${row.unitName}` : '—'}
                      </td>

                      <td className={`py-4 text-sm ${inactive ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                        {row.minStockAlert > 0 ? `${formatQty(row.minStockAlert)} ${row.unitName}` : '—'}
                      </td>

                      <td className="py-4 pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                            <img src={icMore} alt="Aksi" className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setDetailId(row.id)}>
                              <Info className="mr-2 size-3.5" />
                              Detail Bahan
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFormState({ id: row.id })}>
                              <Pencil className="mr-2 size-3.5" />
                              Ubah Data
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFormState({ id: row.id })}>
                              <Package className="mr-2 size-3.5" />
                              Stok Masuk
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(row)}>
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
          itemLabel="bahan baku"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />

        {formState && (
        <RawMaterialFormModal
          materialId={formState.id}
          onClose={() => setFormState(null)}
          onSaved={(name, mode) => {
            setFormState(null);
            setFlash(`Bahan "${name}" berhasil ${mode === 'edit' ? 'diperbarui' : 'ditambahkan'}.`);
            loadData();
          }}
        />
      )}
    {detailId && (
        <RawMaterialDetailModal
          materialId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const id = detailId;
            setDetailId(null);
            setFormState({ id });
          }}
        />
      )}
      </div>
    </div>
  );
}