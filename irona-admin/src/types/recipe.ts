export type RecipeType = 'produk' | 'racikan';

export interface RecipeListItem {
  id: string;
  recipeType: RecipeType;
  name: string;
  categoryName: string | null;
  componentCount: number;
  cost: number;
  addCostPercentage: number;
  totalCost: number;
  recipeStatus: 'lengkap' | 'belum_lengkap';
  isActive: boolean;
  unit: string | null;
  // khusus produk
  sku: string | null;
  desiredCostPercentage: number | null;
  sellingPrice: number | null;
  // khusus racikan
  productionMode: 'batch' | 'made_to_order' | null;
  yieldQty: number | null;
  totalOutputQty: number | null;
  currentStock: number | null;
  minStockAlert: number | null;
}

/** Satu komponen di dalam baris expand */
export interface RecipeComponentRow {
  key: string;
  type: 'bahan_baku' | 'racikan';
  name: string;
  quantity: number;
  unitName: string;
  unitPrice: number;
  subtotal: number;
}

export interface RacikanSaveInput {
  name: string;
  unitId: string;
  productionMode: 'batch' | 'made_to_order';
  yieldQty: number;
  totalOutputQty: number;
  addCostPercentage: number;
  minStockAlert: number | null;
  components: { type: 'bahan_baku' | 'racikan'; id: string; quantity: number; unitId: string }[];
}

export interface RacikanDetail {
  id: string;
  name: string;
  unitId: string;
  productionMode: 'batch' | 'made_to_order';
  yieldQty: number;
  totalOutputQty: number;
  addCostPercentage: number;
  minStockAlert: number | null;
  components: { type: 'bahan_baku' | 'racikan'; id: string; quantity: number }[];
}

export interface UnitOption {
  id: string;
  name: string;
}