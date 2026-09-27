import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

function FullscreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
      <div className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
    </div>
  );
}

/** Halaman dashboard: wajib login sebagai admin */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullscreenLoader />;
  if (status !== 'admin') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Halaman login: kalau sudah login sebagai admin, lempar ke halaman tujuan */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  if (status === 'admin') return <Navigate to={from} replace />;
  return <>{children}</>;
}