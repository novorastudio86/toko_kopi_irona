export type MaterialType = 'tetap' | 'menyusut';

export interface RawMaterialListItem {
  id: string;
  name: string;
  materialType: MaterialType;
  unitName: string;
  unitPrice: number | null;
  currentStock: number;
  minStockAlert: number;
  isActive: boolean;
}

export interface RawMaterialInput {
  name: string;
  materialType: MaterialType;
  baseUnitId: string;
  defaultPurchaseUnitId: string | null;
  defaultQtyPerPackage: number | null;
  minStockAlert: number;
}

export interface RawMaterialDetail extends RawMaterialInput {
  id: string;
  unitPrice: number | null;
  currentStock: number;
  isActive: boolean;
}
export interface RawMaterialUsage {
  usageType: 'produk' | 'racikan';
  itemId: string;
  itemName: string;
  categoryName: string | null;
  viaName: string | null;
  quantity: number;
  unitName: string;
}