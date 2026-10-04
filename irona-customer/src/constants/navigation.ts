export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Menu', href: '/menu' },
  { label: 'Tentang', href: '/tentang' },
  { label: 'Membership', href: '/membership' },
];
