import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Coins, History, Pencil, Power, Settings2, Trash2, X } from 'lucide-react';
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
  deleteReward,
  fetchPointRules,
  fetchRewards,
  setRewardActive,
} from '../../services/rewards';
import { formatRupiah } from '../../utils/format';
import type { PointRules, Reward } from '../../types/reward';
import PointRulesModal from './PointRulesModal';
import RewardClaimsModal from './RewardClaimsModal';
import RewardFormModal from './RewardFormModal';
import { calcPoints, describeBreakdown } from './pointCalc';
import icPlus from '../../assets/ui/plus.svg';
import icMore from '../../assets/ui/more.svg';

type SortKey = 'name' | 'productName' | 'pointsRequired' | 'availableStock' | 'isActive';

function RulesCard({ rules, onEdit }: { rules: PointRules; onEdit: () => void }) {
  const smallest = rules.tiers[0]?.minAmount ?? 10000;
  const examples = [smallest * 1.6, smallest * 5].map((v) => Math.round(v / 1000) * 1000);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#fef3c7] text-[#b45309]">
            <Coins className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-[#0f172a]">Aturan Dapat Poin</p>
            <p className="text-[11px] text-[#64748b]">
              {rules.updatedAt
                ? `Terakhir diubah ${new Date(rules.updatedAt).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}${rules.updatedByName ? ` oleh ${rules.updatedByName}` : ''}`
                : 'Nilai awal'}
            </p>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
        >
          <Settings2 className="size-3.5" />
          Ubah Aturan
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {rules.tiers.map((t) => (
          <span
            key={t.minAmount}
            className="rounded-full border border-[#cbd5e1] bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#0f172a]"
          >
            {formatRupiah(t.minAmount)} = {t.points} poin
          </span>
        ))}
        <span className="text-xs text-[#64748b]">
          ·{' '}
          {rules.roundingThreshold > 0
            ? `sisa ≥ ${formatRupiah(rules.roundingThreshold)} dibulatkan ke atas`
            : 'tanpa pembulatan sisa'}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-[#64748b]">
        {examples.map((amount) => {
          const r = calcPoints(amount, rules.tiers, rules.roundingThreshold);
          return (
            <span key={amount}>
              Contoh:{' '}
              <span className="font-mono font-semibold text-[#0f172a]">{formatRupiah(amount)}</span>{' '}
              = {describeBreakdown(r.breakdown, r.leftover)} ={' '}
              <span className="font-bold text-[#0f172a]">{r.points} poin</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function PointRewardScreen() {
  const [rules, setRules] = useState<PointRules | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'aktif' | 'nonaktif'>('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'pointsRequired',
    dir: 'asc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [formState, setFormState] = useState<{ reward: Reward | null } | null>(null);
  const [claimsFor, setClaimsFor] = useState<Reward | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, list] = await Promise.all([fetchPointRules(), fetchRewards()]);
      setRules(r);
      setRewards(list);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat data point reward.');
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

  const activeCount = rewards.filter((r) => r.isActive).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rewards.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q)) &&
        (!statusFilter || (statusFilter === 'aktif' ? r.isActive : !r.isActive))
    );
  }, [rewards, search, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
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

  async function handleToggle(r: Reward) {
    const message = r.isActive
      ? `Nonaktifkan "${r.name}"? Reward langsung hilang dari katalog Web Customer.${
          r.pendingCount > 0
            ? ` ${r.pendingCount} kode yang sudah diklaim tetap bisa ditukar sampai hangus.`
            : ''
        }`
      : `Aktifkan "${r.name}"? Reward muncul lagi di katalog Web Customer.`;
    if (!window.confirm(message)) return;
    setActionError(null);
    try {
      await setRewardActive(r.id, !r.isActive);
      setFlash(`Reward "${r.name}" ${r.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      loadData();
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal mengubah status reward.');
    }
  }

  async function handleDelete(r: Reward) {
    if (!window.confirm(`Hapus reward "${r.name}"?`)) return;
    setActionError(null);
    try {
      await deleteReward(r.id);
      setRewards((prev) => prev.filter((x) => x.id !== r.id));
      setFlash(`Reward "${r.name}" berhasil dihapus.`);
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal menghapus reward.');
    }
  }

  const thClass =
    'py-[14px] text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';

  return (
    <div className="flex max-w-[1400px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Point Reward"
        info="Atur cara member mendapat poin dari transaksi, dan katalog hadiah yang bisa ditukar dengan poin di Web Customer."
        badge={loading ? undefined : `${rewards.length} reward · ${activeCount} aktif`}
        action={
          <button
            onClick={() => setFormState({ reward: null })}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]"
          >
            <img src={icPlus} alt="" className="size-4" />
            Tambah Reward
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

      {rules && <RulesCard rules={rules} onEdit={() => setRulesOpen(true)} />}

      <SearchToolbar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Cari nama reward..."
      >
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as '' | 'aktif' | 'nonaktif');
              setPage(1);
            }}
            className="w-44 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
          >
            <option value="">Semua Status ({rewards.length})</option>
            <option value="aktif">Aktif ({activeCount})</option>
            <option value="nonaktif">Nonaktif ({rewards.length - activeCount})</option>
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
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <SortableTh
                  label="Nama Reward"
                  sortKey="name"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  className="pl-6"
                />
                <SortableTh
                  label="Produk"
                  sortKey="productName"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Poin Diperlukan"
                  sortKey="pointsRequired"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  align="center"
                />
                <SortableTh
                  label="Stok"
                  sortKey="availableStock"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={handleSort}
                  align="center"
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
                  <td colSpan={6} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat reward...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-[#94a3b8]">
                    {search || statusFilter
                      ? 'Tidak ada reward yang cocok.'
                      : 'Belum ada reward di katalog.'}
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t border-[#f1f5f9] first:border-t-0 ${r.isActive ? '' : 'bg-[#fcfcfd]'}`}
                  >
                    <td className="py-4 pl-6 pr-3">
                      <p
                        className={`text-xs font-semibold ${r.isActive ? 'text-[#0f172a]' : 'text-[#64748b]'}`}
                      >
                        {r.name}
                      </p>
                      {r.notes && <p className="pt-0.5 text-[11px] text-[#94a3b8]">{r.notes}</p>}
                    </td>
                    <td className="py-4 pr-3 text-xs text-[#475569]">{r.productName}</td>
                    <td className="py-4 text-center font-mono text-xs font-bold text-[#0f172a]">
                      {r.pointsRequired} poin
                    </td>
                    <td className="py-4 text-center">
                      {r.availableStock <= 0 ? (
                        <span className="inline-flex rounded-full border border-[#fecdd3] bg-[#fff1f2] px-2.5 py-0.5 text-[10px] font-bold text-[#e11d48]">
                          Habis
                        </span>
                      ) : (
                        <span className="font-mono text-xs font-bold text-[#0f172a]">
                          {r.availableStock}
                        </span>
                      )}
                      <p className="pt-0.5 text-[10px] text-[#94a3b8]">
                        stok {r.stock}
                        {r.pendingCount > 0 ? ` · ${r.pendingCount} dicadangkan` : ''}
                      </p>
                    </td>
                    <td className="py-4 text-center">
                      {r.isActive ? (
                        <span className="inline-flex rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-bold text-white">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-2.5 py-0.5 text-[10px] font-bold text-[#475569]">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-4 pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setClaimsFor(r)}
                          title="Riwayat Klaim"
                          className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-2 py-[7px] text-[11px] font-semibold text-[#475569] hover:bg-[#f8fafc]"
                        >
                          <History className="size-3.5" />
                          {r.claimCount}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                            <img src={icMore} alt="Aksi" className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setFormState({ reward: r })}>
                              <Pencil className="mr-2 size-3.5" />
                              Ubah
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggle(r)}>
                              <Power className="mr-2 size-3.5" />
                              {r.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={r.claimCount > 0}
                              onClick={() => handleDelete(r)}
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
          itemLabel="reward"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <p className="text-[11px] leading-4 text-[#94a3b8]">
        Stok = sisa yang masih bisa diklaim (stok fisik dikurangi kode yang menunggu ditukar); stok
        fisik berkurang saat kode ditukar di kasir. Kode klaim berlaku 1 hari sejak diklaim; selama
        belum ditukar, admin bisa membatalkannya (poin kembali). Menonaktifkan reward tidak
        menghanguskan kode yang sudah diklaim. Reward yang sudah pernah diklaim tidak bisa dihapus,
        cukup dinonaktifkan.
      </p>

      {rulesOpen && rules && (
        <PointRulesModal
          rules={rules}
          onClose={() => setRulesOpen(false)}
          onSaved={() => {
            setRulesOpen(false);
            setFlash('Aturan dapat poin berhasil disimpan. Berlaku untuk transaksi berikutnya.');
            loadData();
          }}
        />
      )}

      {formState && (
        <RewardFormModal
          reward={formState.reward}
          onClose={() => setFormState(null)}
          onSaved={(name, mode) => {
            setFormState(null);
            setFlash(
              `Reward "${name}" berhasil ${mode === 'edit' ? 'diperbarui' : 'ditambahkan'}.`
            );
            loadData();
          }}
        />
      )}

      {claimsFor && (
        <RewardClaimsModal
          reward={claimsFor}
          onClose={() => setClaimsFor(null)}
          onChanged={(message) => {
            setFlash(message);
            loadData();
          }}
        />
      )}
    </div>
  );
}
