import { useState, type FormEvent } from 'react';
import SheetDialog from '@/components/SheetDialog';
import { useMember } from '@/hooks/useMember';
import { cn } from '@/lib/utils';
import type { Member } from '@/types/membership';
import { cleanPhone, PHONE_PATTERN } from '@/utils/format';
import { btnOutline, btnSolid, fieldClass, labelClass } from './styles';

/** Edit nama & nomor HP. Email hanya tampil karena dipakai untuk masuk. */
export default function ProfileDialog({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const { updateProfile } = useMember();
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phoneNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const phoneNumber = cleanPhone(phone);
    if (!name.trim()) return setError('Nama belum diisi.');
    if (!PHONE_PATTERN.test(phoneNumber))
      return setError('Nomor HP belum valid. Contoh: 081234567890');
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ name: name.trim(), phoneNumber });
      onClose();
    } catch (err) {
      console.error('Gagal menyimpan profil', err);
      setError('Gagal menyimpan, coba lagi.');
      setBusy(false);
    }
  }

  return (
    <SheetDialog title="Edit profil" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="grid gap-3">
        <div className="grid gap-1 text-xs">
          <span className="font-medium">Email</span>
          <p className="flex h-10 items-center rounded-[6px] border border-dashed border-border bg-secondary px-3 text-sm">
            {member.email}
          </p>
          <span className="text-muted-foreground">Dipakai untuk masuk, tidak bisa diubah.</span>
        </div>
        <label className={labelClass}>
          Nama
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={50}
            required
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Nomor HP / WhatsApp
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            className={fieldClass}
          />
          <span className="font-normal text-muted-foreground">
            Poin belanja di toko masuk lewat nomor ini.
          </span>
        </label>

        {error && (
          <p role="alert" className="text-[12px] text-destructive">
            {error}
          </p>
        )}

        <div className="mt-1 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className={cn(btnOutline, 'h-10 text-[13px]')}>
            Batal
          </button>
          <button type="submit" disabled={busy} className={cn(btnSolid, 'h-10 text-[13px]')}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </SheetDialog>
  );
}
