import { useState, type FormEvent } from 'react';
import { supabase } from '../services/supabase';
import logo from '../assets/irona-logo-1.png';
import backGround from '../assets/backadmin.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = { onLoginSuccess: () => void };

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Username dan password wajib diisi.');
      return;
    }
    setLoading(true);

    const email = `${username.trim().toLowerCase()}@irona.internal`;
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      setLoading(false);
      setErrorMsg('Username atau password salah.');
      return;
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, full_name, is_active, roles(type)')
      .eq('id', authData.user.id)
      .single();

    if (employeeError || !employee || !employee.is_active) {
      await supabase.auth.signOut();
      setLoading(false);
      setErrorMsg('Akun tidak aktif atau tidak ditemukan.');
      return;
    }

    const roleType = (employee.roles as any).type;
    if (roleType !== 'admin') {
      await supabase.auth.signOut();
      setLoading(false);
      setErrorMsg('Akun ini bukan Admin/Owner. Gunakan aplikasi Kasir/Driver untuk login.');
      return;
    }

    setLoading(false);
    onLoginSuccess();
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel kiri — branding, senada sidebar gelap Dashboard */}
      <div
        className="relative hidden w-1/2 flex-col justify-between bg-neutral-950 bg-cover bg-center p-12 text-white lg:flex"
        style={{ backgroundImage: `url(${backGround})` }}
      >
        <div className="absolute inset-0 bg-neutral-950/70" />

        <div className="relative flex h-12 items-center gap-3">
          <img src={logo} alt="Toko Kopi Irona" className="h-12 w-auto object-contain" />
          <span className="text-lg font-semibold text-white">Toko Kopi Irona</span>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">
            Kelola outlet-mu dengan mudah dan efisien
          </h2>
          <p className="mt-3 max-w-sm text-sm text-neutral-400">
            Dashboard operasional, keuangan, dan penjualan Toko Kopi Irona.
          </p>
        </div>

        <p className="relative text-xs text-neutral-500">© 2026 Toko Kopi Irona. Web Admin.</p>
      </div>

      {/* Panel kanan — form login */}
      <div className="flex w-full flex-col items-center justify-center bg-neutral-50 p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Logo tampil juga di mobile / panel kanan, kecil */}
          <div className="mb-8 flex h-10 items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 p-1.5">
              <img src={logo} alt="Toko Kopi Irona" className="h-full w-full object-contain" />
            </div>
            <span className="font-semibold text-neutral-900">Toko Kopi Irona</span>
          </div>

          <h1 className="text-2xl font-bold text-neutral-900">Masuk ke Web Admin</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Khusus Admin/Owner. Masukkan username dan password akunmu.
          </p>

          <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="owner1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoComplete="username"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {errorMsg && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {errorMsg}
              </p>
            )}

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? 'Memproses...' : 'Login'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}