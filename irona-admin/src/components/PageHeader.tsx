import { Fragment, type ReactNode } from 'react';
import { useLocation, useOutletContext } from 'react-router';
import { Popover } from '@base-ui/react/popover';
import { Info, X } from 'lucide-react';
import { getNavTrail, resolveActiveNavId } from '../constants/navigation';

type Props = {
  title: string;
  info?: string;
  badge?: string;
  action?: ReactNode;
};

export function PageHeader({ title, info, badge, action }: Props) {
  // Sidebar penuh sudah menunjukkan posisi halaman, breadcrumb cuma perlu saat sidebar disempitkan
  const sidebarOpen = useOutletContext<{ sidebarOpen?: boolean } | undefined>()?.sidebarOpen;
  const breadcrumb = getNavTrail(resolveActiveNavId(useLocation().pathname));
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-white p-[25px] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-1.5">
        {!sidebarOpen && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-2 text-xs leading-4">
            {breadcrumb.map((crumb, i) => (
              <Fragment key={crumb}>
                {i > 0 && <span className="font-medium text-[#cbd5e1]">/</span>}
                <span
                  className={
                    i === breadcrumb.length - 1
                      ? 'font-semibold text-[#0f172a]'
                      : 'font-medium text-[#64748b]'
                  }
                >
                  {crumb}
                </span>
              </Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2.5">
          <h2 className="text-2xl font-extrabold leading-[30px] tracking-[-0.6px] text-[#0f172a]">
            {title}
          </h2>
          {info && (
            <Popover.Root>
              <Popover.Trigger
                aria-label={`Tentang ${title}`}
                className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-[#cbd5e1] bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
              >
                <Info className="size-[18px]" strokeWidth={2.25} />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner side="bottom" align="start" alignOffset={-12} sideOffset={10} className="z-50">
                  <Popover.Popup className="w-[min(560px,calc(100vw-32px))] rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] outline-none">
                    <Popover.Arrow className="-top-[9px] data-[side=top]:hidden">
                      <span className="block size-4 translate-y-1 rotate-45 border-l border-t border-[#e2e8f0] bg-white" />
                    </Popover.Arrow>
                    <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569]">
                          <Info className="size-4" strokeWidth={2.25} />
                        </span>
                        <Popover.Title className="text-sm font-bold leading-5 text-[#0f172a]">
                          Tentang {title}
                        </Popover.Title>
                      </div>
                      <Popover.Close
                        aria-label="Tutup"
                        className="flex size-6 items-center justify-center rounded-md text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                      >
                        <X className="size-4" />
                      </Popover.Close>
                    </div>
                    <Popover.Description className="pt-3 text-xs leading-[19.5px] text-[#475569]">
                      {info}
                    </Popover.Description>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )}
          {badge && (
            <span className="rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-2.5 py-0.5 text-[11px] font-semibold leading-4 text-[#475569]">
              {badge}
            </span>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}