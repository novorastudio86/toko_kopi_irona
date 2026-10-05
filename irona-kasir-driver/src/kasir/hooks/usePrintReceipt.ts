import { useState } from 'react';
import { sendToPrinter } from '@/kasir/services/printer';
import { fetchReceiptConfig } from '@/kasir/services/receipt';
import { fetchPrintAllowance, recordReceiptPrint } from '@/kasir/services/receiptPrint';
import type { OrderReceipt } from '@/kasir/types/order';
import { buildReceiptBytes } from '@/kasir/utils/receiptBytes';
import { buildReceiptLines } from '@/kasir/utils/receiptLines';

/**
 * Alur tombol "Cetak Struk":
 * cek jatah cetak → susun baris (sama dengan preview) → kirim ke printer → catat jumlah cetak.
 * Kalau printer gagal, transaksi TIDAK terpengaruh (sudah tersimpan sebelumnya).
 */
export function usePrintReceipt() {
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /** Mengembalikan true kalau struk berhasil tercetak */
  async function print(receipt: OrderReceipt): Promise<boolean> {
    setPrinting(true);
    setMessage(null);
    try {
      const allowance = await fetchPrintAllowance(receipt.transactionId);
      if (allowance.remaining === 0) {
        throw new Error(`Struk ini sudah dicetak ${allowance.printCount} kali (batas ${allowance.limit}).`);
      }

      const { settings, store } = await fetchReceiptConfig();
      const lines = buildReceiptLines(settings, store, receipt);
      await sendToPrinter(buildReceiptBytes(lines));

      const count = await recordReceiptPrint(receipt.transactionId);
      setMessage({
        type: 'success',
        text: count === 1 ? 'Struk tercetak.' : `Struk tercetak (cetakan ke-${count}).`,
      });
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal mencetak.' });
      return false;
    } finally {
      setPrinting(false);
    }
  }

  return { print, printing, message, clearMessage: () => setMessage(null) };
}