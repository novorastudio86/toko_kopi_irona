import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, X } from 'lucide-react';
import logo from '../assets/sidebar/logo.png';
import icChevron from '../assets/sidebar/chevron.svg';
import icUpDown from '../assets/sidebar/updown.svg';
import {
  SETTINGS_ITEM,
  containsActive,
  findLocation,
  firstLeaf,
  navGroups,
  type NavItem,
  type NavNode,
  type Trailing,
} from '../constants/navigation';

/** Ikon modul: versi aktif kalau ada, kalau tidak di-invert jadi putih saat disorot */
export function NavItemIcon({ item, highlighted }: { item: NavItem; highlighted: boolean }) {
  if (highlighted && item.iconActive) {
    return <img src={item.iconActive} alt="" className="size-5" />;
  }
  return (
    <img src={item.icon} alt="" className={`size-5 ${highlighted ? 'brightness-0 invert' : ''}`} />
  );
}

/** Avatar outlet dengan ring gradien (dipakai juga di rail) */
export function OutletAvatar() {
  return (
    <div
      className="relative flex size-11 shrink-0 rounded-full p-0.5 shadow-[0px_0px_16px_-2px_rgba(56,189,248,0.3)]"
      style={{
        backgroundImage:
          'linear-gradient(45deg, rgb(235,122,38) 0%, rgb(246,206,176) 50%, rgb(255,109,0) 100%)',
      }}
    >
      <div className="relative flex-1 overflow-hidden rounded-full bg-[#0e1013]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.3)_0%,rgba(59,130,246,0)_50%)]" />
      </div>
    </div>
  );
}

function TrailingSlot({
  trailing,
  isOpen,
  highlighted,
}: {
  trailing?: Trailing;
  isOpen?: boolean;
  highlighted?: boolean;
}) {
  if (!trailing) return null;
  switch (trailing.type) {
    case 'chevron':
      return (
        <img
          src={icChevron}
          alt=""
          className={`size-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      );
    case 'count':
      return (
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-xs leading-4 ${
            highlighted ? 'bg-white text-[#21262f]' : 'bg-[#20252e] text-[#94a3b8]'
          }`}
        >
          {trailing.text}
        </span>
      );
    case 'dot':
      return <span className="size-2 shrink-0 rounded-full bg-[#94a3b8]" />;
    case 'tag':
      return (
        <span className="rounded border border-white/15 bg-white/10 px-[7px] py-[3px] text-[10px] font-bold leading-[15px] text-white">
          {trailing.text}
        </span>
      );
    case 'live':
      return (
        <span className="rounded bg-[#21262f] px-1.5 py-0.5 font-mono text-[10px] leading-[15px] text-[#94a3b8]">
          LIVE
        </span>
      );
  }
}

/** Modul tanpa sub modul yang sedang aktif — kotak highlight + garis putih di kiri */
function ActiveRow({ item, onClick }: { item: NavItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-[13px] py-[11px]"
    >
      <span className="flex items-center gap-3 pl-1.5">
        <span className="rounded-lg bg-white/10 p-1.5">
          <NavItemIcon item={item} highlighted />
        </span>
        <span className="text-sm font-semibold leading-5 tracking-[-0.35px] text-white">
          {item.title}
        </span>
      </span>
      {item.trailing?.type !== 'live' && <TrailingSlot trailing={item.trailing} highlighted />}
      <span className="absolute bottom-1.5 left-0 top-1.5 w-1.5 rounded-r-full bg-white shadow-[2px_0px_10px_1px_rgba(255,255,255,0.35)]" />
    </button>
  );
}

/** Modul yang salah satu turunannya aktif — kotak highlight tanpa garis kiri */
function ParentHighlightRow({
  item,
  isOpen,
  onClick,
}: {
  item: NavItem;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2.5"
    >
      <span className="flex items-center gap-3">
        <span className="rounded-lg bg-white/10 p-1.5">
          <NavItemIcon item={item} highlighted />
        </span>
        <span className="text-sm font-semibold leading-5 text-white">{item.title}</span>
      </span>
      <TrailingSlot trailing={item.trailing} isOpen={isOpen} highlighted />
    </button>
  );
}

function NormalRow({
  item,
  isOpen,
  onClick,
}: {
  item: NavItem;
  isOpen?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-white/5"
    >
      <span className="flex items-center gap-3">
        <span className="rounded-lg bg-[#1a1d24] p-1.5">
          <NavItemIcon item={item} highlighted={false} />
        </span>
        <span className="text-sm font-medium leading-5 text-[#cbd5e1]">{item.title}</span>
      </span>
      <TrailingSlot trailing={item.trailing} isOpen={isOpen} />
    </button>
  );
}

function Connector({ active, offsetForBorder }: { active: boolean; offsetForBorder?: boolean }) {
  return (
    <span
      className={`absolute top-1/2 h-px w-2 -translate-y-1/2 ${
        offsetForBorder ? '-left-[18px]' : '-left-[17px]'
      } ${active ? 'bg-white' : 'bg-[#2c323e]'}`}
    />
  );
}

type SubTreeProps = {
  nodes: NavNode[];
  activeItem: string;
  openGroup: string | null;
  parentGroupId: string | null;
  onGroupClick: (group: NavNode) => void;
  onLeafClick: (id: string, groupId: string | null) => void;
  nested?: boolean;
};

function SubTree({
  nodes,
  activeItem,
  openGroup,
  parentGroupId,
  onGroupClick,
  onLeafClick,
  nested,
}: SubTreeProps) {
  const list = (
    <div
      className={`flex flex-col gap-1 border-l border-[rgba(44,50,62,0.8)] pl-[17px] pt-1 ${
        nested ? 'ml-3' : 'w-[271px]'
      }`}
    >
      {nodes.map((node) => {
        if (node.children?.length) {
          const isOpen = openGroup === node.id;
          const hasActive = containsActive(node.children, activeItem);
          return (
            <div key={node.id} className="flex flex-col gap-1">
              <button
                onClick={() => onGroupClick(node)}
                className={`relative flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs leading-4 transition-colors hover:bg-white/5 ${
                  hasActive
                    ? 'font-semibold text-white'
                    : 'font-medium text-[#94a3b8] hover:text-[#cbd5e1]'
                }`}
              >
                <span>{node.title}</span>
                <img
                  src={icChevron}
                  alt=""
                  className={`size-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
                <Connector active={hasActive} />
              </button>
              {isOpen && (
                <SubTree
                  nodes={node.children}
                  activeItem={activeItem}
                  openGroup={openGroup}
                  parentGroupId={node.id}
                  onGroupClick={onGroupClick}
                  onLeafClick={onLeafClick}
                  nested
                />
              )}
            </div>
          );
        }

        const isActive = activeItem === node.id;
        return (
          <button
            key={node.id}
            onClick={() => onLeafClick(node.id, parentGroupId)}
            className={`relative flex w-full items-center justify-between rounded-lg text-left text-xs leading-4 ${
              isActive
                ? 'border border-white/15 bg-white/10 px-[13px] py-[9px] font-semibold text-white'
                : 'px-3 py-1.5 font-medium text-[#94a3b8] transition-colors hover:bg-white/5 hover:text-[#cbd5e1]'
            }`}
          >
            <span>{node.title}</span>
            {node.count && !isActive && (
              <span className="font-mono text-[10px] leading-4 text-[#64748b]">{node.count}</span>
            )}
            <Connector active={isActive} offsetForBorder={isActive} />
          </button>
        );
      })}
    </div>
  );

  return nested ? list : <div className="flex justify-end">{list}</div>;
}

type Props = {
  activeItem: string;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  /** Dipanggil saat pengguna memilih halaman akhir — dipakai untuk menutup panel di iPad */
  onPageChosen?: () => void;
  /** Kalau diisi, muncul tombol X di header (mode panel melayang) */
  onClose?: () => void;
};

export function AppSidebar({ activeItem, onNavigate, onLogout, onPageChosen, onClose }: Props) {
  const initial = findLocation(activeItem);
  const [openModule, setOpenModule] = useState<string | null>(initial.moduleId);
  const [openGroup, setOpenGroup] = useState<string | null>(initial.groupId);

  // Sinkronkan accordion saat URL berubah dari luar sidebar (back/forward, buka link langsung)
  useEffect(() => {
    const loc = findLocation(activeItem);
    setOpenModule(loc.moduleId);
    setOpenGroup(loc.groupId);
  }, [activeItem]);

  function handleSingleClick(id: string) {
    setOpenModule(null);
    setOpenGroup(null);
    onNavigate(id);
    onPageChosen?.();
  }

  function handleModuleClick(item: NavItem) {
    if (openModule === item.id) {
      setOpenModule(null);
      return;
    }
    const { leafId, groupId } = firstLeaf(item.children!);
    setOpenModule(item.id);
    setOpenGroup(groupId);
    onNavigate(leafId);
  }

  function handleGroupClick(group: NavNode) {
    if (openGroup === group.id) {
      setOpenGroup(null);
      return;
    }
    setOpenGroup(group.id);
    onNavigate(group.children![0].id);
  }

  function handleLeafClick(id: string, groupId: string | null) {
    setOpenGroup(groupId);
    onNavigate(id);
    onPageChosen?.();
  }

  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-r border-[#2a303c] bg-[#12151a] font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
      {/* BrandHeader */}
      <div className="border-b border-[rgba(44,50,62,0.8)] bg-gradient-to-b from-[rgba(26,29,36,0.6)] to-[rgba(26,29,36,0)] px-5 pb-[17px] pt-5">
        <div className="flex items-center gap-3.5">
          <img src={logo} alt="Toko Kopi Irona" className="h-[62px] w-[109px] object-contain" />
          <span className="text-base font-extrabold uppercase leading-6 tracking-[0.4px] text-white">
            Admin Kora
          </span>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Tutup menu"
              className="ml-auto rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#cbd5e1] hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-[23px] overflow-y-auto px-3.5 pb-[67px] pt-[11px]">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <p className="px-3 text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.55px] text-[rgba(148,163,184,0.8)]">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                if (!item.children?.length) {
                  return activeItem === item.id ? (
                    <ActiveRow key={item.id} item={item} onClick={() => handleSingleClick(item.id)} />
                  ) : (
                    <NormalRow key={item.id} item={item} onClick={() => handleSingleClick(item.id)} />
                  );
                }

                const isOpen = openModule === item.id;
                const hasActive = containsActive(item.children, activeItem);
                return (
                  <div key={item.id} className="flex flex-col gap-1">
                    {hasActive ? (
                      <ParentHighlightRow item={item} isOpen={isOpen} onClick={() => handleModuleClick(item)} />
                    ) : (
                      <NormalRow item={item} isOpen={isOpen} onClick={() => handleModuleClick(item)} />
                    )}
                    {isOpen && (
                      <SubTree
                        nodes={item.children}
                        activeItem={activeItem}
                        openGroup={openGroup}
                        parentGroupId={null}
                        onGroupClick={handleGroupClick}
                        onLeafClick={handleLeafClick}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="border-t border-[rgba(44,50,62,0.6)] pt-2.5">
          {activeItem === SETTINGS_ITEM.id ? (
            <ActiveRow item={SETTINGS_ITEM} onClick={() => handleSingleClick(SETTINGS_ITEM.id)} />
          ) : (
            <button
              onClick={() => handleSingleClick(SETTINGS_ITEM.id)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-white/5"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-lg bg-[#1a1d24] p-1.5">
                  <img src={SETTINGS_ITEM.icon} alt="" className="size-5" />
                </span>
                <span className="text-sm font-medium leading-5 text-[#cbd5e1]">{SETTINGS_ITEM.title}</span>
              </span>
              <span className="rounded bg-[#1a1d24] px-1.5 py-0.5 text-[10px] leading-[15px] text-[#94a3b8]">
                v2.4
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* OutletSwitcherFooter */}
      <div className="border-t border-[#2c323e] bg-[rgba(14,16,19,0.8)] px-3.5 pb-3.5 pt-[15px]">
        <div className="flex items-center justify-between rounded-2xl border border-[#2c323e] bg-[rgba(26,29,36,0.9)] p-[11px]">
          <div className="flex items-center gap-3">
            <OutletAvatar />
            <span className="text-xs font-bold leading-4 tracking-[0.3px] text-white">Toko Kopi Irona</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-lg p-1.5 hover:bg-white/5">
              <img src={icUpDown} alt="Ganti outlet" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-48">
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 size-4" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  );
}