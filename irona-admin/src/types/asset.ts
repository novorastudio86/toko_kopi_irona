export type AssetStatus = 'aktif' | 'rusak' | 'dijual' | 'hilang';

export interface Asset {
  id: string;
  name: string;
  purchasePrice: number;
  quantity: number;
  purchaseDate: string;
  status: AssetStatus;
  notes: string | null;
  totalValue: number;
}

export interface AssetInput {
  name: string;
  purchasePrice: number;
  quantity: number;
  purchaseDate: string;
  notes: string | null;
}