import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertTriangle, ChevronDown, ChevronRight, FlaskConical, Info, PackagePlus, Plus, SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '../../components/PageHeader';
import { SearchToolbar } from '../../components/SearchToolbar';
import { SortableTh, type SortDir } from '../../components/SortableTh';
import icMore from '../../assets/ui/more.svg';
import { TablePagination } from '../../components/TablePagination';
import { fetchItemMovements, fetchStockCard } from '../../services/stock';
import { formatQty, formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { PRESET_LABELS, presetRange, type DatePreset, type DateRange } from '../reports/reportRange';
import type { StockCardRow, StockMovementRow } from '../../types/stock';
import { CheckCircle2 } from 'lucide-react'; // tambahkan ke import lucide yang sudah ada
import StockInModal from './StockInModal';
import StockAdjustmentModal from './StockAdjustmentModal';
import RacikanProductionModal from './RacikanProductionModal';


type SortKey = 'itemName' | 'unitName' | 'opening' | 'incoming' | 'sold' | 'adjustment' | 'closing';

/** Stok akhir sudah di bawah/sama dengan batas minimum */
const isLowStock = (r: StockCardRow) => r.minStock > 0 && r.closing <= r.minStock;

const sortValue = (r: StockCardRow, key: SortKey) =>
  key === 'adjustment' ? r.adjustment + r.production : r[key];

const PRESETS: DatePreset[] = ['last_7_days', 'last_30_days', 'this_month', 'last_2_months', 'custom'];
const dateClass =
  'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 font-mono text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Delta({ value, unit }: { value: number; unit?: string }) {
  if (value === 0) return <span className="font-mono text-xs text-[#94a3b8]">0</span>;
  return (
    <span className="font-mono text-xs font-medium text-[#1e293b]">
      {value > 0 ? '+' : ''}
      {formatQty(value)}
      {unit ? ` ${unit}` : ''}
    </span>
  );
}

export default function StockCardScreen() {
  // ?q=nama bahan (mis. dari Perputaran Stok) langsung mengisi pencarian
  const [searchParams] = useSearchParams();
  const [today] = useState(todayISO);
  const [preset, setPreset] = useState<DatePreset>('last_30_days');
  const [range, setRange] = useState<DateRange>(() => presetRange('last_30_days', todayISO()));
  const [rows, setRows] = useState<StockCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // default seperti Daftar Stok: stok akhir paling menipis di atas
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'closing', dir: 'asc' });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [movementCache, setMovementCache] = useState<Record<string, StockMovementRow[]>>({});
  const [loadingMovements, setLoadingMovements] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<'stok-masuk' | 'penyesuaian' | 'produksi' | null>(null);
  // item yang dipilih dari menu aksi baris; null = dari tombol Tambah (pilih manual)
  const [formItem, setFormItem] = useState<StockCardRow | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchStockCard(range.start, range.end));
      setMovementCache({});
      setExpanded(null);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat kartu stok.');
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.itemName.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      // Urut stok akhir: yang menipis dulu, baru yang aman — masing-masing berdasarkan jumlah stok
      const lowFirst = sort.key === 'closing' ? Number(isLowStock(b)) - Number(isLowStock(a)) : 0;
      const cmp =
        lowFirst || (typeof va === 'string' ? va.localeCompare(vb as string, 'id') : va - (vb as number));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  function handleSort(key: string) {
    const k = key as SortKey;
    setSort((prev) =>
      prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }
    );
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function toggleExpand(row: StockCardRow) {
    if (expanded === row.itemId) {
      setExpanded(null);
      return;
    }
    setExpanded(row.itemId);
    if (movementCache[row.itemId]) return;

    setLoadingMovements(row.itemId);
    try {
      const data = await fetchItemMovements(row.itemType, row.itemId, range.start, range.end);
      setMovementCache((prev) => ({ ...prev, [row.itemId]: data }));
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat riwayat mutasi.');
    } finally {
      setLoadingMovements(null);
    }
  }

  function openForm(form: NonNullable<typeof activeForm>, item: StockCardRow | null) {
    setFormItem(item);
    setActiveForm(form);
  }

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Kelola Stok"
        info="Kartu stok per periode: stok awal, barang masuk, pemakaian penjualan, penyesuaian, dan stok akhir."
        action={
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]">
              <Plus className="size-4" />
              Tambah
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => openForm('stok-masuk', null)}>Stok Masuk</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openForm('penyesuaian', null)}>Penyesuaian Stok</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openForm('produksi', null)}>Produksi Racikan</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {error && (
        <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">{error}</p>
      )}  
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
        placeholder="Cari nama bahan..."
      >
        <div className="flex items-center gap-2">
          <select
            value={preset}
            onChange={(e) => {
              const p = e.target.value as DatePreset;
              setPreset(p);
              if (p !== 'custom') setRange(presetRange(p, today));
            }}
            className={`${dateClass} w-44 font-sans`}
            aria-label="Periode"
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={range.start}
            max={range.end}
            onChange={(e) => {
              if (!e.target.value) return;
              setPreset('custom');
              setRange((prev) => ({ ...prev, start: e.target.value }));
            }}
            className={dateClass}
            aria-label="Dari tanggal"
          />
          <span className="text-xs text-[#94a3b8]">–</span>
          <input
            type="date"
            value={range.end}
            min={range.start}
            max={today}
            onChange={(e) => {
              if (!e.target.value) return;
              setPreset('custom');
              setRange((prev) => ({ ...prev, end: e.target.value }));
            }}
            className={dateClass}
            aria-label="Sampai tanggal"
          />
        </div>
      </SearchToolbar>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr className="text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                <SortableTh label="Nama Bahan" sortKey="itemName" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="w-[300px] px-4" />
                <SortableTh label="Satuan" sortKey="unitName" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="w-[90px] px-3" />
                <SortableTh label="Stok Awal" sortKey="opening" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="w-[100px] px-3" />
                <SortableTh label="Masuk" sortKey="incoming" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="w-[90px] px-3" />
                <SortableTh label="Terjual" sortKey="sold" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="w-[90px] px-3" />
                <SortableTh label="Penyesuaian" sortKey="adjustment" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="w-[120px] px-3" />
                <SortableTh label="Stok Akhir" sortKey="closing" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="w-[120px] px-3" />
                <th className="w-[70px] px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat kartu stok...
                  </td>
                </tr>
              )}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#94a3b8]">
                    {search ? 'Tidak ada bahan yang cocok.' : 'Belum ada data stok.'}
                  </td>
                </tr>
              )}

              {!loading &&
                paged.map((row) => {
                  const isOpen = expanded === row.itemId;
                  const isLow = isLowStock(row);
                  const movements = movementCache[row.itemId];
                  const incoming = movements?.filter((m) => m.movementType === 'stok_masuk') ?? [];
                  const adjustments =
                    movements?.filter(
                      (m) => m.movementType === 'penyesuaian' || m.movementType === 'try_error'
                    ) ?? [];
                  const productions = movements?.filter((m) => m.movementType === 'produksi_racikan') ?? [];

                  return (
                    <>
                      <tr
                        key={row.itemId}
                        className={`border-t border-[#f1f5f9] first:border-t-0 ${isOpen ? 'bg-[rgba(248,250,252,0.7)]' : ''}`}
                      >
                        <td
                          className={`px-4 py-3.5 ${isLow ? 'shadow-[inset_3px_0_0_#e11d48]' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpand(row)}
                              aria-label={isOpen ? 'Tutup rincian' : 'Lihat rincian'}
                              className="rounded p-0.5 text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
                            >
                              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                            <span className="text-sm font-semibold text-[#0f172a]">{row.itemName}</span>
                            {row.itemType === 'racikan' && (
                              <span className="rounded border border-[#94a3b8] bg-[#e2e8f0] px-1.5 py-0.5 text-xs font-medium text-[#1e293b]">
                                Racikan
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-sm text-[#64748b]">{row.unitName}</td>
                        <td className="px-3 py-3.5 font-mono text-sm text-[#334155]">
                          {formatQty(row.opening)}
                        </td>
                        <td className="px-3 py-3.5">
                          <Delta value={row.incoming} />
                        </td>
                        <td className="px-3 py-3.5 font-mono text-sm text-[#334155]">
                          {row.sold === 0 ? '0' : formatQty(-row.sold)}
                        </td>
                        <td className="px-3 py-3.5">
                          <Delta value={row.adjustment + row.production} />
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {isLow && <AlertTriangle className="size-3.5 shrink-0 text-[#dc2626]" />}
                            <span className={`font-mono text-sm font-bold ${isLow ? 'text-[#dc2626]' : 'text-[#0f172a]'}`}>
                              {formatQty(row.closing)} {row.unitName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                              <img src={icMore} alt="Aksi" className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => toggleExpand(row)}>
                                <Info className="mr-2 size-3.5" />
                                {isOpen ? 'Tutup Detail' : 'Detail'}
                              </DropdownMenuItem>
                              {row.itemType === 'racikan' ? (
                                <DropdownMenuItem onClick={() => openForm('produksi', row)}>
                                  <FlaskConical className="mr-2 size-3.5" />
                                  Produksi Racikan
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => openForm('stok-masuk', row)}>
                                  <PackagePlus className="mr-2 size-3.5" />
                                  Stok Masuk
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openForm('penyesuaian', row)}>
                                <SlidersHorizontal className="mr-2 size-3.5" />
                                Penyesuaian Stok
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${row.itemId}-detail`} className="bg-[rgba(241,245,249,0.7)]">
                          <td colSpan={8} className="py-4 pl-10 pr-4">
                            <div className="flex flex-col gap-4 rounded-lg border border-[#cbd5e1] bg-white p-[17px]">
                              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2.5">
                                <p className="text-sm font-bold uppercase tracking-[0.6px] text-[#334155]">
                                  Rincian Kartu Stok Periode Ini
                                </p>
                                <span className="font-mono text-xs text-[#64748b]">
                                  Batas minimum: {row.minStock > 0 ? `${formatQty(row.minStock)} ${row.unitName}` : '—'}
                                </span>
                              </div>

                              {loadingMovements === row.itemId ? (
                                <p className="py-4 text-center text-sm text-[#94a3b8]">Memuat riwayat...</p>
                              ) : (
                                <div className="flex gap-4">
                                  {/* Ringkasan pemakaian */}
                                  <div className="flex flex-1 flex-col justify-between rounded border border-[#e2e8f0] bg-[#f8fafc] p-3">
                                    <div>
                                      <p className="text-xs font-bold uppercase text-[#64748b]">
                                        Ringkasan Terjual (POS)
                                      </p>
                                      <p className="pt-1 font-mono text-lg font-bold text-[#0f172a]">
                                        {formatQty(row.sold)} {row.unitName}
                                      </p>
                                      <p className="text-xs leading-4 text-[#64748b]">
                                        Total konsumsi resep dari pesanan kasir pada periode ini.
                                      </p>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between border-t border-[#e2e8f0] pt-3">
                                      <span className="text-xs text-[#475569]">Produksi racikan:</span>
                                      <span className="font-mono text-xs font-semibold text-[#475569]">
                                        {formatQty(row.production)} {row.unitName}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Riwayat stok masuk */}
                                  <div className="flex flex-1 flex-col gap-2 rounded border border-[#e2e8f0] bg-[#f8fafc] p-3">
                                    <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-1.5">
                                      <p className="text-xs font-bold uppercase text-[#64748b]">
                                        Riwayat Stok Masuk
                                      </p>
                                      <span className="font-mono text-xs font-bold text-[#334155]">
                                        +{formatQty(row.incoming)} {row.unitName}
                                      </span>
                                    </div>
                                    {incoming.length === 0 ? (
                                      <p className="py-2 text-xs text-[#94a3b8]">Belum ada stok masuk.</p>
                                    ) : (
                                      incoming.map((m) => (
                                        <div key={m.id} className="border-b border-[#f1f5f9] pb-1.5 last:border-b-0">
                                          <div className="flex items-start justify-between">
                                            <span className="font-mono text-sm font-semibold text-[#475569]">
                                              {formatDate(m.movementDate)}
                                            </span>
                                            <span className="font-mono text-sm font-semibold text-[#0f172a]">
                                              +{formatQty(m.quantity)} {m.unitName}
                                            </span>
                                          </div>
                                          <p className="text-xs leading-4 text-[#64748b]">
                                            {m.purchaseQty ? `${formatQty(m.purchaseQty)} kemasan` : ''}
                                            {m.totalPrice ? ` × ${formatRupiah(m.totalPrice)}` : ''}
                                            {m.notes ? ` / ${m.notes}` : ''}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  {/* Riwayat penyesuaian */}
                                  <div className="flex flex-1 flex-col gap-2 rounded border border-[#e2e8f0] bg-[#f8fafc] p-3">
                                    <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-1.5">
                                      <p className="text-xs font-bold uppercase text-[#64748b]">
                                        Riwayat Penyesuaian
                                      </p>
                                      <span className="font-mono text-xs font-bold text-[#334155]">
                                        {formatQty(row.adjustment)} {row.unitName}
                                      </span>
                                    </div>
                                    {adjustments.length === 0 ? (
                                      <p className="py-2 text-xs text-[#94a3b8]">Belum ada penyesuaian.</p>
                                    ) : (
                                      adjustments.map((m) => (
                                        <div key={m.id} className="border-b border-[#f1f5f9] pb-1.5 last:border-b-0">
                                          <div className="flex items-start justify-between">
                                            <span className="font-mono text-sm font-semibold text-[#475569]">
                                              {formatDate(m.movementDate)}
                                            </span>
                                            <span className="font-mono text-sm font-semibold text-[#0f172a]">
                                              {m.quantity > 0 ? '+' : ''}
                                              {formatQty(m.quantity)} {m.unitName}
                                            </span>
                                          </div>
                                          <p className="text-xs leading-4 text-[#64748b]">
                                            {m.adjustmentReason ?? ''}
                                            {m.notes ? ` — ${m.notes}` : ''}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}

                              {productions.length > 0 && (
                                <p className="text-xs text-[#64748b]">
                                  {productions.length} catatan produksi racikan pada periode ini.
                                </p>
                              )}
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
          total={filtered.length}
          itemLabel="bahan baku"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />

              {activeForm === 'stok-masuk' && (
        <StockInModal
          initialMaterialId={formItem?.itemId}
          onClose={() => setActiveForm(null)}
          onSaved={(name) => {
            setActiveForm(null);
            setFlash(`Stok masuk untuk "${name}" berhasil dicatat.`);
            loadData();
          }}
        />
      )}

      {activeForm === 'penyesuaian' && (
        <StockAdjustmentModal
          initialItem={formItem ? { type: formItem.itemType, id: formItem.itemId } : undefined}
          onClose={() => setActiveForm(null)}
          onSaved={(name) => {
            setActiveForm(null);
            setFlash(`Penyesuaian stok "${name}" berhasil dicatat.`);
            loadData();
          }}
        />
      )}

      {activeForm === 'produksi' && (
        <RacikanProductionModal
          initialRacikanId={formItem?.itemId}
          onClose={() => setActiveForm(null)}
          onSaved={(name) => {
            setActiveForm(null);
            setFlash(`Produksi racikan "${name}" berhasil dicatat.`);
            loadData();
          }}
        />
      )}
      </div>
    </div>
  );
}