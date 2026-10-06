import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, HandCoins, Pencil, Trash2, X } from 'lucide-react';
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
import { deleteKasbon, fetchKasbon, settleKasbonCash } from '../../services/kasbon';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate } from '../../utils/date';
import type { Kasbon, KasbonStatus } from '../../types/kasbon';
import KasbonFormModal from './KasbonFormModal';
import KasbonDetailModal from './KasbonDetailModal';
import { KASBON_STATUS_LABELS, KasbonStatusBadge } from './KasbonStatusBadge';
import icPlus from '../../assets/ui/plus.svg';
import icMore from '../../assets/ui/more.svg';

type SortKey = 'employeeName' | 'requestDate' | 'amount' | 'deductMonth' | 'status';
type StatusFilter = '' | 'berjalan' | 'lunas';

function formatDate(iso: string) {
  return parseLocalDate(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMonth(iso: string) {
  return parseLocalDate(iso).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

export default function KasbonListScreen() {
  const [items, setItems] = useState<Kasbon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [monthFilter, setMonthFilter] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'requestDate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formState, setFormState] = useState<{ kasbon: Kasbon | null } | null>(null);
  const [detail, setDetail] = useState<Kasbon | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchKasbon());
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat data kasbon.');
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

  const running = items.filter((k) => k.status === 'berjalan');
  const runningTotal = running.reduce((sum, k) => sum + k.amount, 0);
  const months = useMemo(() => [...new Set(items.map((k) => k.deductMonth))].sort().reverse(), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (k) =>
        (!q || k.employeeName.toLowerCase().includes(q)) &&
        (!statusFilter || (statusFilter === 'berjalan' ? k.status === 'berjalan' : k.status !== 'berjalan')) &&
        (!monthFilter || k.deductMonth === monthFilter)
    );
  }, [items, search, statusFilter, monthFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb), 'id');
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

  async function handleSettle(k: Kasbon) {
    if (
      !window.confirm(
        `Tandai kasbon ${k.employeeName} ${formatRupiah(k.amount)} sudah dikembalikan tunai? Kasbon ini tidak jadi dipotong dari gaji ${formatMonth(k.deductMonth)}.`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await settleKasbonCash(k.id);
      setFlash(`Kasbon ${k.employeeName} ditandai lunas tunai.`);
      loadData();
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal melunasi kasbon.');
    }
  }

  async function handleDelete(k: Kasbon) {
    if (!window.confirm(`Hapus kasbon ${k.employeeName} ${formatRupiah(k.amount)}? Gunakan hanya untuk input yang keliru.`)) {
      return;
    }
    setActionError(null);
    try {
      await deleteKasbon(k.id);
      setItems((prev) => prev.filter((x) => x.id !== k.id));
      setFlash(`Kasbon ${k.employeeName} berhasil dihapus.`);
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal menghapus kasbon.');
    }
  }

  const selectClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Kasbon"
        info="Kasbon = gaji dibayar di muka. Dipotong sekaligus dari gaji bulan pengajuan, maksimal sebesar gaji pokok."
        badge={loading ? undefined : `${running.length} berjalan · ${formatRupiah(runningTotal)}`}
        action={
          <button
            onClick={() => setFormState({ kasbon: null })}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]"
          >
            <img src={icPlus} alt="" className="size-4" />
            Tambah Kasbon
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
        placeholder="Cari nama karyawan..."
      >
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className={`w-44 ${selectClass}`}
          >
            <option value="">Semua Status ({items.length})</option>
            <option value="berjalan">Berjalan ({running.length})</option>
            <option value="lunas">Lunas ({items.length - running.length})</option>
          </select>
          <select
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setPage(1);
            }}
            className={`w-48 ${selectClass}`}
          >
            <option value="">Semua Bulan</option>
            {months.map((m) => (
              <option key={m} value={m}>
                Gaji {formatMonth(m)}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setMonthFilter('');
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
                <SortableTh label="Nama Karyawan" sortKey="employeeName" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="pl-6" />
                <SortableTh label="Tanggal Pengajuan" sortKey="requestDate" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Jumlah Kasbon" sortKey="amount" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Dipotong dari Gaji" sortKey="deductMonth" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Status" sortKey="status" activeKey={sort.key} dir={sort.dir} onSort={handleSort} align="center" />
                <th className="py-[14px] pr-6 text-right text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat data kasbon...
                  </td>
                </tr>
              )}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-[#94a3b8]">
                    {search || statusFilter || monthFilter ? 'Tidak ada kasbon yang cocok.' : 'Belum ada kasbon tercatat.'}
                  </td>
                </tr>
              )}

              {!loading &&
                paged.map((k) => {
                  const isOpen = k.status === 'berjalan';
                  return (
                    <tr key={k.id} className={`border-t border-[#f1f5f9] first:border-t-0 ${isOpen ? '' : 'bg-[#fcfcfd]'}`}>
                      <td className="py-4 pl-6">
                        <p className="text-xs font-semibold text-[#0f172a]">{k.employeeName}</p>
                        <p className="text-[11px] text-[#94a3b8]">{k.roleName}</p>
                      </td>
                      <td className="py-4 text-xs font-medium text-[#475569]">{formatDate(k.requestDate)}</td>
                      <td className="py-4 font-mono text-xs font-bold text-[#0f172a]">{formatRupiah(k.amount)}</td>
                      <td
                        className={`py-4 text-xs font-medium ${
                          k.status === 'lunas_tunai' ? 'text-[#94a3b8] line-through' : 'text-[#475569]'
                        }`}
                      >
                        {formatMonth(k.deductMonth)}
                      </td>
                      <td className="py-4 text-center">
                        <KasbonStatusBadge status={k.status} />
                      </td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setDetail(k)}
                            aria-label="Detail kasbon"
                            className="rounded-lg border border-[#e2e8f0] p-[7px] text-[#475569] hover:bg-[#f8fafc]"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              disabled={!isOpen}
                              title={isOpen ? undefined : 'Kasbon yang sudah lunas tidak bisa diubah'}
                              className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <img src={icMore} alt="Aksi" className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setFormState({ kasbon: k })}>
                                <Pencil className="mr-2 size-3.5" />
                                Ubah
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSettle(k)}>
                                <HandCoins className="mr-2 size-3.5" />
                                Lunasi Tunai
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(k)}>
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
          itemLabel="kasbon"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <p className="text-[11px] leading-4 text-[#94a3b8]">
        {(Object.keys(KASBON_STATUS_LABELS) as KasbonStatus[])
          .map((s) =>
            s === 'berjalan'
              ? `${KASBON_STATUS_LABELS[s]}: akan dipotong dari gaji bulan ini`
              : s === 'lunas_gaji'
                ? `${KASBON_STATUS_LABELS[s]}: sudah dipotong dari gaji bulan pengajuan`
                : `${KASBON_STATUS_LABELS[s]}: dikembalikan tunai, tidak dipotong gaji`
          )
          .join(' · ')}
      </p>

      {formState && (
        <KasbonFormModal
          kasbon={formState.kasbon}
          onClose={() => setFormState(null)}
          onSaved={(name, mode) => {
            setFormState(null);
            setFlash(`Kasbon ${name} berhasil ${mode === 'edit' ? 'diperbarui' : 'ditambahkan'}.`);
            loadData();
          }}
        />
      )}

      {detail && <KasbonDetailModal kasbon={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
