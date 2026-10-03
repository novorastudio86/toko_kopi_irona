export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Menu', href: '/menu' },
  { label: 'Tentang', href: '/tentang' },
  { label: 'Membership', href: '/membership' },
];

/** Route yang halamannya belum dibangun → tampil "Segera hadir" */
export const COMING_SOON_PATHS = ['/login', '/membership/reward'];
