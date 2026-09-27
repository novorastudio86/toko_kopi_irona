export interface StockCardRow {
  itemType: 'bahan_baku' | 'racikan';
  itemId: string;
  itemName: string;
  unitName: string;
  opening: number;
  incoming: number;
  sold: number;
  adjustment: number;
  production: number;
  closing: number;
  minStock: number;
}

export interface StockMovementRow {
  id: string;
  movementType: 'stok_masuk' | 'penyesuaian' | 'produksi_racikan' | 'penjualan' | 'refund' | 'try_error';
  quantity: number;
  unitName: string;
  purchaseQty: number | null;
  totalPrice: number | null;
  adjustmentReason: string | null;
  notes: string | null;
  movementDate: string;
}