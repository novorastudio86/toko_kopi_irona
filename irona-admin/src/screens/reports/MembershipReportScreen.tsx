import { useEffect, useState } from 'react';
import { Download, Eye, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { TablePagination } from '../../components/TablePagination';
import { fetchCustomers } from '../../services/customers';
import type { Customer } from '../../types/customer';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate, toLocalISO, todayISO } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { StatCard } from '../finance/CashFlowPanels';
import CustomerDetailModal from '../customers/CustomerDetailModal';
import { rangeText } from './reportRange';

type SortKey = 'spent' | 'transactions' | 'points' | 'registered' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  spent: 'Total Belanja Tertinggi',
  transactions: 'Transaksi Terbanyak',
  points: 'Poin Terbanyak',
  registered: 'Terbaru Mendaftar',
  name: 'Nama (A–Z)',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Tanggal lokal WIB dari timestamptz */
const localDate = (iso: string) => toLocalISO(new Date(iso));

export default function MembershipReportScreen() {
  const [today] = useState(todayISO);
  const [search, setSearch] = useState('');
  const [regStart, setRegStart] = useState('');
  const [regEnd, setRegEnd] = useState('');
  const [sort, setSort] = useState<SortKey>('spent');

  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detail, setDetail] = useState<Customer | null>(null);

  useEffect(() => {
    fetchCustomers()
      .then(setRows)
      .catch((err) => setError(err?.message ?? 'Gagal memuat laporan.'))
      .finally(() => setLoading(false));
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = rows
    .filter((c) => {
      const reg = localDate(c.registeredAt);
      return (
        (!regStart || reg >= regStart) &&
        (!regEnd || reg <= regEnd) &&
        (!q || c.name.toLowerCase().includes(q) || c.phoneNumber.includes(q))
      );
    })
    .sort((a, b) => {
      switch (sort) {
        case 'spent':
          return b.totalSpent - a.totalSpent;
        case 'transactions':
          return b.totalTransactions - a.totalTransactions;
        case 'points':
          return b.pointsBalance - a.pointsBalance;
        case 'registered':
          return b.registeredAt.localeCompare(a.registeredAt);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  const totalPoints = filtered.reduce((s, c) => s + c.pointsBalance, 0);
  const totalSpent = filtered.reduce((s, c) => s + c.totalSpent, 0);
  const regText =
    regStart || regEnd
      ? `Terdaftar ${rangeText({ start: regStart || regEnd, end: regEnd || regStart })}`
      : 'Semua member';

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel<Customer>({
        fileName: `Laporan Membership ${today}`,
        title: 'Laporan Membership',
        subtitle: `${regText} · per ${formatDate(new Date().toISOString())}`,
        summary: [
          ['Total Member Terdaftar', String(filtered.length)],
          ['Total Poin Beredar', `${totalPoints.toLocaleString('id-ID')} poin`],
          ['Total Belanja Member', totalSpent],
        ],
        sheets: [
          {
            name: 'Daftar Member',
            rows: filtered,
            columns: [
              { header: 'Nama', width: 24, value: (c) => c.name },
              { header: 'No HP', width: 16, value: (c) => c.phoneNumber },
              {
                header: 'Tanggal Registrasi',
                width: 16,
                type: 'date',
                value: (c) => parseLocalDate(localDate(c.registeredAt)),
              },
              { header: 'Saldo Poin', width: 12, type: 'number', value: (c) => c.pointsBalance },
              {
                header: 'Total Transaksi',
                width: 14,
                type: 'number',
                value: (c) => c.totalTransactions,
              },
              { header: 'Total Belanja', width: 16, type: 'currency', value: (c) => c.totalSpent },
              {
                header: 'Order Terakhir',
                width: 16,
                value: (c) => formatDate(c.lastTransactionAt),
              },
              { header: 'Status', width: 10, value: (c) => (c.isActive ? 'Aktif' : 'Nonaktif') },
            ],
          },
        ],
      });
    } catch (err: any) {
      setError(err?.message ?? 'Gagal mengekspor.');
    } finally {
      setExporting(false);
    }
  }

  const filterClass =
    'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';
  const thClass =
    'whitespace-nowrap py-[14px] pr-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[#64748b]';
  const resetPage = () => setPage(1);

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        breadcrumb={['Laporan', 'Laporan Pelanggan', 'Laporan Membership']}
        title="Laporan Membership"
        info="Daftar member beserta poin saat ini. Total Transaksi hanya transaksi resmi yang sudah dibayar (tanpa yang dibatalkan/direfund penuh). Total Belanja = nilai produk setelah diskon dikurangi refund, tanpa ongkir/biaya layanan — sama dengan dasar hitung poin."
        badge={regText}
        action={
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-50"
          >
            <Download className="size-4" />
            {exporting ? 'Mengekspor...' : 'Ekspor Laporan'}
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              placeholder="Cari nama / no HP..."
              className={`${filterClass} w-56 pl-8`}
              aria-label="Cari member"
            />
          </div>
          <span className="ml-1 text-xs text-[#64748b]">Terdaftar</span>
          <input
            type="date"
            value={regStart}
            max={regEnd || today}
            onChange={(e) => {
              setRegStart(e.target.value);
              resetPage();
            }}
            className={filterClass}
            aria-label="Terdaftar dari"
          />
          <span className="text-xs text-[#94a3b8]">–</span>
          <input
            type="date"
            value={regEnd}
            min={regStart || undefined}
            max={today}
            onChange={(e) => {
              setRegEnd(e.target.value);
              resetPage();
            }}
            className={filterClass}
            aria-label="Terdaftar sampai"
          />
          {(regStart || regEnd) && (
            <button
              onClick={() => {
                setRegStart('');
                setRegEnd('');
                resetPage();
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
            >
              Reset
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortKey);
            resetPage();
          }}
          className={filterClass}
          aria-label="Urutkan"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              Urut: {SORT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Member Terdaftar"
          value={filtered.length}
          format="number"
          hint={`${filtered.filter((c) => c.isActive).length} aktif`}
        />
        <StatCard
          label="Total Poin Beredar"
          value={totalPoints}
          format="number"
          hint="Akumulasi saldo poin semua member"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className={`${thClass} pl-6 text-left`}>Nama</th>
                <th className={`${thClass} text-left`}>No HP</th>
                <th className={`${thClass} text-left`}>Tanggal Registrasi</th>
                <th className={`${thClass} text-right`}>Saldo Poin</th>
                <th className={`${thClass} text-right`}>Total Transaksi</th>
                <th className={`${thClass} text-right`}>Total Belanja</th>
                <th className={`${thClass} text-left`}>Order Terakhir</th>
                <th className={`${thClass} pr-6 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-[#94a3b8]">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-[#94a3b8]">
                    {rows.length ? 'Member tidak ditemukan.' : 'Belum ada member.'}
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setDetail(c)}
                    className="cursor-pointer border-t border-[#f1f5f9] text-xs first:border-t-0 hover:bg-[#f8fafc]"
                  >
                    <td className="py-3 pl-6 pr-3">
                      <span className="font-semibold text-[#0f172a]">{c.name}</span>
                      {!c.isActive && (
                        <span className="ml-1.5 rounded-full border border-dashed border-[#94a3b8] px-1.5 py-0.5 text-[10px] font-bold text-[#64748b]">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[#475569]">{c.phoneNumber}</td>
                    <td className="py-3 pr-3 text-[#475569]">{formatDate(c.registeredAt)}</td>
                    <td className="py-3 pr-3 text-right font-mono">
                      {c.pointsBalance.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">{c.totalTransactions}</td>
                    <td className="py-3 pr-3 text-right font-mono">{formatRupiah(c.totalSpent)}</td>
                    <td className="py-3 pr-3 text-[#475569]">{formatDate(c.lastTransactionAt)}</td>
                    <td className="py-3 pr-6 text-right">
                      <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#475569]">
                        <Eye className="size-3.5" />
                        Detail
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
          itemLabel="member"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            resetPage();
          }}
        />
      </div>

      {detail && <CustomerDetailModal customer={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
