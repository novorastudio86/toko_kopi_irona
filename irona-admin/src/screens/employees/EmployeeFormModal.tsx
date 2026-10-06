import { useEffect, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import {
  createEmployee,
  fetchEmployeeDetail,
  fetchEmployeesWithPin,
  fetchRoles,
  setEmployeePin,
  updateEmployee,
} from '../../services/employees';
import type { RoleOption, RoleType } from '../../types/employee';
import { todayISO } from '../../utils/date';
import { FieldError, FieldLabel, RupiahInput, inputClass } from '../products/product-form/formUi';

type Props = {
  employeeId?: string | null;
  onClose: () => void;
  onSaved: (name: string, mode: 'create' | 'edit') => void;
};

export default function EmployeeFormModal({ employeeId = null, onClose, onSaved }: Props) {
  const isEdit = !!employeeId;

  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [salary, setSalary] = useState('');
  const [deliveryBonus, setDeliveryBonus] = useState('');
  const [hireDate, setHireDate] = useState(todayISO());
  const [originalRoleType, setOriginalRoleType] = useState<RoleType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const roleList = await fetchRoles();
        if (cancelled) return;
        setRoles(roleList);

        if (!employeeId) {
          setRoleId(roleList.find((r) => r.type === 'kasir')?.id ?? roleList[0]?.id ?? '');
        } else {
          const [detail, withPin] = await Promise.all([
            fetchEmployeeDetail(employeeId),
            fetchEmployeesWithPin(),
          ]);
          if (cancelled || !detail) return;
          setHasPin(withPin.has(employeeId));
          setFullName(detail.fullName);
          setAddress(detail.address ?? '');
          setPhone(detail.phoneNumber);
          setRoleId(detail.roleId);
          setUsername(detail.username);
          setSalary(String(Math.round(detail.baseSalary)));
          setDeliveryBonus(
            detail.deliveryBonus > 0 ? String(Math.round(detail.deliveryBonus)) : ''
          );
          setHireDate(detail.hireDate);
          setOriginalRoleType(detail.roleType);
        }
      } catch (err: any) {
        if (!cancelled) setErrors({ form: err?.message ?? 'Gagal memuat data.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const roleType = roles.find((r) => r.id === roleId)?.type;
  const isDriverRole = roleType === 'driver';
  // Hanya Admin/Owner yang login dengan password (Web Admin & membuka Kasir/Driver App).
  // Kasir & Driver masuk aplikasi dengan PIN 6 digit; Staf (mis. Barista) tidak login sama sekali.
  const usesPassword = roleType === 'admin';
  const usesPin = roleType === 'kasir' || roleType === 'driver';
  // Password wajib untuk admin baru, atau kalau role lama belum memakai password
  const passwordRequired = usesPassword && (!isEdit || originalRoleType !== 'admin');
  // PIN wajib untuk kasir/driver baru; saat ubah, kosongkan = tidak diubah
  const pinRequired = usesPin && !isEdit;

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!fullName.trim()) next.fullName = 'Nama lengkap wajib diisi.';
    if (!phone.trim()) next.phone = 'Nomor telepon wajib diisi.';
    if (!roleId) next.role = 'Pilih role jabatan.';
    if (!username.trim()) next.username = 'Username wajib diisi.';
    else if (!/^[a-z0-9._-]+$/i.test(username.trim()))
      next.username = 'Username hanya boleh huruf, angka, titik, garis bawah, dan strip.';
    if (usesPassword) {
      if (passwordRequired && password.length < 6) next.password = 'Password minimal 6 karakter.';
      if (!passwordRequired && password && password.length < 6)
        next.password = 'Password minimal 6 karakter.';
    }
    if (usesPin) {
      if (pinRequired && !pin) next.pin = 'PIN wajib diisi.';
      else if (pin && !/^\d{6}$/.test(pin)) next.pin = 'PIN harus 6 digit angka.';
    }
    if (!hireDate) next.hireDate = 'Tanggal mulai kerja wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = {
      fullName: fullName.trim(),
      address: address.trim() || null,
      phoneNumber: phone.trim(),
      username: username.trim().toLowerCase(),
      password: usesPassword ? password : '',
      roleId,
      baseSalary: Number(salary) || 0,
      deliveryBonus: isDriverRole ? Number(deliveryBonus) || 0 : 0,
      hireDate,
    };

    setSaving(true);
    try {
      const id = isEdit ? employeeId! : await createEmployee(input);
      if (isEdit) await updateEmployee(id, input);
      if (usesPin && pin) await setEmployeePin(id, pin);
      onSaved(input.fullName, isEdit ? 'edit' : 'create');
    } catch (err: any) {
      const message = String(err?.message ?? '');
      if (message.includes('duplicate') || message.includes('already')) {
        setErrors({
          username: `Username "${input.username}" sudah dipakai karyawan lain.`,
        });
      } else {
        setErrors({ form: message || 'Gagal menyimpan karyawan.' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between px-8 pb-2 pt-7">
          <div>
            <h2 className="text-2xl font-bold leading-8 tracking-[-0.6px] text-[#0f172a]">
              {isEdit ? 'Ubah Karyawan' : 'Tambah Karyawan'}
            </h2>
            <p className="pt-1 text-sm leading-5 text-[#64748b]">
              {isEdit
                ? 'Perbarui data personel dan akses login aplikasi'
                : 'Daftarkan personel baru ke dalam sistem kasir dan operasional outlet'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-8 py-5">
          {loading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat data...</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <FieldLabel required>Nama Lengkap</FieldLabel>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Siti Maharani"
                  className={inputClass(!!errors.fullName)}
                />
                <FieldError message={errors.fullName} />
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel>Alamat Tempat Tinggal</FieldLabel>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Anggrek No. 14, Lowokwaru, Kota Malang"
                  className={`${inputClass()} resize-none font-normal leading-[22px]`}
                />
              </div>

              <div className="flex gap-5">
                <div className="flex flex-1 flex-col gap-2">
                  <FieldLabel required>No. Telepon / WhatsApp</FieldLabel>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className={`${inputClass(!!errors.phone)} font-mono`}
                  />
                  <FieldError message={errors.phone} />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <FieldLabel required>Role Jabatan</FieldLabel>
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className={inputClass(!!errors.role)}
                  >
                    <option value="">Pilih role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.role} />
                </div>
              </div>

              <div className="flex gap-5">
                <div className="flex flex-1 flex-col gap-2">
                  <FieldLabel required>Tanggal Mulai Kerja</FieldLabel>
                  <input
                    type="date"
                    value={hireDate}
                    max={todayISO()}
                    onChange={(e) => setHireDate(e.target.value)}
                    className={inputClass(!!errors.hireDate)}
                  />
                  <FieldError message={errors.hireDate} />
                </div>
                <div className="flex-1" />
              </div>

              {/* Pemisah akses login */}
              <div className="relative flex items-center justify-center py-1">
                <span className="absolute inset-x-0 top-1/2 h-px bg-[#e2e8f0]" />
                <span className="relative rounded-lg bg-[#f1f5f9] px-4 py-2 text-xs font-bold uppercase tracking-[0.55px] text-[#475569]">
                  {usesPassword
                    ? 'Akses Login Web Admin & Perangkat Kasir/Driver'
                    : usesPin
                      ? 'Akses Kasir / Driver App (PIN)'
                      : 'Identitas Karyawan'}
                </span>
              </div>

              <div className="flex gap-5">
                <div className="flex flex-1 flex-col gap-2">
                  <FieldLabel required>Username</FieldLabel>
                  <div
                    className={`flex items-center rounded-xl border bg-white pl-4 ${
                      errors.username ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
                    }`}
                  >
                    <span className="font-mono text-sm text-[#94a3b8]">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder="sitimaharani"
                      autoCapitalize="none"
                      className="w-full bg-transparent px-2 py-[13px] font-mono text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
                    />
                  </div>
                  <FieldError message={errors.username} />
                </div>

                {usesPin ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <FieldLabel required={pinRequired}>PIN (6 digit)</FieldLabel>
                    <div
                      className={`flex items-center rounded-xl border bg-white pr-3 ${
                        errors.pin ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
                      }`}
                    >
                      <input
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder={
                          pinRequired || !hasPin ? '6 digit angka' : 'Kosongkan jika tidak diubah'
                        }
                        autoComplete="off"
                        className="w-full bg-transparent px-4 py-[13px] font-mono text-sm tracking-[0.3em] text-[#0f172a] outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-[#94a3b8]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                        className="text-[#94a3b8] hover:text-[#0f172a]"
                      >
                        {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <FieldError message={errors.pin} />
                    {!errors.pin && (
                      <p
                        className={`text-xs leading-4 ${isEdit && !hasPin ? 'text-[#92400e]' : 'text-[#94a3b8]'}`}
                      >
                        {isEdit && !hasPin
                          ? 'Belum punya PIN — karyawan ini belum bisa masuk Kasir/Driver App.'
                          : 'Dipakai untuk masuk Kasir/Driver App. Boleh sama dengan karyawan lain.'}
                      </p>
                    )}
                  </div>
                ) : !usesPassword ? (
                  <div className="flex flex-1 items-center rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-3 text-xs leading-5 text-[#64748b]">
                    Role ini tidak login ke aplikasi, jadi tidak perlu password atau PIN. Absen
                    cukup dengan kartu QR.
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-2">
                    <FieldLabel required={passwordRequired}>Password</FieldLabel>
                    <div
                      className={`flex items-center rounded-xl border bg-white pr-3 ${
                        errors.password ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'
                      }`}
                    >
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          passwordRequired ? 'Minimal 6 karakter' : 'Kosongkan jika tidak diubah'
                        }
                        autoComplete="new-password"
                        className="w-full bg-transparent px-4 py-[13px] font-mono text-sm text-[#0f172a] outline-none placeholder:font-sans placeholder:text-[#94a3b8]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        className="text-[#94a3b8] hover:text-[#0f172a]"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <FieldError message={errors.password} />
                  </div>
                )}
              </div>

              <div className="flex gap-5">
                <div className="flex flex-1 flex-col gap-2">
                  <FieldLabel>Gaji Pokok</FieldLabel>
                  <RupiahInput value={salary} onChange={setSalary} placeholder="3.500.000" />
                  <p className="text-xs leading-4 text-[#94a3b8]">
                    Gaji bulanan dasar belum termasuk komisi kasir atau bonus kehadiran
                  </p>
                </div>

                {isDriverRole && (
                  <div className="flex flex-1 flex-col gap-2">
                    <FieldLabel>Bonus per Pengantaran</FieldLabel>
                    <RupiahInput
                      value={deliveryBonus}
                      onChange={setDeliveryBonus}
                      placeholder="3.000"
                    />
                    <p className="text-xs leading-4 text-[#94a3b8]">
                      Otomatis ditambahkan setiap driver menandai pesanan selesai. Kosongkan jika
                      belum ditentukan.
                    </p>
                  </div>
                )}
              </div>

              {errors.form && (
                <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
                  {errors.form}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#e2e8f0] px-8 pb-6 pt-5">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#cbd5e1] bg-white px-6 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-xl bg-[#0f172a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Karyawan'}
          </button>
        </div>
      </div>
    </div>
  );
}
