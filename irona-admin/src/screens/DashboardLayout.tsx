import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { AppSidebar } from '../components/AppSidebar';
import { SidebarRail } from '../components/SidebarRail';
import { resolveActiveNavId } from '../constants/navigation';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { supabase } from '../services/supabase';

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeItem = resolveActiveNavId(pathname);

  // ≥ 1280px: sidebar penuh. Di bawah itu (iPad): rail ikon + panel menu melayang
  const isWide = useMediaQuery('(min-width: 1280px)');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (isWide) setDrawerOpen(false);
  }, [isWide]);

  // Tutup panel dengan tombol Esc
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex h-screen">
      {isWide ? (
        <AppSidebar activeItem={activeItem} onNavigate={(path) => navigate(path)} onLogout={handleLogout} />
      ) : (
        <SidebarRail
          activeItem={activeItem}
          onNavigate={(path) => navigate(path)}
          onOpenMenu={() => setDrawerOpen(true)}
          onLogout={handleLogout}
        />
      )}

      {!isWide && drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-[#0f172a]/40 animate-in fade-in duration-200"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative z-10 h-full animate-in slide-in-from-left duration-200">
            <AppSidebar
              activeItem={activeItem}
              onNavigate={(path) => navigate(path)}
              onLogout={handleLogout}
              onPageChosen={() => setDrawerOpen(false)}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto bg-[#f8fafc] font-['Plus_Jakarta_Sans_Variable',sans-serif]">
        <Outlet />
      </main>
    </div>
  );
}