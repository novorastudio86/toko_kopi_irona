import { LogOut, PanelLeft, type LucideIcon } from 'lucide-react';
import logo from '../assets/sidebar/logo.png';
import {
  SETTINGS_ITEM,
  allItems,
  containsActive,
  type NavItem,
} from '../constants/navigation';

type Props = {
  activeItem: string;
  onNavigate: (id: string) => void;
  /** Buka menu lengkap; kalau moduleId diisi, modul itu langsung terbuka */
  onOpenMenu: (moduleId?: string) => void;
  onLogout: () => void;
};

function RailButton({
  icon: Icon,
  title,
  active,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-current={active ? 'page' : undefined}
      className={`relative flex size-12 shrink-0 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-[#3a3d44] text-white' : 'text-[#cfd2d8] hover:bg-[#282a2e]/60'
      }`}
    >
      {active && (
        <span className="absolute inset-y-1.5 right-0 w-[3px] rounded-l-full bg-white" />
      )}
      <Icon className="size-[22px]" strokeWidth={1.75} />
    </button>
  );
}

export function SidebarRail({ activeItem, onNavigate, onOpenMenu, onLogout }: Props) {
  function handleClick(item: NavItem) {
    // Modul dengan sub modul → buka menu lengkap dengan modul itu terbuka, halaman tetap
    if (item.children?.length) onOpenMenu(item.id);
    else onNavigate(item.id);
  }

  return (
    <aside className="flex h-full w-[72px] shrink-0 flex-col items-center border-r border-[#232529] bg-[#1b1c1f] font-['Plus_Jakarta_Sans_Variable',sans-serif]">
      {/* Logo + tombol lebarkan sidebar */}
      <div className="flex w-full shrink-0 flex-col items-center gap-2 border-b border-[#232529] py-3">
        <img src={logo} alt="Toko Kopi Irona" className="size-14 object-cover" />
        <button
          onClick={() => onOpenMenu()}
          title="Lebarkan sidebar"
          aria-label="Lebarkan sidebar"
          className="rounded-md p-2 text-[#9a9ea6] transition-colors hover:bg-[#282a2e] hover:text-white"
        >
          <PanelLeft className="size-5" />
        </button>
      </div>

      <nav className="sidebar-scroll flex w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto py-3">
        {allItems.map((item) => (
          <RailButton
            key={item.id}
            icon={item.icon}
            title={item.title}
            active={item.children ? containsActive(item.children, activeItem) : activeItem === item.id}
            onClick={() => handleClick(item)}
          />
        ))}
      </nav>

      <div className="flex w-full shrink-0 flex-col items-center gap-1.5 border-t border-[#232529] py-3">
        <RailButton
          icon={SETTINGS_ITEM.icon}
          title={SETTINGS_ITEM.title}
          active={activeItem === SETTINGS_ITEM.id}
          onClick={() => onNavigate(SETTINGS_ITEM.id)}
        />
        <RailButton icon={LogOut} title="Keluar" onClick={onLogout} />
      </div>
    </aside>
  );
}
