import { supabase } from '@/services/supabase';
import type { PrintAllowance } from '@/kasir/types/printer';

interface AllowanceRow {
  print_count: number;
  limit: number | null;
  remaining: number | null;
}

/** Sudah berapa kali struk dicetak & sisa jatahnya (Batasan Jumlah Cetak Struk di Web Admin) */
export async function fetchPrintAllowance(transactionId: string): Promise<PrintAllowance> {
  const { data, error } = await supabase.rpc('receipt_print_allowance', {
    p_transaction_id: transactionId,
  });
  if (error) throw new Error(error.message);
  const row = data as AllowanceRow;
  return { printCount: row.print_count, limit: row.limit, remaining: row.remaining };
}

/** Catat 1× cetak setelah struk berhasil keluar dari printer; mengembalikan jumlah cetak terbaru */
export async function recordReceiptPrint(transactionId: string): Promise<number> {
  const { data, error } = await supabase.rpc('record_receipt_print', {
    p_transaction_id: transactionId,
  });
  if (error) throw new Error(error.message);
  return data as number;
}