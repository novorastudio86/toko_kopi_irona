import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, CircleCheck, Info, Pencil, QrCode, Trash2, X } from 'lucide-react';
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
import { deleteEmployee, fetchEmployees, fetchRoles, setEmployeeActive } from '../../services/employees';
import { formatRupiah } from '../../utils/format';
import type { EmployeeListItem, RoleOption, RoleType } from '../../types/employee';
import EmployeeFormModal from './EmployeeFormModal';
import EmployeeDetailModal from './EmployeeDetailModal';
import EmployeeQrModal from './EmployeeQrModal';
import icPlus from '../../assets/ui/plus.svg';
import icMore from '../../assets/ui/more.svg';

type SortKey = 'fullName' | 'phoneNumber' | 'roleName' | 'baseSalary' | 'isActive';

/** Warna avatar dipilih dari nama, supaya tetap sama setiap kali dibuka */
const AVATAR_COLORS = [
  'bg-[rgba(255,237,213,0.8)] border-[#fed7aa] text-[#c2410c]',
  'bg-[rgba(219,234,254,0.8)] border-[#bfdbfe] text-[#1d4ed8]',
  'bg-[rgba(243,232,255,0.8)] border-[#e9d5ff] text-[#7e22ce]',
  'bg-[rgba(204,251,241,0.8)] border-[#99f6e4] text-[#0f766e]',
  'bg-[rgba(252,231,243,0.8)] border-[#fbcfe8] text-[#be185d]',
  'bg-[rgba(254,243,199,0.8)] border-[#fde68a] text-[#92400e]',
  'bg-[rgba(224,231,255,0.8)] border-[#c7d2fe] text-[#4338ca]',
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function avatarClass(name: string, inactive: boolean) {
  if (inactive) return 'bg-[#e2e8f0] border-[#cbd5e1] text-[#475569]';
  const index = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function RoleBadge({ type, name, inactive }: { type: RoleType; name: string; inactive: boolean }) {
  if (inactive) {
    return (
      <span className="inline-flex items-center rounded-md border border-[#e2e8f0] bg-[#f1f5f9] px-[11px] py-[5px] text-xs font-semibold text-[#475569]">
        {name}
      </span>
    );
  }
  if (type === 'admin') {
    return (
      <span className="inline-flex items-center rounded-md bg-[#1a1c20] px-2.5 py-1 text-xs font-bold text-white">
        {name}
      </span>
    );
  }
  if (type === 'driver') {
    return (
      <span className="inline-flex items-center rounded-md border-2 border-dashed border-[#94a3b8] bg-[#f8fafc] px-3 py-1.5 text-xs font-bold text-[#334155]">
        {name}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[#cbd5e1] bg-white px-[11px] py-[5px] text-xs font-bold text-[#334155]">
      {name}
    </span>
  );
}

export default function EmployeeListScreen() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'aktif' | 'nonaktif'>('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'fullName', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formState, setFormState] = useState<{ id: string | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [qrEmployeeId, setQrEmployeeId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [employeeData, roleData] = await Promise.all([fetchEmployees(), fetchRoles()]);
      setEmployees(employeeData);
      setRoles(roleData);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat data karyawan.');
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

  const activeCount = employees.filter((e) => e.isActive).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchQuery =
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.phoneNumber.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q);
      const matchRole = !roleFilter || e.roleId === roleFilter;
      const matchStatus =
        !statusFilter || (statusFilter === 'aktif' ? e.isActive : !e.isActive);
      return matchQuery && matchRole && matchStatus;
    });
  }, [employees, search, roleFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      const cmp =
        typeof va === 'string'
          ? va.localeCompare(vb as string, 'id')
          : Number(va) - Number(vb);
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

  async function handleToggleActive(row: EmployeeListItem) {
    const next = !row.isActive;
    if (
      !next &&
      !window.confirm(
        `Nonaktifkan "${row.fullName}"? Akunnya tidak bisa dipakai login, tapi histori presensi dan kasbon tetap tersimpan.`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await setEmployeeActive(row.id, next);
      setEmployees((prev) => prev.map((e) => (e.id === row.id ? { ...e, isActive: next } : e)));
      setFlash(`Karyawan "${row.fullName}" berhasil ${next ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err: any) {
      setActionError(err?.message ?? 'Gagal mengubah status karyawan.');
    }
  }

  async function handleDelete(row: EmployeeListItem) {
    if (
      !window.confirm(
        `Hapus "${row.fullName}" secara permanen? Gunakan ini hanya untuk data yang salah input — karyawan resign cukup dinonaktifkan.`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await deleteEmployee(row.id);
      setEmployees((prev) => prev.filter((e) => e.id !== row.id));
      setFlash(`Karyawan "${row.fullName}" berhasil dihapus.`);
    } catch (err: any) {
      if (err?.code === '23503') {
        setActionError(
          `"${row.fullName}" sudah punya histori transaksi/presensi/kasbon sehingga tidak bisa dihapus. Nonaktifkan saja karyawan ini.`
        );
      } else {
        setActionError(err?.message ?? 'Gagal menghapus karyawan.');
      }
    }
  }

  return (
    <div className="flex max-w-[1600px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Daftar Karyawan"
        info="Data karyawan beserta akun login untuk aplikasi Kasir dan Driver."
        badge={loading ? undefined : `${activeCount} aktif dari ${employees.length} karyawan`}
        action={
          <button
            onClick={() => setFormState({ id: null })}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]"
          >
            <img src={icPlus} alt="" className="size-4" />
            Tambah Karyawan
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
        placeholder="Cari nama, nomor telepon, atau username..."
      >
        <div className="flex items-center gap-2.5">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="min-w-[170px] rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs font-semibold text-[#334155] outline-none focus:border-[#94a3b8]"
          >
            <option value="">Semua Role ({employees.length})</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({employees.filter((e) => e.roleId === r.id).length})
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as '' | 'aktif' | 'nonaktif');
              setPage(1);
            }}
            className="min-w-[150px] rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs font-semibold text-[#334155] outline-none focus:border-[#94a3b8]"
          >
            <option value="">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>
      </SearchToolbar>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_4px_20px_-2px_rgba(18,19,22,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead className="border-b border-[rgba(226,232,240,0.8)] bg-[rgba(248,250,252,0.8)]">
              <tr>
                <SortableTh label="Nama" sortKey="fullName" activeKey={sort.key} dir={sort.dir} onSort={handleSort} className="pl-6" />
                <SortableTh label="No. Telp" sortKey="phoneNumber" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Role" sortKey="roleName" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <th className="py-[14px] text-left text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Username
                </th>
                <SortableTh label="Gaji Pokok" sortKey="baseSalary" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <SortableTh label="Status" sortKey="isActive" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                <th className="py-[14px] pr-6 text-center text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#94a3b8]">
                    Memuat data karyawan...
                  </td>
                </tr>
              )}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#94a3b8]">
                    {search || roleFilter || statusFilter
                      ? 'Tidak ada karyawan yang cocok.'
                      : 'Belum ada karyawan terdaftar.'}
                  </td>
                </tr>
              )}

              {!loading &&
                paged.map((row) => {
                  const inactive = !row.isActive;
                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-[#f1f5f9] first:border-t-0 ${
                        inactive ? 'bg-[rgba(248,250,252,0.4)]' : ''
                      }`}
                    >
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${avatarClass(
                              row.fullName,
                              inactive
                            )}`}
                          >
                            {initials(row.fullName)}
                          </span>
                          <span
                            className={`text-sm font-bold leading-5 ${
                              inactive ? 'text-[#1e293b]' : 'text-[#0f172a]'
                            }`}
                          >
                            {row.fullName}
                          </span>
                        </div>
                      </td>
                      <td className={`py-4 font-mono text-sm ${inactive ? 'text-[#64748b]' : 'text-[#334155]'}`}>
                        {row.phoneNumber}
                      </td>
                      <td className="py-4">
                        <RoleBadge type={row.roleType} name={row.roleName} inactive={inactive} />
                      </td>
                      <td className={`py-4 font-mono text-sm ${inactive ? 'text-[#94a3b8]' : 'text-[#475569]'}`}>
                        @{row.username}
                      </td>
                      <td
                        className={`py-4 font-mono text-sm font-bold ${
                          inactive ? 'text-[#475569]' : 'text-[#0f172a]'
                        }`}
                      >
                        {formatRupiah(row.baseSalary)}
                      </td>
                      <td className="py-4">
                        {row.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-3 py-1 text-xs font-bold text-white">
                            <span className="size-1.5 rounded-full bg-[#34d399]" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-[13px] py-1 text-xs font-bold text-[#475569]">
                            <span className="size-1.5 rounded-full bg-[#94a3b8]" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setDetailId(row.id)}
                            title="Detail karyawan"
                            className="rounded-lg border border-[#e2e8f0] p-[7px] text-[#475569] hover:bg-[#f8fafc]"
                          >
                            <Info className="size-3.5" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                              <img src={icMore} alt="Aksi" className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setDetailId(row.id)}>
                                <Info className="mr-2 size-3.5" />
                                Detail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setFormState({ id: row.id })}>
                                <Pencil className="mr-2 size-3.5" />
                                Ubah
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setQrEmployeeId(row.id)}>
                                <QrCode className="mr-2 size-3.5" />
                                Buat QR
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
          itemLabel="karyawan"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {formState && (
        <EmployeeFormModal
          employeeId={formState.id}
          onClose={() => setFormState(null)}
          onSaved={(name, mode) => {
            setFormState(null);
            setFlash(`Karyawan "${name}" berhasil ${mode === 'edit' ? 'diperbarui' : 'ditambahkan'}.`);
            loadData();
          }}
        />
      )}

      {detailId && (
        <EmployeeDetailModal
          employeeId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const id = detailId;
            setDetailId(null);
            setFormState({ id });
          }}
        />
      )}

      {qrEmployeeId && (
        <EmployeeQrModal employeeId={qrEmployeeId} onClose={() => setQrEmployeeId(null)} />
      )}
    </div>
  );
}