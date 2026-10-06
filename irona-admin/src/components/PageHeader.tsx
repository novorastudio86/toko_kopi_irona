import { Fragment, type ReactNode } from 'react';
import { useLocation, useOutletContext } from 'react-router';
import icInfo from '../assets/ui/info.svg';
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
            <span
              title={info}
              className="flex size-5 cursor-help items-center justify-center rounded-full border border-[#e2e8f0] bg-[#f1f5f9]"
            >
              <img src={icInfo} alt="Info" className="size-3" />
            </span>
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