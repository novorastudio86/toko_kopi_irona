import { useEffect, useState } from 'react';
import { ChevronDown, LogOut, PanelLeft } from 'lucide-react';
import logo from '../assets/sidebar/logo.png';
import {
  SETTINGS_ITEM,
  allItems,
  containsActive,
  countTables,
  findLocation,
  type NavItem,
  type NavNode,
} from '../constants/navigation';
import { fetchNavCounts } from '../services/navCounts';

// Jalur aktif (modul → sub modul → halaman) memakai sorotan & penanda yang sama
const ACTIVE = 'bg-[#3a3d44] text-white';
const ActiveMarker = () => (
  <span className="absolute inset-y-1.5 right-0 w-[3px] rounded-l-full bg-white" />
);

/** Baris modul (level 1): disorot kalau dirinya / salah satu turunannya aktif */
function ModuleRow({
  item,
  highlighted,
  isOpen,
  onClick,
}: {
  item: NavItem;
  highlighted: boolean;
  isOpen?: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-current={highlighted && !item.children ? 'page' : undefined}
      className={`relative flex w-full items-center justify-between rounded-lg px-3.5 py-3 transition-colors ${
        highlighted ? ACTIVE : 'text-[#cfd2d8] hover:bg-[#282a2e]/60'
      }`}
    >
      {highlighted && <ActiveMarker />}
      <span className="flex items-center gap-3.5">
        <Icon className="size-[22px] shrink-0" strokeWidth={1.75} />
        <span className="text-[15px] font-medium leading-6">{item.title}</span>
      </span>
      {item.children && (
        <ChevronDown
          className={`size-[18px] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      )}
    </button>
  );
}

type SubTreeProps = {
  nodes: NavNode[];
  activeItem: string;
  openGroup: string | null;
  parentGroupId: string | null;
  onGroupClick: (group: NavNode) => void;
  onLeafClick: (id: string, groupId: string | null) => void;
  counts: Record<string, number>;
  nested?: boolean;
};

function SubTree({
  nodes,
  activeItem,
  openGroup,
  parentGroupId,
  onGroupClick,
  onLeafClick,
  counts,
  nested,
}: SubTreeProps) {
  return (
    <div className={`flex flex-col gap-1 ${nested ? 'pl-3.5' : 'py-1 pl-12'}`}>
      {nodes.map((node) => {
        if (node.children?.length) {
          const isOpen = openGroup === node.id;
          const hasActive = containsActive(node.children, activeItem);
          return (
            <div key={node.id} className="flex flex-col gap-1">
              <button
                onClick={() => onGroupClick(node)}
                className={`relative flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-[15px] font-medium leading-6 transition-colors ${
                  hasActive ? ACTIVE : 'text-[#9a9ea6] hover:bg-[#282a2e]/60 hover:text-[#cfd2d8]'
                }`}
              >
                {hasActive && <ActiveMarker />}
                <span>{node.title}</span>
                <ChevronDown
                  className={`size-[18px] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOpen && (
                <SubTree
                  nodes={node.children}
                  activeItem={activeItem}
                  openGroup={openGroup}
                  parentGroupId={node.id}
                  onGroupClick={onGroupClick}
                  onLeafClick={onLeafClick}
                  counts={counts}
                  nested
                />
              )}
            </div>
          );
        }

        const isActive = activeItem === node.id;
        const count = node.countTable ? counts[node.countTable] : 0;
        return (
          <button
            key={node.id}
            onClick={() => onLeafClick(node.id, parentGroupId)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-[15px] font-medium leading-6 transition-colors ${
              isActive ? ACTIVE : 'text-[#9a9ea6] hover:bg-[#282a2e]/60 hover:text-[#cfd2d8]'
            }`}
          >
            {isActive && <ActiveMarker />}
            <span>{node.title}</span>
            {count > 0 && (
              <span className="rounded bg-[#262626] px-1.5 py-0.5 font-mono text-xs leading-4 text-[#cecece]">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  activeItem: string;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  /** Tombol panel di header: sempitkan sidebar (layar lebar) / tutup panel (iPad) */
  onCollapse: () => void;
  /** Dipanggil saat pengguna memilih halaman akhir — dipakai untuk menutup panel di iPad */
  onPageChosen?: () => void;
  /** Modul yang langsung terbuka saat sidebar muncul (dipilih dari rail) */
  initialModule?: string | null;
};

export function AppSidebar({
  activeItem,
  onNavigate,
  onLogout,
  onCollapse,
  onPageChosen,
  initialModule,
}: Props) {
  const initial = findLocation(activeItem);
  const [openModule, setOpenModule] = useState<string | null>(initialModule ?? initial.moduleId);
  const [openGroup, setOpenGroup] = useState<string | null>(initial.groupId);

  // Sinkronkan accordion saat halaman berubah (klik menu, back/forward, buka link langsung)
  const [prevActive, setPrevActive] = useState(activeItem);
  if (prevActive !== activeItem) {
    setPrevActive(activeItem);
    setOpenModule(initial.moduleId);
    setOpenGroup(initial.groupId);
  }

  // Badge jumlah data; dihitung ulang tiap pindah halaman supaya ikut berubah setelah tambah/hapus data
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    fetchNavCounts(countTables).then((c) => !cancelled && setCounts(c));
    return () => {
      cancelled = true;
    };
  }, [activeItem]);

  function handleSingleClick(id: string) {
    setOpenModule(null);
    setOpenGroup(null);
    onNavigate(id);
    onPageChosen?.();
  }

  // Modul & grup hanya buka/tutup daftar turunannya — pindah halaman baru saat halaman akhir dipilih
  function handleModuleClick(item: NavItem) {
    setOpenModule(openModule === item.id ? null : item.id);
  }

  function handleGroupClick(group: NavNode) {
    setOpenGroup(openGroup === group.id ? null : group.id);
  }

  function handleLeafClick(id: string, groupId: string | null) {
    setOpenGroup(groupId);
    onNavigate(id);
    onPageChosen?.();
  }

  return (
    <aside className="flex h-full w-[280px] max-w-[85vw] shrink-0 flex-col border-r border-[#232529] bg-[#1b1c1f] font-['Plus_Jakarta_Sans_Variable',sans-serif]">
      {/* Header brand */}
      <div className="relative flex h-[76px] shrink-0 items-center justify-end border-b border-[#232529] px-5">
        <img
          src={logo}
          alt="Toko Kopi Irona"
          className="pointer-events-none absolute -top-[6px] left-3 size-[96px] object-cover"
        />
        <button
          onClick={onCollapse}
          title="Sempitkan sidebar"
          aria-label="Sempitkan sidebar"
          className="rounded-md p-2 text-[#9a9ea6] transition-colors hover:bg-[#282a2e] hover:text-white"
        >
          <PanelLeft className="size-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        {allItems.map((item) => {
          if (!item.children?.length) {
            return (
              <ModuleRow
                key={item.id}
                item={item}
                highlighted={activeItem === item.id}
                onClick={() => handleSingleClick(item.id)}
              />
            );
          }

          const isOpen = openModule === item.id;
          return (
            <div key={item.id} className="flex flex-col gap-1">
              <ModuleRow
                item={item}
                highlighted={containsActive(item.children, activeItem)}
                isOpen={isOpen}
                onClick={() => handleModuleClick(item)}
              />
              {isOpen && (
                <SubTree
                  nodes={item.children}
                  activeItem={activeItem}
                  openGroup={openGroup}
                  parentGroupId={null}
                  onGroupClick={handleGroupClick}
                  onLeafClick={handleLeafClick}
                  counts={counts}
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* Pengaturan + keluar */}
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-[#232529] p-3">
        <ModuleRow
          item={SETTINGS_ITEM}
          highlighted={activeItem === SETTINGS_ITEM.id}
          onClick={() => handleSingleClick(SETTINGS_ITEM.id)}
        />
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3.5 rounded-lg px-3.5 py-3 text-[#cfd2d8] transition-colors hover:bg-[#282a2e]/60"
        >
          <LogOut className="size-[22px] shrink-0" strokeWidth={1.75} />
          <span className="text-[15px] font-medium leading-6">Keluar</span>
        </button>
      </div>
    </aside>
  );
}
