export type StockItemType = 'bahan_baku' | 'racikan';
export type MaterialType = 'tetap' | 'menyusut';
export type AdjustmentReason = 'opname' | 'penyusutan' | 'rusak' | 'hilang' | 'lainnya';

export type StockSummaryRow = {
  itemType: StockItemType;
  itemId: string;
  name: string;
  materialType: MaterialType | null;
  unitName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  isActive: boolean;
};

export type StockPurchaseRow = {
  movementId: string;
  movementDate: string;
  rawMaterialId: string;
  name: string;
  quantity: number;
  baseUnit: string;
  purchaseQty: number | null;
  purchaseUnit: string | null;
  qtyPerPackage: number | null;
  totalPrice: number;
  unitPrice: number | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type StockAdjustmentRow = {
  movementId: string;
  movementDate: string;
  itemType: StockItemType;
  itemId: string;
  name: string;
  reason: AdjustmentReason;
  /** + penambahan, − pengurangan (satuan dasar) */
  quantity: number;
  unitName: string;
  unitPrice: number;
  value: number;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
};
