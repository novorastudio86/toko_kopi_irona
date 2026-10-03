import { Link } from 'react-router';
import type { NavLink } from '@/constants/navigation';

export default function NavItem({
  link,
  className,
  onClick,
}: {
  link: NavLink;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link to={link.href} className={className} onClick={onClick}>
      {link.label}
    </Link>
  );
}
