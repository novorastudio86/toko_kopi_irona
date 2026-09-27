import { Fragment } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, PanelLeftOpen } from 'lucide-react';
import logo from '../assets/sidebar/logo.png';
import { NavItemIcon, OutletAvatar } from './AppSidebar';
import {
  SETTINGS_ITEM,
  containsActive,
  firstLeaf,
  navGroups,
  type NavItem,
} from '../constants/navigation';

type Props = {
  activeItem: string;
  onNavigate: (id: string) => void;
  onOpenMenu: () => void;
  onLogout: () => void;
};

function RailButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={item.title}
      aria-label={item.title}
      aria-current={active ? 'page' : undefined}
      className={`relative flex size-11 items-center justify-center rounded-xl transition-colors ${
        active ? 'border border-white/15 bg-white/10' : 'hover:bg-white/5'
      }`}
    >
      {active && (
        <span className="absolute -left-4 bottom-2 top-2 w-1 rounded-r-full bg-white shadow-[2px_0px_10px_1px_rgba(255,255,255,0.35)]" />
      )}
      <NavItemIcon item={item} highlighted={active} />
      {item.trailing?.type === 'dot' && (
        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#94a3b8]" />
      )}
    </button>
  );
}

export function SidebarRail({ activeItem, onNavigate, onOpenMenu, onLogout }: Props) {
  function handleClick(item: NavItem) {
    if (!item.children?.length) {
      onNavigate(item.id);
      return;
    }
    // Modul yang sedang aktif diklik lagi → buka menu lengkap untuk pilih sub modul lain
    if (containsActive(item.children, activeItem)) {
      onOpenMenu();
      return;
    }
    onNavigate(firstLeaf(item.children).leafId);
  }

  return (
    <aside className="flex h-screen w-[76px] shrink-0 flex-col items-center border-r border-[#2a303c] bg-[#12151a] font-['Plus_Jakarta_Sans_Variable',sans-serif]">
      {/* Logo + tombol buka menu lengkap */}
      <div className="flex w-full flex-col items-center gap-3 border-b border-[rgba(44,50,62,0.8)] bg-gradient-to-b from-[rgba(26,29,36,0.6)] to-[rgba(26,29,36,0)] py-4">
        <img src={logo} alt="Toko Kopi Irona" className="h-[30px] w-[52px] object-contain" />
        <button
          onClick={onOpenMenu}
          title="Buka menu lengkap"
          aria-label="Buka menu lengkap"
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-[#cbd5e1] hover:bg-white/10"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      </div>

      {/* Ikon modul per grup */}
      <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-4 py-3">
        {navGroups.map((group, idx) => (
          <Fragment key={group.label}>
            {idx > 0 && <div className="my-2 h-px w-8 shrink-0 bg-white/10" />}
            {group.items.map((item) => (
              <RailButton
                key={item.id}
                item={item}
                active={item.children ? containsActive(item.children, activeItem) : activeItem === item.id}
                onClick={() => handleClick(item)}
              />
            ))}
          </Fragment>
        ))}

        <div className="my-2 h-px w-8 shrink-0 bg-white/10" />
        <RailButton
          item={SETTINGS_ITEM}
          active={activeItem === SETTINGS_ITEM.id}
          onClick={() => onNavigate(SETTINGS_ITEM.id)}
        />
      </nav>

      {/* Outlet + logout */}
      <div className="flex w-full justify-center border-t border-[#2c323e] bg-[rgba(14,16,19,0.8)] py-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full" title="Toko Kopi Irona">
            <OutletAvatar />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-48">
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="mr-2 size-4" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}