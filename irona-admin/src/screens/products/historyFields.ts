import type { HistoryFields } from '../../components/HistoryModal';
import { CATEGORY_ICONS } from '../../constants/categoryIcons';
import { formatPercent, formatQty, formatRupiah, formatRupiahDetail } from '../../utils/format';

const yesNo = (v: unknown) => (v ? 'Ya' : 'Tidak');
const money = (v: unknown) => formatRupiah(Number(v));
const pct = (v: unknown) => formatPercent(Number(v));
const qty = (v: unknown) => formatQty(Number(v));

const RECIPE_STATUS: Record<string, string> = {
  lengkap: 'Lengkap',
  belum_lengkap: 'Belum lengkap',
  tanpa_resep: 'Tanpa resep',
};

/** Kolom yang dilacak trigger `log_product_history` */
export function productHistoryFields(categoryNames: Map<string, string>): HistoryFields {
  return {
    name: { label: 'Nama' },
    description: { label: 'Deskripsi' },
    photo_url: { label: 'Foto', format: () => 'diganti' },
    category_id: { label: 'Kategori', format: (v) => categoryNames.get(String(v)) ?? '—' },
    unit: { label: 'Satuan' },
    sku: { label: 'SKU' },
    available_offline: { label: 'Jual offline', format: yesNo },
    available_online: { label: 'Jual online', format: yesNo },
    recipe_status: { label: 'Status resep', format: (v) => RECIPE_STATUS[String(v)] ?? String(v) },
    base_cost: { label: 'Base cost', format: money },
    add_cost_percentage: { label: 'Add cost', format: pct },
    desired_cost_percentage: { label: 'Target cost', format: pct },
    selling_price: { label: 'Harga jual', format: money },
    is_active: { label: 'Aktif', format: yesNo },
  };
}

/** Kolom yang dilacak trigger `log_category_history` */
export const CATEGORY_HISTORY_FIELDS: HistoryFields = {
  name: { label: 'Nama' },
  icon: { label: 'Icon', format: (v) => CATEGORY_ICONS[String(v)]?.label ?? String(v) },
  display_order: { label: 'Urutan tampil' },
  show_in_menu: { label: 'Tampil di kasir', format: yesNo },
  show_online: { label: 'Tampil di online order', format: yesNo },
};

/** Isi snapshot `recipe_snapshot()` */
export const RECIPE_HISTORY_FIELDS: HistoryFields = {
  name: { label: 'Nama' },
  unit: { label: 'Satuan' },
  production_mode: {
    label: 'Mode produksi',
    format: (v) => (v === 'batch' ? 'Batch' : 'Made to Order'),
  },
  yield_qty: { label: 'Yield (porsi)', format: qty },
  total_output_qty: { label: 'Total hasil', format: qty },
  add_cost_percentage: { label: 'Add cost', format: pct },
  min_stock_alert: { label: 'Minimum stok', format: qty },
  cashier_can_produce: { label: 'Kasir boleh update stok', format: yesNo },
  components: { label: 'Komponen' },
};

/** Kolom yang dilacak trigger `log_raw_material_history` (id satuan sudah jadi nama di service) */
export const RAW_MATERIAL_HISTORY_FIELDS: HistoryFields = {
  name: { label: 'Nama' },
  material_type: { label: 'Jenis bahan', format: (v) => (v === 'menyusut' ? 'Menyusut' : 'Tetap') },
  base_unit_id: { label: 'Satuan dasar' },
  default_purchase_unit_id: { label: 'Satuan beli' },
  default_qty_per_package: { label: 'Isi per kemasan', format: qty },
  unit_price: { label: 'Harga per satuan', format: (v) => formatRupiahDetail(Number(v)) },
  min_stock_alert: { label: 'Minimum stok', format: qty },
  is_active: { label: 'Aktif', format: yesNo },
};
