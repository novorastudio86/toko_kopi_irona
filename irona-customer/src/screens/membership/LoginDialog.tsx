import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import SheetDialog from '@/components/SheetDialog';
import { cn } from '@/lib/utils';
import {
  DEMO_MEMBER_EMAIL,
  registerMember,
  sendLoginCode,
  verifyLoginCode,
} from '@/services/membership';
import type { Member } from '@/types/membership';
import { cleanPhone, PHONE_PATTERN } from '@/utils/format';
import { btnOutline, btnSolid, fieldClass, labelClass } from './styles';

type Step = 'email' | 'code' | 'profile';

const HEADINGS: Record<Step, { title: string; description: string }> = {
  email: {
    title: 'Masuk / Daftar Kora Club',
    description: 'Masukkan email, kami kirim kode masuk. Belum punya akun? Caranya sama.',
  },
  code: { title: 'Cek email kamu', description: '' },
  profile: {
    title: 'Kenalan dulu, yuk',
    description: 'Email ini belum terdaftar. Isi nama & nomor HP untuk jadi member.',
  },
};

const linkClass = 'font-medium text-foreground underline underline-offset-2';

/**
 * Alur masuk: email → kode → (member baru) nama & nomor HP.
 * Pop-up, bukan halaman, supaya isian checkout tidak hilang saat login.
 */
export default function LoginDialog({
  onClose,
  onSignedIn,
}: {
  onClose: () => void;
  onSignedIn: (member: Member) => void;
}) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Ganti langkah = fokus ke isian pertama langkah itu
  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, [step]);

  const goTo = (next: Step) => {
    setError(null);
    setResent(false);
    setStep(next);
  };

  const finish = (member: Member) => {
    onSignedIn(member);
    onClose();
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (step === 'profile' && !PHONE_PATTERN.test(cleanPhone(phone))) {
      setError('Nomor HP belum valid. Contoh: 081234567890');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (step === 'email') {
        await sendLoginCode(email);
        setCode('');
        goTo('code');
      } else if (step === 'code') {
        const member = await verifyLoginCode(email, code);
        if (member) finish(member);
        else goTo('profile');
      } else {
        finish(await registerMember(email, name.trim(), cleanPhone(phone)));
      }
    } catch (err) {
      console.error('Gagal masuk member', err);
      setError('Ada gangguan, coba lagi sebentar.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await sendLoginCode(email);
      setResent(true);
    } catch (err) {
      console.error('Gagal mengirim ulang kode', err);
      setError('Gagal mengirim ulang kode.');
    }
  }

  const heading =
    step === 'code'
      ? { title: HEADINGS.code.title, description: `Kode 6 angka sudah dikirim ke ${email}.` }
      : HEADINGS[step];

  return (
    <SheetDialog title={heading.title} description={heading.description} onClose={onClose}>
      <form ref={formRef} onSubmit={handleSubmit} noValidate={step === 'profile'}>
        {step === 'email' && (
          <>
            <label className={labelClass}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                autoComplete="email"
                required
                className={fieldClass}
              />
            </label>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Demo: <span className="font-mono">{DEMO_MEMBER_EMAIL}</span> = member lama, email lain
              = member baru.
            </p>
          </>
        )}

        {step === 'code' && (
          <>
            <label className={labelClass}>
              Kode masuk
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="••••••"
                required
                className={cn(fieldClass, 'text-center font-mono text-lg tracking-[0.5em]')}
              />
            </label>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Demo: kode 6 angka apa saja diterima.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <button
                type="button"
                onClick={() => goTo('email')}
                className={cn(linkClass, 'inline-flex items-center gap-1')}
              >
                <ArrowLeft aria-hidden className="size-3.5" />
                Ganti email
              </button>
              <span aria-live="polite">
                {resent ? (
                  'Kode baru sudah dikirim.'
                ) : (
                  <button type="button" onClick={resend} className={linkClass}>
                    Kirim ulang kode
                  </button>
                )}
              </span>
            </div>
          </>
        )}

        {step === 'profile' && (
          <div className="grid gap-3">
            <label className={labelClass}>
              Nama
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama panggilan"
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
                placeholder="08xxxxxxxxxx"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                aria-invalid={error !== null || undefined}
                className={fieldClass}
              />
              <span className="font-normal text-muted-foreground">
                Sebut nomor ini ke kasir saat belanja di toko supaya poinnya masuk.
              </span>
            </label>
            <p className="text-[12px] text-muted-foreground">
              Dengan mendaftar, kamu menyetujui{' '}
              <a href="/syarat-ketentuan" target="_blank" rel="noreferrer" className={linkClass}>
                Syarat &amp; Ketentuan
              </a>{' '}
              dan{' '}
              <a href="/kebijakan-privasi" target="_blank" rel="noreferrer" className={linkClass}>
                Kebijakan Privasi
              </a>
              .
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[12px] text-destructive">
            {error}
          </p>
        )}

        <div className="mt-4 grid gap-2">
          <button
            type="submit"
            disabled={busy || (step === 'profile' && !name.trim())}
            className={cn(btnSolid, 'h-10 text-[13px]')}
          >
            {busy
              ? 'Memproses…'
              : step === 'email'
                ? 'Kirim kode'
                : step === 'code'
                  ? 'Masuk'
                  : 'Daftar & masuk'}
          </button>
          {step === 'profile' && (
            <button
              type="button"
              onClick={() => goTo('email')}
              className={cn(btnOutline, 'h-10 text-[13px]')}
            >
              Pakai email lain
            </button>
          )}
        </div>
      </form>
    </SheetDialog>
  );
}
