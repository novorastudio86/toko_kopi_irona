import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { saveRole } from '../../services/employees';
import type { RoleOption, RoleType } from '../../types/employee';
import { FieldError, FieldLabel, inputClass } from '../products/product-form/formUi';

const TYPE_OPTIONS: { value: RoleType; title: string; description: string }[] = [
  { value: 'kasir', title: 'Kasir', description: 'Login ke aplikasi Kasir (POS) untuk mencatat pesanan.' },
  { value: 'driver', title: 'Driver', description: 'Login ke aplikasi Driver untuk pengantaran pesanan.' },
  {
    value: 'staf',
    title: 'Tanpa Aplikasi',
    description: 'Tidak login ke aplikasi apa pun (mis. Barista). Cukup absen lewat kartu QR, tanpa password.',
  },
  { value: 'admin', title: 'Admin/Owner', description: 'Login ke Web Admin dengan akses penuh.' },
];

type Props = { role: RoleOption | null; onClose: () => void; onSaved: (name: string, mode: 'create' | 'edit') => void };

export default function RoleFormModal({ role, onClose, onSaved }: Props) {
  const isEdit = !!role;
  const [name, setName] = useState(role?.name ?? '');
  const [type, setType] = useState<RoleType>(role?.type ?? 'kasir');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function handleSave() {
    const next: Record<string, string | undefined> = {};
    if (!name.trim()) next.name = 'Nama role wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveRole({ name: name.trim(), type }, role?.id ?? null);
      onSaved(name.trim(), isEdit ? 'edit' : 'create');
    } catch (err: any) {
      setErrors({
        form:
          err?.code === '23505'
            ? `Role "${name.trim()}" sudah ada.`
            : err?.message ?? 'Gagal menyimpan role.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 pb-5 pt-5">
          <div>
            <h2 className="text-lg font-bold leading-7 text-[#0f172a]">{isEdit ? 'Ubah Role' : 'Tambah Role'}</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Role dipakai untuk mengelompokkan karyawan di Daftar Karyawan.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <FieldLabel required>Nama Role</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Barista, Kasir Shift Malam"
              className={inputClass(!!errors.name)}
            />
            <FieldError message={errors.name} />
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel required>Tipe Akses</FieldLabel>
            <div className="flex flex-col gap-2">
              {TYPE_OPTIONS.map((option) => {
                const selected = type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setType(option.value)}
                    className={`flex items-start gap-3 rounded-xl text-left transition-colors ${
                      selected
                        ? 'border-2 border-[#0f172a] bg-[#f8fafc] p-3.5'
                        : 'border border-[#e2e8f0] bg-white p-[15px] hover:border-[#cbd5e1]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                        selected ? 'border-[5px] border-[#0f172a] bg-white' : 'border border-[#94a3b8] bg-white'
                      }`}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-[#0f172a]">{option.title}</span>
                      <span className="text-[11px] leading-4 text-[#64748b]">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="flex items-start gap-2 text-[11px] leading-4 text-[#94a3b8]">
              <Info className="mt-px size-3.5 shrink-0" />
              Tipe menentukan aplikasi mana yang terbuka setelah karyawan login. Nama role bebas, boleh lebih dari satu
              role dengan tipe yang sama.
            </p>
          </div>

          {errors.form && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {errors.form}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#cbd5e1] bg-white px-5 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Role'}
          </button>
        </div>
      </div>
    </div>
  );
}