export type RuleScope = 'take_away' | 'online' | 'keduanya';

export interface RuleItem {
  rawMaterialId: string;
  rawMaterialName: string;
  unitName: string;
  quantity: number;
  /** Harga per satuan bahan terkini */
  unitPrice: number;
  /** Diisi kalau "Custom Harga" */
  customCost: number | null;
  /** Biaya efektif: custom, atau harga per satuan × jumlah */
  cost: number;
}

export interface OrderTypeRule {
  id: string;
  scope: RuleScope;
  appliesToAllProducts: boolean;
  productIds: string[];
  productNames: string[];
  items: RuleItem[];
  totalCost: number;
}

export interface RuleInput {
  scope: RuleScope;
  appliesToAllProducts: boolean;
  productIds: string[];
  items: { rawMaterialId: string; quantity: number; customCost: number | null }[];
}

export interface RawMaterialOption {
  id: string;
  name: string;
  unitName: string;
  unitPrice: number;
  isActive: boolean;
}

export interface ProductPrices {
  productName: string;
  dineInPrice: number;
  takeAwayPrice: number;
  onlinePrice: number;
  takeAwayRuleIds: string[];
  onlineRuleIds: string[];
}

export interface RuleSnapshot {
  scope: RuleScope;
  applies_to_all_products: boolean;
  product_names: string[];
  items: {
    name: string;
    quantity: number;
    unit: string;
    custom_cost: number | null;
    cost: number;
  }[];
  total_cost: number;
}

export interface RuleHistoryEntry {
  id: string;
  action: 'dibuat' | 'diubah' | 'dihapus';
  before: RuleSnapshot | null;
  after: RuleSnapshot | null;
  changedByName: string | null;
  createdAt: string;
}
