import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchExpense, fetchPayrollForMonth, saveExpense } from '../../services/finance';
import type { ExpenseType } from '../../types/finance';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import { FieldError, FieldLabel, RupiahInput, inputClass } from '../products/product-form/formUi';

type Props = {
  type: ExpenseType;
  expenseId: string | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

type PayrollRow = Awaited<ReturnType<typeof fetchPayrollForMonth>>[number];

/** Bulan lalu dalam format "2026-08" (gaji biasanya dibayar untuk bulan sebelumnya) */
function defaultSalaryMonth(): string {
  const [y, m] = todayISO().split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ExpenseFormModal({ type, expenseId, onClose, onSaved }: Props) {
  const isEdit = !!expenseId;
  const isSalary = type === 'gaji';

  const [name, setName] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(defaultSalaryMonth());
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (!expenseId) return;
    fetchExpense(expenseId)
      .then((e) => {
        setName(e.name);
        if (e.salaryMonth) setSalaryMonth(e.salaryMonth.slice(0, 7));
        setEmployeeId(e.employeeId ?? '');
        setAmount(String(Math.round(e.amount)));
        setDate(e.expenseDate);
        setNotes(e.notes ?? '');
        setLoaded(true);
      })
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat pengeluaran.' }));
  }, [expenseId]);

  useEffect(() => {
    if (!isSalary || !salaryMonth) return;
    setLoadingPayroll(true);
    fetchPayrollForMonth(`${salaryMonth}-01`)
      .then(setPayroll)
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat data gaji.' }))
      .finally(() => setLoadingPayroll(false));
  }, [isSalary, salaryMonth]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const selected = payroll.find((p) => p.employeeId === employeeId) ?? null;

  function chooseEmployee(id: string) {
    setEmployeeId(id);
    const p = payroll.find((x) => x.employeeId === id);
    // Nominal otomatis = gaji bersih dari payroll (tetap bisa diubah)
    if (p) setAmount(String(Math.round(p.totalSalary)));
  }

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (isSalary) {
      if (!salaryMonth) next.salaryMonth = 'Pilih bulan gaji.';
      if (!employeeId) next.employee = 'Pilih karyawan.';
    } else if (!name.trim()) next.name = 'Nama pengeluaran wajib diisi.';
    if (!(Number(amount) > 0)) next.amount = 'Nominal harus lebih dari 0.';
    if (!date) next.date = 'Tanggal wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveExpense(
        {
          expenseType: type,
          name: name.trim(),
          employeeId: isSalary ? employeeId : null,
          salaryMonth: isSalary ? `${salaryMonth}-01` : null,
          amount: Number(amount),
          expenseDate: date,
          notes: notes.trim() || null,
        },
        expenseId
      );
      const label = isSalary ? `Gaji ${selected?.fullName ?? ''}`.trim() : name.trim();
      onSaved(`${label} berhasil ${isEdit ? 'diperbarui' : 'dicatat'} di Fixed Cost.`);
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan pengeluaran.' });
    } finally {
      setSaving(false);
    }
  }

  const title = isSalary ? 'Pembayaran Gaji' : 'Pengeluaran Lain';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              {isEdit ? `Ubah ${title}` : title}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Dicatat keluar dari bucket Fixed Cost.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        {!loaded ? (
          <p className="p-10 text-center text-xs text-[#94a3b8]">{errors.form ?? 'Memuat...'}</p>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto p-6">
            {isSalary ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel required>Bulan Gaji</FieldLabel>
                    <input
                      type="month"
                      value={salaryMonth}
                      max={todayISO().slice(0, 7)}
                      onChange={(e) => {
                        setSalaryMonth(e.target.value);
                        if (!isEdit) {
                          setEmployeeId('');
                          setAmount('');
                        }
                      }}
                      className={inputClass(!!errors.salaryMonth)}
                    />
                    <FieldError message={errors.salaryMonth} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel required>Karyawan</FieldLabel>
                    <select
                      value={employeeId}
                      onChange={(e) => chooseEmployee(e.target.value)}
                      disabled={loadingPayroll}
                      className={inputClass(!!errors.employee)}
                    >
                      <option value="">{loadingPayroll ? 'Memuat...' : 'Pilih karyawan'}</option>
                      {payroll.map((p) => (
                        <option
                          key={p.employeeId}
                          value={p.employeeId}
                          disabled={p.paid && p.employeeId !== employeeId}
                        >
                          {p.fullName}
                          {p.paid && p.employeeId !== employeeId ? ' (sudah dibayar)' : ''}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.employee} />
                  </div>
                </div>

                {selected && (
                  <div className="flex flex-col gap-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-xs">
                    <p className="pb-1 text-xs font-bold uppercase tracking-[0.5px] text-[#64748b]">
                      Hitungan Payroll
                    </p>
                    <div className="flex justify-between text-[#475569]">
                      <span>Gaji Pokok</span>
                      <span className="font-mono">{formatRupiah(selected.baseSalary)}</span>
                    </div>
                    <div className="flex justify-between text-[#475569]">
                      <span>Bonus (lembur, shift tambahan, antar)</span>
                      <span className="font-mono">{formatRupiah(selected.bonusTotal)}</span>
                    </div>
                    <div className="flex justify-between text-[#475569]">
                      <span>Potongan Kasbon</span>
                      <span className="font-mono text-[#be123c]">
                        −{formatRupiah(selected.kasbonTotal)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold text-[#0f172a]">
                      <span>Gaji Bersih</span>
                      <span className="font-mono">{formatRupiah(selected.totalSalary)}</span>
                    </div>
                    {selected.pendingOvertimeMinutes > 0 && (
                      <p className="mt-1 rounded-lg bg-[#fffbeb] px-3 py-2 text-xs leading-4 text-[#92400e]">
                        ⚠ Ada lembur {selected.pendingOvertimeMinutes} menit yang belum diputuskan
                        di Presensi. Lembur itu belum termasuk di gaji ini — putuskan dulu kalau mau
                        ikut dibayar.
                      </p>
                    )}
                    {selected.kasbonTotal > 0 && (
                      <p className="pt-1 text-xs text-[#64748b]">
                        Kasbon sudah dicatat keluar saat diberikan, jadi yang dibayar sekarang cukup
                        gaji bersih.
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Nama Pengeluaran</FieldLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: WiFi, Listrik, Gas LPG"
                  className={inputClass(!!errors.name)}
                />
                <FieldError message={errors.name} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>{isSalary ? 'Nominal Dibayarkan' : 'Nominal'}</FieldLabel>
                <RupiahInput value={amount} onChange={setAmount} hasError={!!errors.amount} />
                <FieldError message={errors.amount} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>{isSalary ? 'Tanggal Bayar' : 'Tanggal'}</FieldLabel>
                <input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass(!!errors.date)}
                />
                <FieldError message={errors.date} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>Keterangan</FieldLabel>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isSalary ? 'Contoh: Transfer BCA' : 'Contoh: Tagihan bulan Agustus'}
                className={inputClass()}
              />
            </div>

            <p className="text-xs leading-4 text-[#94a3b8]">
              Bisa diubah atau dihapus selama masih di bulan yang sama dengan tanggalnya. Setelah
              ganti bulan, catatan terkunci.
            </p>

            {errors.form && (
              <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
                {errors.form}
              </p>
            )}
          </div>
        )}

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
          <button
            onClick={onClose}
            className="rounded border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !loaded}
            className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
