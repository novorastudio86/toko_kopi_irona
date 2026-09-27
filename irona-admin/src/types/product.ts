export type RecipeStatus = 'lengkap' | 'belum_lengkap' | 'tanpa_resep';

export interface ProductListItem {
  id: string;
  name: string;
  categoryId: string;
  unit: string;
  recipeStatus: RecipeStatus;
  isActive: boolean;
  availableOnline: boolean;
  availableOffline: boolean;
  sellingPrice: number | null;
  totalCost: number | null; // dihitung langsung dari resep (view products_with_cost)
}

/** Bahan baku / racikan yang menipis untuk satu produk (view product_low_stock) */
export interface LowStockItem {
  itemType: 'bahan_baku' | 'racikan';
  itemId: string;
  name: string;
  unitName: string;
  currentStock: number;
  minStock: number;
  qtyPerPortion: number;
}

/** Pilihan metode resep di Langkah 2 form produk */
export type RecipeMethod = 'isi_sekarang' | 'isi_nanti' | 'tanpa_resep';

/** Bahan baku atau racikan yang bisa dipilih di resep */
export interface RecipeSource {
  key: string; // "bahan_baku:<id>" atau "racikan:<id>"
  type: 'bahan_baku' | 'racikan';
  id: string;
  name: string;
  unitId: string;
  unitName: string;
  unitPrice: number;
}

/** Satu baris bahan di editor resep (nilai mentah dari input) */
export interface RecipeRow {
  rowId: string;
  sourceKey: string;
  quantity: string;
}

/** Data lengkap satu produk untuk Detail & Ubah Data */
export interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  categoryId: string;
  unit: string;
  sku: string | null;
  availableOffline: boolean;
  availableOnline: boolean;
  recipeStatus: RecipeStatus;
  isActive: boolean;
  baseCost: number | null;
  addCostPercentage: number;
  desiredCostPercentage: number | null;
  sellingPrice: number | null;
  liveCost: number | null;
  totalCost: number | null;
  recipe: { type: 'bahan_baku' | 'racikan'; id: string; quantity: number }[];
}

export interface ProductSaveInput {
  name: string;
  description: string | null;
  photoUrl: string | null;
  categoryId: string;
  unit: string;
  sku: string;
  availableOffline: boolean;
  availableOnline: boolean;
  recipeStatus: RecipeStatus;
  isActive: boolean;
  baseCost: number | null; // hanya untuk tanpa_resep
  addCostPercentage: number;
  desiredCostPercentage: number | null;
  sellingPrice: number | null;
  recipe: {
    type: 'bahan_baku' | 'racikan';
    rawMaterialId: string | null;
    racikanId: string | null;
    quantity: number;
    unitId: string;
  }[];
}