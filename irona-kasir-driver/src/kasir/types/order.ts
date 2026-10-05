import type { CartItem } from './catalog';

export type OrderType = 'dine_in' | 'take_away';
/** Jenis order di struk: pesanan kasir + pesanan online dari Web Customer */
export type ReceiptOrderType = OrderType | 'online';
export type PaymentMethod = 'tunai' | 'qris';

/** Member hasil pencarian No HP */
export interface Member {
  id: string;
  name: string;
  phoneNumber: string;
  pointsBalance: number;
}

/** Semua isian pesanan yang sedang dibuat kasir (belum disimpan ke database) */
export interface OrderDraft {
  items: CartItem[];
  member: Member | null;
  /** Nama di struk: otomatis dari member, atau diketik manual untuk non-member */
  customerName: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  /** Uang tunai yang diterima (0 kalau belum diisi / QRIS) */
  cashReceived: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
}

export interface OrderReceipt {
  transactionId: string;
  transactionNumber: string;
  queueNumber: number;
  transactionDate: string;
  cashierName: string;
  customerName: string;
  isMember: boolean;
  orderType: ReceiptOrderType;
  paymentMethod: PaymentMethod;
  items: ReceiptItem[];
  subtotal: number;
  /** Total belanja produk setelah diskon (belum termasuk ongkir & biaya layanan) */
  total: number;
  /** Khusus pesanan online */
  deliveryFee?: number;
  serviceFee?: number;
  cashReceived: number | null;
  change: number | null;
  pointsEarned: number;
  pointsBalance: number | null;
}