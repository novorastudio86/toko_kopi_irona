import { EscPosBuilder, encodeAscii } from '@ricka7x/expo-thermal-printer/escpos';

/**
 * Ubah baris struk (hasil buildReceiptLines, sama dengan preview) menjadi perintah ESC/POS.
 * Baris sudah pas lebar kertas (32/48 karakter), jadi cukup dicetak apa adanya dari kiri.
 * Logo menyusul: perlu diubah jadi gambar hitam-putih (raster) saat printernya sudah ada.
 */
export function buildReceiptBytes(lines: string[]): Uint8Array {
  const builder = new EscPosBuilder().init().align('left');
  lines.forEach((line) => builder.line(line, encodeAscii));
  return builder.feedToTear().build();
}