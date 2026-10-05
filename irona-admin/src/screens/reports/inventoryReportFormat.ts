import type { AdjustmentReason, MaterialType, StockItemType } from '../../types/inventoryReport';

export const ITEM_TYPE_LABELS: Record<StockItemType, string> = {
  bahan_baku: 'Bahan Baku',
  racikan: 'Racikan',
};

export const ITEM_TYPE_CLASSES: Record<StockItemType, string> = {
  bahan_baku: 'bg-[#f1f5f9] text-[#475569]',
  racikan: 'bg-[#f5f3ff] text-[#6d28d9]',
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  tetap: 'Barang Tetap',
  menyusut: 'Bahan Menyusut',
};

export const ADJUSTMENT_LABELS: Record<AdjustmentReason, string> = {
  opname: 'Opname',
  penyusutan: 'Penyusutan',
  rusak: 'Rusak',
  hilang: 'Hilang',
  lainnya: 'Lainnya',
};

export const ADJUSTMENT_CLASSES: Record<AdjustmentReason, string> = {
  opname: 'bg-[#eff6ff] text-[#1d4ed8]',
  penyusutan: 'bg-[#fef3c7] text-[#92400e]',
  rusak: 'bg-[#fff1f2] text-[#be123c]',
  hilang: 'bg-[#fdf2f8] text-[#9d174d]',
  lainnya: 'bg-[#f1f5f9] text-[#475569]',
};

/** Jumlah stok dengan pemisah ribuan, maks 3 desimal */
export function formatQty(n: number): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 3 });
}

/** Harga per satuan (bisa pecahan kecil, mis. Rp 0,01/gr) */
export function formatUnitPrice(n: number): string {
  return `Rp ${n.toLocaleString('id-ID', { maximumFractionDigits: n < 10 ? 4 : 2 })}`;
}

export function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
