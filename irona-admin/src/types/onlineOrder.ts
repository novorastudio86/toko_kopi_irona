export interface DeliverySettings {
  feePerStep: number;
  stepKm: number;
  feePer100m: number;
  maxDistanceKm: number;
}

export interface OnlineOrderSettings extends DeliverySettings {
  serviceFee: number;
  mdrPercent: number;
  ppnPercent: number;
}

export interface PausedProduct {
  productId: string;
  productName: string;
  pausedAt: string;
}

export interface OnlineProductOption {
  id: string;
  name: string;
  categoryName: string;
}

export interface OnlineOrderHistoryEntry {
  id: string;
  section: 'jeda' | 'ongkir' | 'biaya_layanan';
  description: string;
  before: Record<string, number> | null;
  after: Record<string, number> | null;
  changedByName: string | null;
  createdAt: string;
}
