import type { OrderReceipt } from './order';

export type TransactionStatus = 'selesai' | 'refund_sebagian' | 'refund_penuh' | 'dibatalkan';

/** Transaksi di menu Histori: data struk + status & jumlah cetak */
export interface HistoryTransaction extends OrderReceipt {
  status: TransactionStatus;
  receiptPrintCount: number;
}
