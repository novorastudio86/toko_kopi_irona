import icDashboard from '../assets/sidebar/dashboard.svg';
import icDashboardInactive from '../assets/sidebar/dashboard-inactive.svg';
import icKeuangan from '../assets/sidebar/keuangan.svg';
import icProduk from '../assets/sidebar/produk.svg';
import icProdukActive from '../assets/sidebar/produk-active.svg';
import icInventori from '../assets/sidebar/inventori.svg';
import icKaryawan from '../assets/sidebar/karyawan.svg';
import icPelanggan from '../assets/sidebar/pelanggan.svg';
import icPromosi from '../assets/sidebar/promosi.svg';
import icKasir from '../assets/sidebar/kasir.svg';
import icLaporan from '../assets/sidebar/laporan.svg';
import icAnalisa from '../assets/sidebar/analisa.svg';
import icPengaturan from '../assets/sidebar/pengaturan.svg';

export type Trailing =
  | { type: 'chevron' }
  | { type: 'count'; text: string }
  | { type: 'dot' }
  | { type: 'tag'; text: string }
  | { type: 'live' };

/** Sub modul (level 2) atau sec sub modul (level 3). Punya children = grup yang bisa dibuka. */
export type NavNode = { id: string; title: string; count?: string; children?: NavNode[] };

export type NavItem = {
  id: string;
  title: string;
  icon: string;
  iconActive?: string;
  trailing?: Trailing;
  children?: NavNode[];
};

export type NavGroup = { label: string; items: NavItem[] };

// Struktur mengikuti sheet "Fix PRD-WA" — id halaman = path URL di PRD
export const navGroups: NavGroup[] = [
  {
    label: 'Utama & Ringkasan',
    items: [
      {
        id: '/dashboard',
        title: 'Dashboard',
        icon: icDashboardInactive,
        iconActive: icDashboard,
        trailing: { type: 'live' },
      },
    ],
  },
  {
    label: 'Operasional & Finansial',
    items: [
      {
        id: 'keuangan',
        title: 'Keuangan',
        icon: icKeuangan,
        trailing: { type: 'chevron' },
        children: [{ id: '/accountant/cashflow', title: 'Cash Flow' }],
      },
      {
        id: 'produk',
        title: 'Produk & Menu',
        icon: icProduk,
        iconActive: icProdukActive,
        trailing: { type: 'count', text: '42' },
        children: [
          { id: '/product/category', title: 'Daftar Kategori' },
          { id: '/product/list', title: 'Daftar Produk', count: '42' },
          { id: '/product/recipe', title: 'Master Resep' },
        ],
      },
      {
        id: 'inventory',
        title: 'Inventori Bahan',
        icon: icInventori,
        trailing: { type: 'dot' },
        children: [
          { id: '/inventory/list-stock', title: 'Daftar Bahan Baku' },
          { id: '/inventory/manage-stock', title: 'Kelola Stok' },
          { id: '/inventory/assets', title: 'Aset Barang' },
        ],
      },
      {
        id: 'karyawan',
        title: 'Karyawan & Shift',
        icon: icKaryawan,
        trailing: { type: 'chevron' },
        children: [
          { id: '/employee/list-employee', title: 'Daftar Karyawan' },
          { id: '/employee/privilege', title: 'Hak Akses' },
          { id: '/employee/presence', title: 'Presensi' },
          { id: '/employee/shift', title: 'Shift Kerja' },
          { id: '/employee/cash-bon', title: 'Kasbon' },
        ],
      },
    ],
  },
  {
    label: 'Penjualan & Pelanggan',
    items: [
      { id: '/membership', title: 'Pelanggan Member', icon: icPelanggan },
      {
        id: 'promosi',
        title: 'Promosi & Diskon',
        icon: icPromosi,
        trailing: { type: 'tag', text: '2 AKTIF' },
        children: [
          { id: '/promotion/discount', title: 'Diskon' },
          { id: '/promotion/reward', title: 'Point Reward' },
        ],
      },
      {
        id: 'penjualan',
        title: 'Penjualan',
        icon: icKasir,
        trailing: { type: 'chevron' },
        children: [
          { id: '/sales/order-type', title: 'Tipe Order' },
          { id: '/sales/online-order', title: 'Order Online' },
          { id: '/sales/service-hours', title: 'Jam Buka' },
          { id: '/sales/custom-receipt', title: 'Custom Struk' },
          { id: '/sales/transaction-adjustment', title: 'Penyesuaian Transaksi' },
        ],
      },
    ],
  },
  {
    label: 'Audit & Wawasan Bisnis',
    items: [
      {
        id: 'laporan',
        title: 'Laporan Penjualan',
        icon: icLaporan,
        trailing: { type: 'chevron' },
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
        title: 'Analisa Tren & Margin',
        icon: icAnalisa,
        trailing: { type: 'chevron' },
        children: [
          { id: '/analyst/peak-product', title: 'Waktu Teramai Produk' },
          { id: '/analyst/peak-transaction', title: 'Waktu Teramai Penjualan' },
          { id: '/analyst/stock-cycle', title: 'Perputaran Stok' },
        ],
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  id: '/settings',
  title: 'Pengaturan Sistem',
  icon: icPengaturan,
  trailing: { type: 'tag', text: 'v2.4' },
};

export const allItems = navGroups.flatMap((g) => g.items);

export function containsActive(nodes: NavNode[] | undefined, activeId: string): boolean {
  return !!nodes?.some((n) => n.id === activeId || containsActive(n.children, activeId));
}

/** Sub modul paling atas dari sebuah modul (turun ke grup pertama kalau ada). */
export function firstLeaf(nodes: NavNode[]): { leafId: string; groupId: string | null } {
  const first = nodes[0];
  if (first.children?.length) return { leafId: first.children[0].id, groupId: first.id };
  return { leafId: first.id, groupId: null };
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