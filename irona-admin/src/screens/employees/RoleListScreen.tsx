import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Lock, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { deleteRole, fetchPayroll, fetchRolesWithEmployees } from '../../services/employees';
import { formatRupiah } from '../../utils/format';
import type { PayrollRow, RoleType, RoleWithEmployees } from '../../types/employee';
import EmployeeFormModal from './EmployeeFormModal';
import EmployeeDetailModal from './EmployeeDetailModal';
import RoleFormModal from './RoleFormModal';
import icPlus from '../../assets/ui/plus.svg';

const TYPE_LABELS: Record<RoleType, string> = {
  admin: 'Admin/Owner',
  kasir: 'Kasir',
  driver: 'Driver',
  staf: 'Tanpa Aplikasi',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Tanggal lokal (WIB) → "2026-09-01", tidak bergeser ke UTC */
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 27 → "27m", 90 → "1j 30m", 120 → "2j" */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}j` : `${h}j ${m}m`;
}

function TypeBadge({ type }: { type: RoleType }) {
  if (type === 'admin') {
    return (
      <span className="inline-flex items-center rounded-md bg-[#1a1c20] px-2.5 py-1 text-[11px] font-bold text-white">
        {TYPE_LABELS[type]}
      </span>
    );
  }
  if (type === 'driver') {
    return (
      <span className="inline-flex items-center rounded-md border-2 border-dashed border-[#94a3b8] bg-[#f8fafc] px-3 py-1 text-[11px] font-bold text-[#334155]">
        {TYPE_LABELS[type]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[#cbd5e1] bg-white px-[11px] py-1 text-[11px] font-bold text-[#334155]">
      {TYPE_LABELS[type]}
    </span>
  );
}

export default function RoleListScreen() {
  const [roles, setRoles] = useState<RoleWithEmployees[]>([]);
  const [payroll, setPayroll] = useState<Map<string, PayrollRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string[]>([]);
  const [roleForm, setRoleForm] = useState<{ role: RoleWithEmployees | null } | null>(null);
  const [employeeForm, setEmployeeForm] = useState<{ id: string | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const start = localISO(new Date(now.getFullYear(), now.getMonth(), 1));
      const end = localISO(now);

      const [data, payrollData] = await Promise.all([fetchRolesWithEmployees(), fetchPayroll(start, end)]);
      setRoles(data);
      setPayroll(payrollData);
      setExpanded(data.filter((r) => r.employees.length > 0).map((r) => r.id));
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat data role.');
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

  function toggle(id: string) {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleDelete(role: RoleWithEmployees) {
    if (!window.confirm(`Hapus role "${role.name}"?`)) return;
    setActionError(null);
    try {
      await deleteRole(role.id);
      setFlash(`Role "${role.name}" berhasil dihapus.`);
      loadData();
    } catch (err: any) {
      if (err?.code === '23503') {
        setActionError(
          `Role "${role.name}" masih dipakai karyawan. Pindahkan karyawannya ke role lain dulu sebelum menghapus.`
        );
      } else {
        setActionError(err?.message ?? 'Gagal menghapus role.');
      }
    }
  }

  const totalEmployees = roles.reduce((sum, r) => sum + r.employees.length, 0);

  return (
    <div className="flex max-w-[1200px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Hak Akses"
        info="Pengelompokan karyawan berdasarkan role, lengkap dengan rincian gaji pokok dan bonus bulan berjalan."
        badge={loading ? undefined : `${roles.length} role · ${totalEmployees} karyawan`}
        action={
          <button
            onClick={() => setRoleForm({ role: null })}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.3px] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b]"
          >
            <img src={icPlus} alt="" className="size-4" />
            Tambah Role
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

      {loading ? (
        <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat data role...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {roles.map((role) => {
            const isOpen = expanded.includes(role.id);
            const activeCount = role.employees.filter((e) => e.isActive).length;
            const isAdminRole = role.type === 'admin';

            return (
              <div
                key={role.id}
                className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
              >
                {/* Kepala kartu */}
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <button onClick={() => toggle(role.id)} className="flex flex-1 items-center gap-3 text-left">
                    <span className="rounded-lg p-1 text-[#64748b]">
                      {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </span>
                    <span className="text-sm font-bold text-[#0f172a]">{role.name}</span>
                    <TypeBadge type={role.type} />
                    <span className="text-xs text-[#64748b]">
                      {role.employees.length === 0
                        ? 'Belum ada karyawan'
                        : `${role.employees.length} karyawan${
                            activeCount < role.employees.length ? ` · ${activeCount} aktif` : ''
                          }`}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setEmployeeForm({ id: null })}
                      title="Tambah karyawan"
                      className="rounded-lg border border-[#e2e8f0] p-[7px] text-[#475569] hover:bg-[#f8fafc]"
                    >
                      <UserPlus className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setRoleForm({ role })}
                      disabled={isAdminRole}
                      title={isAdminRole ? 'Role Admin/Owner tidak bisa diubah' : 'Ubah role'}
                      className="rounded-lg border border-[#e2e8f0] p-[7px] text-[#475569] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isAdminRole ? <Lock className="size-3.5" /> : <Pencil className="size-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(role)}
                      disabled={isAdminRole || role.employees.length > 0}
                      title={
                        isAdminRole
                          ? 'Role Admin/Owner tidak bisa dihapus'
                          : role.employees.length > 0
                            ? 'Masih ada karyawan di role ini'
                            : 'Hapus role'
                      }
                      className="rounded-lg border border-[#e2e8f0] p-[7px] text-[#475569] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Rincian gaji */}
                {isOpen && (
                  <div className="border-t border-[#f1f5f9] bg-[rgba(248,250,252,0.6)] px-5 py-4">
                    {role.employees.length === 0 ? (
                      <p className="py-2 text-center text-xs text-[#94a3b8]">Belum ada karyawan di role ini.</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between pb-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#64748b]">
                            Rincian Gaji Bulan Ini
                          </p>
                          <p className="text-[11px] text-[#94a3b8]">
                            Total:{' '}
                            {formatRupiah(
                              role.employees.reduce(
                                (sum, e) => sum + (payroll.get(e.id)?.totalSalary ?? e.baseSalary),
                                0
                              )
                            )}
                          </p>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
                          <table className="w-full border-collapse">
                            <thead className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                              <tr className="text-xs font-bold uppercase tracking-[0.4px] text-[#64748b]">
                                <th className="px-4 py-2 text-left">Karyawan</th>
                                <th className="px-3 py-2 text-right">Gaji Pokok</th>
                                {role.type === 'driver' && <th className="px-3 py-2 text-right">Bonus Antar</th>}
                                <th className="px-3 py-2 text-right">Bonus Lembur</th>
                                <th className="px-3 py-2 text-right">Bonus Shift 2</th>
                                <th className="px-3 py-2 text-right">Kasbon</th>
                                <th className="px-4 py-2 text-right">Total Diterima</th>
                              </tr>
                            </thead>
                            <tbody>
                              {role.employees.map((employee) => {
                                const pay = payroll.get(employee.id);
                                const deliveryBonus = pay?.deliveryBonusTotal ?? 0;
                                const overtimeMinutes = pay?.overtimeMinutes ?? 0;
                                const overtimeBonus = pay?.overtimeBonusTotal ?? 0;
                                const extraShiftMinutes = pay?.extraShiftMinutes ?? 0;
                                const extraShiftBonus = pay?.extraShiftBonusTotal ?? 0;
                                const kasbonTotal = pay?.kasbonTotal ?? 0;
                                const total = pay?.totalSalary ?? employee.baseSalary;

                                return (
                                  <tr key={employee.id} className="border-t border-[#f1f5f9] first:border-t-0">
                                    <td className="px-4 py-2.5">
                                      <button
                                        onClick={() => setDetailId(employee.id)}
                                        className="flex items-center gap-2.5 text-left"
                                      >
                                        <span
                                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                                            employee.isActive
                                              ? 'bg-[#0f172a] text-white'
                                              : 'bg-[#e2e8f0] text-[#475569]'
                                          }`}
                                        >
                                          {initials(employee.fullName)}
                                        </span>
                                        <span className="flex flex-col">
                                          <span className="text-sm font-bold text-[#0f172a]">
                                            {employee.fullName}
                                          </span>
                                          <span className="font-mono text-xs text-[#64748b]">
                                            @{employee.username}
                                            {!employee.isActive && ' · nonaktif'}
                                          </span>
                                        </span>
                                      </button>
                                    </td>

                                    <td className="px-3 py-2.5 text-right font-mono text-sm text-[#475569]">
                                      {formatRupiah(employee.baseSalary)}
                                    </td>

                                    {role.type === 'driver' && (
                                      <td className="px-3 py-2.5 text-right">
                                        <span className="font-mono text-sm text-[#475569]">
                                          {formatRupiah(deliveryBonus)}
                                        </span>
                                        <span className="block text-xs text-[#94a3b8]">
                                          {pay?.deliveryCount ?? 0} antar ×{' '}
                                          {employee.deliveryBonus > 0
                                            ? formatRupiah(employee.deliveryBonus)
                                            : 'belum diatur'}
                                        </span>
                                      </td>
                                    )}

                                    <td className="px-3 py-2.5 text-right">
                                      <span className="font-mono text-sm text-[#475569]">
                                        {formatRupiah(overtimeBonus)}
                                      </span>
                                      <span className="block text-xs text-[#94a3b8]">
                                        {overtimeMinutes > 0
                                          ? `${formatDuration(overtimeMinutes)} × ${formatRupiah(pay?.hourlyRate ?? 0)}/jam`
                                          : 'Tidak ada lembur'}
                                      </span>
                                    </td>

                                    <td className="px-3 py-2.5 text-right">
                                      <span className="font-mono text-sm text-[#475569]">
                                        {formatRupiah(extraShiftBonus)}
                                      </span>
                                      <span className="block text-xs text-[#94a3b8]">
                                        {extraShiftMinutes > 0
                                          ? `${formatDuration(extraShiftMinutes)} × ${formatRupiah(pay?.hourlyRate ?? 0)}/jam`
                                          : 'Tidak ada shift 2'}
                                      </span>
                                    </td>

                                    <td className="px-3 py-2.5 text-right">
                                      <span
                                        className={`font-mono text-sm ${kasbonTotal > 0 ? 'font-semibold text-[#e11d48]' : 'text-[#475569]'}`}
                                      >
                                        {kasbonTotal > 0 ? `− ${formatRupiah(kasbonTotal)}` : formatRupiah(0)}
                                      </span>
                                      <span className="block text-xs text-[#94a3b8]">
                                        {kasbonTotal > 0 ? `${pay?.kasbonCount ?? 0} kasbon` : 'Tidak ada kasbon'}
                                      </span>
                                    </td>

                                    <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-[#0f172a]">
                                      {formatRupiah(total)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <p className="pt-2 text-[11px] leading-4 text-[#94a3b8]">
                          Bonus lembur & shift 2 = (gaji pokok ÷ jam shift utama terjadwal sebulan) × durasinya. Total
                          Diterima = gaji pokok + semua bonus − kasbon bulan ini.
                          {role.type === 'driver' &&
                            ' Bonus antar bertambah otomatis setiap driver menandai pesanan selesai di aplikasi Driver.'}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {roleForm && (
        <RoleFormModal
          role={roleForm.role}
          onClose={() => setRoleForm(null)}
          onSaved={(name, mode) => {
            setRoleForm(null);
            setFlash(`Role "${name}" berhasil ${mode === 'edit' ? 'diperbarui' : 'ditambahkan'}.`);
            loadData();
          }}
        />
      )}

      {employeeForm && (
        <EmployeeFormModal
          employeeId={employeeForm.id}
          onClose={() => setEmployeeForm(null)}
          onSaved={(name) => {
            setEmployeeForm(null);
            setFlash(`Karyawan "${name}" berhasil ditambahkan.`);
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
            setEmployeeForm({ id });
          }}
        />
      )}
    </div>
  );
}