import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Menu } from 'lucide-react';
import logo from '../assets/sidebar/logo.png';
import { AppSidebar } from '../components/AppSidebar';
import { SidebarRail } from '../components/SidebarRail';
import { resolveActiveNavId } from '../constants/navigation';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { supabase } from '../services/supabase';

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeItem = resolveActiveNavId(pathname);

  // ≥ 1280px: sidebar penuh. 768–1279px (iPad): rail ikon + panel menu melayang.
  // < 768px (HP): bar atas + panel menu melayang
  const isWide = useMediaQuery('(min-width: 1280px)');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Di layar lebar, sidebar bisa disempitkan jadi rail lewat tombol panel di header
  const [collapsed, setCollapsed] = useState(false);
  // Modul yang dipilih dari rail → langsung terbuka saat menu lengkap muncul
  const [menuModule, setMenuModule] = useState<string | null>(null);
  const showFull = isWide && !collapsed;

  // Tutup panel dengan tombol Esc
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  function openMenu(moduleId?: string) {
    setMenuModule(moduleId ?? null);
    if (isWide) setCollapsed(false);
    else setDrawerOpen(true);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      {isMobile ? (
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#232529] bg-[#1b1c1f] px-3">
          <img src={logo} alt="Toko Kopi Irona" className="h-14 w-20 object-cover" />
          <button
            onClick={() => openMenu()}
            aria-label="Buka menu"
            className="rounded-md p-2 text-[#cfd2d8] transition-colors hover:bg-[#282a2e]"
          >
            <Menu className="size-6" />
          </button>
        </header>
      ) : showFull ? (
        <AppSidebar
          activeItem={activeItem}
          onNavigate={(path) => navigate(path)}
          onLogout={handleLogout}
          onCollapse={() => setCollapsed(true)}
          initialModule={menuModule}
        />
      ) : (
        <SidebarRail
          activeItem={activeItem}
          onNavigate={(path) => navigate(path)}
          onOpenMenu={openMenu}
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
              onCollapse={() => setDrawerOpen(false)}
              initialModule={menuModule}
            />
          </div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] font-['Plus_Jakarta_Sans_Variable',sans-serif]">
        <Outlet />
      </main>
    </div>
  );
}
