export interface Category {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  displayOrder: number;
  showInMenu: boolean;
  showOnline: boolean;
  productCount: number;
}

export interface CategoryInput {
  name: string;
  icon: string | null;
  displayOrder: number;
  showInMenu: boolean;
  showOnline: boolean;
}

export type RecipeStatus = 'lengkap' | 'belum_lengkap' | 'tanpa_resep';

export interface ProductListItem {
  id: string;
  name: string;
  categoryId: string;
  recipeStatus: RecipeStatus;
  isActive: boolean;
  availableOnline: boolean;
  availableOffline: boolean;
  sellingPrice: number | null;
  totalCost: number | null; // dihitung langsung dari resep (view products_with_cost)
}