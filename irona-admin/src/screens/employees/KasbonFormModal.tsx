import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { fetchEmployees } from '../../services/employees';
import { fetchKasbonQuota, saveKasbon } from '../../services/kasbon';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate, todayISO } from '../../utils/date';
import type { EmployeeListItem } from '../../types/employee';
import type { Kasbon, KasbonQuota } from '../../types/kasbon';
import { FieldError, FieldLabel, RupiahInput, inputClass } from '../products/product-form/formUi';

type Props = {
  kasbon: Kasbon | null;
  onClose: () => void;
  onSaved: (employeeName: string, mode: 'create' | 'edit') => void;
};

export default function KasbonFormModal({ kasbon, onClose, onSaved }: Props) {
  const isEdit = !!kasbon;
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthLabel = parseLocalDate(today).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [employeeId, setEmployeeId] = useState(kasbon?.employeeId ?? '');
  const [amount, setAmount] = useState(kasbon ? String(Math.round(kasbon.amount)) : '');
  const [date, setDate] = useState(kasbon?.requestDate ?? today);
  const [notes, setNotes] = useState(kasbon?.notes ?? '');

  const [quota, setQuota] = useState<KasbonQuota | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  async function loadQuota(forEmployee: string, forDate: string) {
    setQuota(null);
    if (!forEmployee || !forDate) return;
    try {
      setQuota(await fetchKasbonQuota(forEmployee, forDate, kasbon?.id ?? null));
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, form: err?.message ?? 'Gagal memuat info gaji.' }));
    }
  }

  useEffect(() => {
    fetchEmployees()
      .then((list) => setEmployees(list.filter((e) => e.isActive && e.roleType !== 'admin')))
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat karyawan.' }));
    if (kasbon) loadQuota(kasbon.employeeId, kasbon.requestDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const amountNumber = Number(amount) || 0;
  const overQuota = quota !== null && amountNumber > quota.remainingAmount;
  const employeeName = employees.find((e) => e.id === employeeId)?.fullName ?? kasbon?.employeeName ?? '';

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!employeeId) next.employee = 'Pilih karyawan.';
    if (!(amountNumber > 0)) next.amount = 'Jumlah kasbon wajib diisi.';
    else if (overQuota) next.amount = `Melebihi sisa gaji bulan ini (${formatRupiah(quota!.remainingAmount)}).`;
    if (!date) next.date = 'Tanggal pengajuan wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveKasbon(
        { employeeId, amount: amountNumber, requestDate: date, notes: notes.trim() || null },
        kasbon?.id ?? null
      );
      onSaved(employeeName, isEdit ? 'edit' : 'create');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan kasbon.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">{isEdit ? 'Ubah Kasbon' : 'Tambah Kasbon'}</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Dipotong sekaligus dari gaji {monthLabel}.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Karyawan</FieldLabel>
            <select
              value={employeeId}
              disabled={isEdit}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                loadQuota(e.target.value, date);
              }}
              className={`${inputClass(!!errors.employee)} disabled:bg-[#f1f5f9] disabled:text-[#64748b]`}
            >
              {isEdit ? (
                <option value={kasbon.employeeId}>{kasbon.employeeName}</option>
              ) : (
                <>
                  <option value="">Pilih karyawan</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.roleName})
                    </option>
                  ))}
                </>
              )}
            </select>
            <FieldError message={errors.employee} />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-[3] flex-col gap-1.5">
              <FieldLabel required>Jumlah Kasbon</FieldLabel>
              <RupiahInput value={amount} onChange={setAmount} hasError={!!errors.amount || overQuota} placeholder="0" />
              <FieldError message={errors.amount} />
            </div>
            <div className="flex flex-[2] flex-col gap-1.5">
              <FieldLabel required>Tanggal Pengajuan</FieldLabel>
              <input
                type="date"
                value={date}
                min={monthStart}
                max={today}
                onChange={(e) => {
                  setDate(e.target.value);
                  loadQuota(employeeId, e.target.value);
                }}
                className={inputClass(!!errors.date)}
              />
              <FieldError message={errors.date} />
            </div>
          </div>

          {quota && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-xs">
              <div className="flex justify-between text-[#475569]">
                <span>Gaji pokok</span>
                <span className="font-mono">{formatRupiah(quota.baseSalary)}</span>
              </div>
              <div className="flex justify-between text-[#475569]">
                <span>Kasbon lain bulan ini</span>
                <span className="font-mono">− {formatRupiah(quota.usedAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-[#e2e8f0] pt-1.5 font-semibold text-[#0f172a]">
                <span>Sisa yang bisa diajukan</span>
                <span className={`font-mono ${overQuota ? 'text-[#e11d48]' : ''}`}>
                  {formatRupiah(quota.remainingAmount)}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Catatan</FieldLabel>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Keperluan berobat"
              className={inputClass()}
            />
          </div>

          <p className="flex items-center gap-2 text-[11px] leading-4 text-[#64748b]">
            <Info className="size-3.5 shrink-0" />
            Kasbon otomatis mengurangi gaji bulan pengajuan. Bisa diubah atau dihapus selama bulan ini belum lewat.
          </p>

          {errors.form && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {errors.form}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
          <button
            onClick={onClose}
            className="rounded border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
