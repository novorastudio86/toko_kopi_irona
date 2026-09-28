import { Link } from 'react-router';
import type { NavLink } from '@/constants/navigation';

/** Anchor "/#section" pakai <a> biasa supaya browser yang scroll; route pakai <Link> */
export default function NavItem({
  link,
  className,
  onClick,
}: {
  link: NavLink;
  className?: string;
  onClick?: () => void;
}) {
  return link.href.startsWith('/#') ? (
    <a href={link.href} className={className} onClick={onClick}>
      {link.label}
    </a>
  ) : (
    <Link to={link.href} className={className} onClick={onClick}>
      {link.label}
    </Link>
  );
}
