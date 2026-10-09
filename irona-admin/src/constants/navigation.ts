import {
  Archive,
  CreditCard,
  FileChartColumn,
  FileText,
  LayoutPanelLeft,
  Package,
  Settings,
  Tag,
  TrendingUp,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Sub modul (level 2) atau sec sub modul (level 3). Punya children = grup yang bisa dibuka.
 * countTable = tabel/view Supabase yang jumlah barisnya tampil sebagai badge (khusus halaman daftar data).
 */
export type NavNode = { id: string; title: string; countTable?: string; children?: NavNode[] };

export type NavItem = {
  id: string;
  title: string;
  icon: LucideIcon;
  children?: NavNode[];
};

// Struktur mengikuti sheet "Fix PRD-WA" — id halaman = path URL di PRD. Urutan mengikuti Figma.
export const allItems: NavItem[] = [
  { id: '/dashboard', title: 'Dashboard', icon: LayoutPanelLeft },
  {
    id: 'penjualan',
    title: 'Penjualan',
    icon: FileChartColumn,
    children: [
      { id: '/sales/order-type', title: 'Tipe Order' },
      { id: '/sales/online-order', title: 'Order Online' },
      { id: '/sales/service-hours', title: 'Jam Buka' },
      { id: '/sales/custom-receipt', title: 'Custom Struk' },
      { id: '/sales/transaction-adjustment', title: 'Penyesuaian Transaksi' },
    ],
  },
  {
    id: 'produk',
    title: 'Produk',
    icon: Package,
    children: [
      { id: '/product/category', title: 'Daftar Kategori', countTable: 'categories' },
      { id: '/product/list', title: 'Daftar Produk', countTable: 'products' },
      { id: '/product/recipe', title: 'Master Resep', countTable: 'recipe_list' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: Archive,
    children: [
      { id: '/inventory/list-stock', title: 'Daftar Bahan Baku', countTable: 'raw_materials' },
      { id: '/inventory/manage-stock', title: 'Kelola Stok' },
      { id: '/inventory/assets', title: 'Aset Barang', countTable: 'assets' },
    ],
  },
  {
    id: 'keuangan',
    title: 'Keuangan',
    icon: CreditCard,
    children: [{ id: '/accountant/cashflow', title: 'Cash Flow' }],
  },
  {
    id: 'karyawan',
    title: 'Karyawan',
    icon: Users,
    children: [
      { id: '/employee/list-employee', title: 'Daftar Karyawan', countTable: 'employees' },
      { id: '/employee/privilege', title: 'Hak Akses', countTable: 'roles' },
      { id: '/employee/presence', title: 'Presensi' },
      { id: '/employee/shift', title: 'Shift Kerja' },
      { id: '/employee/cash-bon', title: 'Kasbon' },
    ],
  },
  { id: '/membership', title: 'Pelanggan', icon: User },
  {
    id: 'promosi',
    title: 'Promosi',
    icon: Tag,
    children: [
      { id: '/promotion/discount', title: 'Diskon', countTable: 'promotion_active' },
      { id: '/promotion/reward', title: 'Point Reward', countTable: 'rewards' },
    ],
  },
  {
    id: 'laporan',
    title: 'Laporan',
    icon: FileText,
    children: [
      {
        id: 'laporan-cash-flow',
        title: 'Laporan Cash Flow',
        children: [
          { id: '/report/cash-flow/hpp', title: 'HPP' },
          { id: '/report/cash-flow/fixed-cost', title: 'Fixed Cost' },
          { id: '/report/cash-flow/net-profit', title: 'Net Profit' },
          { id: '/report/cash-flow/online-balance', title: 'Saldo Online' },
        ],
      },
      {
        id: 'laporan-penjualan',
        title: 'Laporan Penjualan',
        children: [
          { id: '/report/sales/sales-summary', title: 'Ringkasan Penjualan' },
          { id: '/report/sales/detail', title: 'Detail Penjualan' },
          { id: '/report/sales/detail-by-periode', title: 'Detail Per Periode' },
          { id: '/report/sales/payment', title: 'Laporan Jenis Bayar' },
          { id: '/report/sales/online-order', title: 'Laporan Penjualan Online' },
          { id: '/report/sales/adjustment-order', title: 'Laporan Penyesuaian' },
        ],
      },
      {
        id: 'laporan-produk',
        title: 'Laporan Produk',
        children: [
          { id: '/report/product/sales-product', title: 'Penjualan Produk' },
          { id: '/report/product/product-category', title: 'Penjualan Kategori' },
        ],
      },
      {
        id: 'laporan-karyawan',
        title: 'Laporan Karyawan',
        children: [{ id: '/report/employee/presence', title: 'Absensi' }],
      },
      {
        id: 'laporan-toko',
        title: 'Laporan Toko',
        children: [
          { id: '/report/store/cashier-income', title: 'Laporan Pendapatan Kasir' },
          { id: '/report/store/opening-hour', title: 'Laporan Jam Operasional' },
        ],
      },
      {
        id: 'laporan-pelanggan',
        title: 'Laporan Pelanggan',
        children: [
          { id: '/report/membership/list-member', title: 'Laporan Membership' },
          { id: '/report/membership/redeem', title: 'Laporan Redeem Point' },
        ],
      },
      {
        id: 'laporan-persediaan',
        title: 'Laporan Persediaan',
        children: [
          { id: '/report/inventory/summary-stock', title: 'Laporan Ringkasan Persediaan' },
          { id: '/report/inventory/purchase-stock', title: 'Laporan Pembelian' },
          { id: '/report/inventory/stock-adjustment', title: 'Laporan Penyesuaian Stok' },
        ],
      },
    ],
  },
  {
    id: 'analisa',
    title: 'Analisa Laporan',
    icon: TrendingUp,
    children: [
      { id: '/analyst/peak-product', title: 'Waktu Teramai Produk' },
      { id: '/analyst/peak-transaction', title: 'Waktu Teramai Penjualan' },
      { id: '/analyst/stock-cycle', title: 'Perputaran Stok' },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  id: '/settings',
  title: 'Pengaturan Sistem',
  icon: Settings,
};

export function containsActive(nodes: NavNode[] | undefined, activeId: string): boolean {
  return !!nodes?.some((n) => n.id === activeId || containsActive(n.children, activeId));
}

/** Modul & grup mana yang harus terbuka untuk halaman aktif tertentu. */
export function findLocation(activeId: string): { moduleId: string | null; groupId: string | null } {
  for (const item of allItems) {
    for (const node of item.children ?? []) {
      if (node.id === activeId) return { moduleId: item.id, groupId: null };
      if (node.children?.some((c) => c.id === activeId)) {
        return { moduleId: item.id, groupId: node.id };
      }
    }
  }
  return { moduleId: null, groupId: null };
}

/** Judul halaman dari id/path. */
export function getNavTitle(id: string): string {
  if (id === SETTINGS_ITEM.id) return SETTINGS_ITEM.title;
  const search = (nodes: NavNode[]): string | null => {
    for (const n of nodes) {
      if (n.id === id) return n.title;
      const found = n.children ? search(n.children) : null;
      if (found) return found;
    }
    return null;
  };
  for (const item of allItems) {
    if (item.id === id) return item.title;
    const found = item.children ? search(item.children) : null;
    if (found) return found;
  }
  return id;
}

/** Breadcrumb halaman = judul modul → grup → halaman, persis seperti di sidebar. */
export function getNavTrail(id: string): string[] {
  if (id === SETTINGS_ITEM.id) return [SETTINGS_ITEM.title];
  const search = (nodes: NavNode[], trail: string[]): string[] | null => {
    for (const n of nodes) {
      if (n.id === id) return [...trail, n.title];
      const found = n.children ? search(n.children, [...trail, n.title]) : null;
      if (found) return found;
    }
    return null;
  };
  return search(allItems, []) ?? [];
}

function collectPageIds(): string[] {
  const ids: string[] = [SETTINGS_ITEM.id];
  const walk = (nodes: NavNode[]) =>
    nodes.forEach((n) => (n.children ? walk(n.children) : ids.push(n.id)));
  allItems.forEach((item) => (item.children ? walk(item.children) : ids.push(item.id)));
  return ids;
}

const pageIds = collectPageIds();

/**
 * Menu mana yang harus menyala untuk sebuah URL.
 * Contoh: /product/category/new dan /product/category/abc/edit → /product/category
 */
export function resolveActiveNavId(pathname: string): string {
  let best = pathname;
  let bestLength = 0;
  for (const id of pageIds) {
    const matches = pathname === id || pathname.startsWith(id + '/');
    if (matches && id.length > bestLength) {
      best = id;
      bestLength = id.length;
    }
  }
  return best;
}

/** Semua tabel yang perlu dihitung untuk badge sidebar (badge hanya di sub modul level 2) */
export const countTables = allItems
  .flatMap((item) => item.children ?? [])
  .flatMap((n) => n.countTable ?? []);
