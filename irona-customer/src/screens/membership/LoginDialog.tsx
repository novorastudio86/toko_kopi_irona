import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import SheetDialog from '@/components/SheetDialog';
import { cn } from '@/lib/utils';
import {
  MemberAuthError,
  resendSignUpCode,
  resetPasswordWithCode,
  sendResetCode,
  signInMember,
  signUpMember,
  verifySignUpCode,
} from '@/services/membership';
import type { Member } from '@/types/membership';
import { cleanPhone, PHONE_PATTERN } from '@/utils/format';
import { btnOutline, btnSolid, fieldClass, labelClass } from './styles';

/** login = tampilan awal. Email notifikasi hanya untuk verify (daftar) & reset (lupa password). */
type Step = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

const MIN_PASSWORD = 8;

const HEADINGS: Record<Step, { title: string; description: string; submit: string }> = {
  login: {
    title: 'Masuk Kora Club',
    description: 'Masuk pakai email & password akun member kamu.',
    submit: 'Masuk',
  },
  register: {
    title: 'Daftar Kora Club',
    description: 'Isi data di bawah, kami kirim kode verifikasi ke email kamu.',
    submit: 'Daftar',
  },
  verify: { title: 'Verifikasi email', description: '', submit: 'Verifikasi & masuk' },
  forgot: {
    title: 'Lupa password',
    description: 'Masukkan email akun kamu, kami kirim kode untuk membuat password baru.',
    submit: 'Kirim kode reset',
  },
  reset: { title: 'Buat password baru', description: '', submit: 'Simpan & masuk' },
};

const fieldLg = cn(fieldClass, 'h-11 md:text-[15px]');
const labelLg = cn(labelClass, 'gap-1.5 text-sm');
const linkClass = 'font-medium text-foreground underline underline-offset-2';
const hintClass = 'text-[13px] text-muted-foreground';

/**
 * Masuk = email + password. Daftar & lupa password lanjut ke kode 6 angka dari email.
 * Pop-up, bukan halaman, supaya isian checkout tidak hilang saat login.
 */
export default function LoginDialog({
  initialStep = 'login',
  onClose,
  onSignedIn,
}: {
  initialStep?: 'login' | 'register';
  onClose: () => void;
  onSignedIn: (member: Member) => void;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
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

  // Kode & password lama tidak ikut terbawa ke langkah berikutnya
  const goToCode = (next: 'verify' | 'reset') => {
    setCode('');
    if (next === 'reset') setPassword('');
    goTo(next);
  };

  const finish = (member: Member) => {
    onSignedIn(member);
    onClose();
  };

  const signUpData = () => ({
    name: name.trim(),
    phoneNumber: cleanPhone(phone),
    email,
    password,
  });

  function validate(): string | null {
    if (step === 'register' && !PHONE_PATTERN.test(cleanPhone(phone)))
      return 'Nomor WhatsApp belum valid. Contoh: 081234567890';
    if ((step === 'register' || step === 'reset') && password.length < MIN_PASSWORD)
      return `Password minimal ${MIN_PASSWORD} karakter.`;
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (step === 'login') finish(await signInMember(email, password));
      else if (step === 'register') {
        await signUpMember(signUpData());
        goToCode('verify');
      } else if (step === 'verify') finish(await verifySignUpCode(email, code));
      else if (step === 'forgot') {
        await sendResetCode(email);
        goToCode('reset');
      } else finish(await resetPasswordWithCode(email, code, password));
    } catch (err) {
      // Sudah daftar tapi belum isi kode: kode baru sudah dikirim, lanjut ke langkah verifikasi
      if (err instanceof MemberAuthError && err.code === 'email_not_confirmed') {
        goToCode('verify');
        setResent(true);
        return;
      }
      if (!(err instanceof MemberAuthError)) console.error('Gagal masuk member', err);
      const message =
        err instanceof MemberAuthError ? err.message : 'Ada gangguan, coba lagi sebentar.';
      setError(
        step === 'login' && err instanceof MemberAuthError ? (
          <>
            {message} Belum punya akun?{' '}
            <button type="button" onClick={() => goTo('register')} className={linkClass}>
              Daftar dulu
            </button>
          </>
        ) : (
          message
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      if (step === 'verify') await resendSignUpCode(email);
      else await sendResetCode(email);
      setResent(true);
    } catch (err) {
      if (!(err instanceof MemberAuthError)) console.error('Gagal mengirim ulang kode', err);
      setError(err instanceof MemberAuthError ? err.message : 'Gagal mengirim ulang kode.');
    }
  }

  const heading = HEADINGS[step];
  const description =
    step === 'verify' || step === 'reset'
      ? `Kode 6 angka sudah dikirim ke ${email}.`
      : heading.description;

  const emailField = (
    <label className={labelLg}>
      Email
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="nama@email.com"
        autoComplete="email"
        required
        className={fieldLg}
      />
    </label>
  );

  const codeField = (
    <label className={labelLg}>
      Kode dari email
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        placeholder="••••••"
        required
        className={cn(fieldLg, 'text-center font-mono text-lg tracking-[0.5em] md:text-lg')}
      />
      <span className="text-[13px] font-normal text-muted-foreground">
        Berlaku 10 menit. Tidak ada di kotak masuk? Cek folder spam.
      </span>
    </label>
  );

  return (
    <SheetDialog title={heading.title} description={description} onClose={onClose} large>
      <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
        {step === 'login' && (
          <>
            {emailField}
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              action={
                <button
                  type="button"
                  onClick={() => goTo('forgot')}
                  className={cn(linkClass, 'text-[13px]')}
                >
                  Lupa password?
                </button>
              }
            />
          </>
        )}

        {step === 'register' && (
          <>
            <label className={labelLg}>
              Nama
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama panggilan"
                autoComplete="name"
                maxLength={50}
                required
                className={fieldLg}
              />
            </label>
            <label className={labelLg}>
              Nomor WhatsApp
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                className={fieldLg}
              />
              <span className="text-[13px] font-normal text-muted-foreground">
                Sebut nomor ini ke kasir saat belanja di toko supaya poinnya masuk.
              </span>
            </label>
            {emailField}
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hint={`Minimal ${MIN_PASSWORD} karakter.`}
            />
            <p className={hintClass}>
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
          </>
        )}

        {step === 'forgot' && emailField}

        {(step === 'verify' || step === 'reset') && (
          <>
            {codeField}
            {step === 'reset' && (
              <PasswordField
                label="Password baru"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                hint={`Minimal ${MIN_PASSWORD} karakter.`}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <button
                type="button"
                onClick={() => goTo(step === 'verify' ? 'register' : 'forgot')}
                className={cn(linkClass, 'inline-flex items-center gap-1')}
              >
                <ArrowLeft aria-hidden className="size-3.5" />
                {step === 'verify' ? 'Ubah data' : 'Ganti email'}
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

        {error && (
          <p role="alert" className="text-[13px] text-destructive">
            {error}
          </p>
        )}

        <div className="grid gap-3">
          <button type="submit" disabled={busy} className={cn(btnSolid, 'h-11 text-sm')}>
            {busy ? 'Memproses…' : heading.submit}
          </button>
          {step === 'login' && (
            <>
              <Divider>Belum punya akun?</Divider>
              <button
                type="button"
                onClick={() => goTo('register')}
                className={cn(btnOutline, 'h-11 text-sm')}
              >
                Daftar member baru
              </button>
            </>
          )}
          {(step === 'register' || step === 'forgot') && (
            <p className="text-center text-[13px] text-muted-foreground">
              {step === 'register' ? 'Sudah punya akun? ' : 'Ingat password? '}
              <button type="button" onClick={() => goTo('login')} className={linkClass}>
                Masuk
              </button>
            </p>
          )}
        </div>
      </form>
    </SheetDialog>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  action,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
  action?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="grid gap-1.5">
      {/* Label & aksi (mis. lupa password) sebaris; tombol di luar <label> supaya klik tidak memfokus input */}
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`pw-${autoComplete}`} className={labelLg}>
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <input
          id={`pw-${autoComplete}`}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className={cn(fieldLg, 'pr-11')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[6px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </div>
      {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
      <span aria-hidden className="h-px flex-1 bg-border" />
      {children}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
