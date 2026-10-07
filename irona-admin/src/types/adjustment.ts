export type AdjustmentType = 'refund' | 'try_error';
export type ProductStatus = 'belum_dibuat' | 'sudah_dibuat';
export type TneType = 'resep_produk' | 'resep_racikan' | 'racikan_baru';
export type Channel = 'offline' | 'online';

export type Adjustment = {
  id: string;
  adjustmentType: AdjustmentType;
  createdAt: string;
  reference: string;
  channel: Channel | null;
  productStatus: ProductStatus | null;
  notes: string | null;
  amount: number;
  transactionId: string | null;
  tneType: TneType | null;
  customerId: string | null;
  customerName: string | null;
  recordedByName: string | null;
};

/** Transaksi yang dicari di form refund */
export type RefundableTransaction = {
  id: string;
  transactionNumber: string;
  channel: Channel;
  orderType: 'dine_in' | 'take_away' | 'online';
  paymentMethod: string;
  status: string;
  transactionDate: string;
  customerId: string | null;
  customerName: string | null;
  isMember: boolean;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  pointsEarned: number;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
};

export type RecipeOption = {
  tneType: 'resep_produk' | 'resep_racikan';
  id: string;
  name: string;
  groupName: string;
  costPerPorsi: number;
  addCostPercentage: number;
};

export type TneUsageLine = {
  itemType: 'bahan_baku' | 'racikan';
  itemName: string;
  unitName: string;
  quantity: number;
  currentStock: number;
  unitPrice: number;
  subtotal: number;
};

export type TneInput = {
  type: TneType;
  productId: string | null;
  racikanId: string | null;
  quantity: number;
  items: { raw_material_id: string; quantity: number }[];
  notes: string | null;
  /** Hanya racikan_baru; resep existing pakai add cost Master Resep */
  addCostPercentage?: number;
};

export type TryErrorDetail = {
  tneType: TneType;
  quantity: number;
  cost: number;
  addCostPercentage: number;
  totalCost: number;
  lines: TneUsageLine[];
};
