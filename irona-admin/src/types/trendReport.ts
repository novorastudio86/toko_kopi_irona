/** Satu sel heatmap: hari (0 = Minggu … 6 = Sabtu) × jam (0–23) WIB */
export type PeakCell = {
  dow: number;
  hour: number;
  quantity: number;
  transactions: number;
  sales: number;
};

export type StockCycleRow = {
  rawMaterialId: string;
  name: string;
  materialType: 'tetap' | 'menyusut';
  unitName: string;
  isActive: boolean;
  openingStock: number;
  closingStock: number;
  used: number;
  avgStock: number;
  /** Terpakai ÷ rata-rata stok; null bila rata-rata stok ≤ 0 */
  turnover: number | null;
  /** Jumlah hari periode ÷ rasio; null bila tidak terpakai */
  daysCover: number | null;
};
