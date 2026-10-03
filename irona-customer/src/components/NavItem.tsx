import { NavLink as RouterNavLink } from 'react-router';
import type { NavLink } from '@/constants/navigation';
import { cn } from '@/lib/utils';

export default function NavItem({
  link,
  className,
  onClick,
}: {
  link: NavLink;
  className?: string;
  onClick?: () => void;
}) {
  // NavLink otomatis kasih aria-current="page" saat route aktif (termasuk sub-route)
  return (
    <RouterNavLink
      to={link.href}
      className={cn(
        className,
        'underline-offset-4 aria-[current=page]:font-bold aria-[current=page]:underline'
      )}
      onClick={onClick}
    >
      {link.label}
    </RouterNavLink>
  );
}
