export interface NavLink {
  label: string;
  /** Diawali "/#" = anchor section di Home, selain itu route */
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Menu', href: '/menu' },
  { label: 'Lokasi', href: '/#lokasi' },
  { label: 'Tentang', href: '/tentang' },
  { label: 'Membership', href: '/membership' },
];

/** Route yang halamannya belum dibangun → tampil "Segera hadir" */
export const COMING_SOON_PATHS = ['/menu/:id', '/tentang', '/membership', '/login', '/keranjang'];
