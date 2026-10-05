import type { OrderReceipt } from '@/kasir/types/order';
import type { ReceiptSettings, StoreProfile } from '@/kasir/types/receipt';

/**
 * Menyusun isi struk sebagai baris-baris teks, sama persis dengan Live Preview di
 * Web Admin (Custom Struk). Baris yang sama nanti dikirim ke printer thermal ESC/POS,
 * jadi yang tampil di preview = yang tercetak.
 */

/** Karakter per baris printer thermal */
export const RECEIPT_CHARS: Record<58 | 80, number> = { 58: 32, 80: 48 };

const rp = (n: number) => Math.round(n).toLocaleString('id-ID');

/** Pecah teks panjang ke beberapa baris sesuai lebar kertas */
function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if ((line + ' ' + w).length <= width) line += ' ' + w;
    else {
      lines.push(line);
      line = w;
    }
    while (line.length > width) {
      lines.push(line.slice(0, width));
      line = line.slice(width);
    }
  }
  if (line) lines.push(line);
  return lines;
}

function center(text: string, width: number): string[] {
  return wrap(text, width).map((l) => ' '.repeat(Math.floor((width - l.length) / 2)) + l);
}

/** Kiri–kanan dalam 1 baris; kalau tidak muat, kiri dipecah */
function leftRight(left: string, right: string, width: number): string[] {
  const space = width - right.length - 1;
  const leftLines = wrap(left, Math.max(space, 8));
  const last = leftLines.pop() ?? '';
  return [...leftLines, last + ' '.repeat(Math.max(1, width - last.length - right.length)) + right];
}

/** "2026-09-30T07:35:00Z" → "30/09/2026 14:35" (jam perangkat) */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildReceiptLines(
  s: ReceiptSettings,
  store: StoreProfile,
  receipt: OrderReceipt
): string[] {
  const width = RECEIPT_CHARS[s.paperWidth];
  const dash = '-'.repeat(width);
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  // ---------- Header ----------
  if (s.showStoreName) push(...center((store.storeName || 'Irona Kopi').toUpperCase(), width));
  if (s.showAddress && store.address) push(...center(store.address, width));
  if (s.showPhone && store.phone) push(...center(`Telp: ${store.phone}`, width));
  if (s.showEmail && store.email) push(...center(store.email, width));
  if (s.showHeaderText && s.headerText?.trim()) push(...center(s.headerText.trim(), width));
  push(dash);

  const info: [boolean, string, string][] = [
    [s.showReceiptNumber, 'No. Nota', receipt.transactionNumber],
    [s.showTransactionTime, 'Waktu', formatTime(receipt.transactionDate)],
    [s.showQueueNumber, 'No. Urut', String(receipt.queueNumber).padStart(2, '0')],
    [s.showCashierName, 'Kasir', receipt.cashierName],
    [
      s.showCustomer,
      'Pelanggan',
      receipt.isMember ? `${receipt.customerName} (Member)` : receipt.customerName,
    ],
    [s.showOrderType, 'Jenis Order', receipt.orderType === 'dine_in' ? 'Dine In' : 'Take Away'],
  ];
  const shownInfo = info.filter(([show]) => show);
  shownInfo.forEach(([, label, value]) => push(...leftRight(label, value, width)));
  if (shownInfo.length) push(dash);

  // ---------- Body ----------
  receipt.items.forEach((item) => {
    push(...leftRight(`${item.quantity}x ${item.name}`, rp(item.lineTotal), width));
    if (s.showItemPrice) push(`  @${rp(item.unitPrice)}`);
    // Catatan pesanan (mis. Less Sugar) mengikuti pengaturan "ekstra"
    if (s.showExtras && item.notes) push(...wrap(`* ${item.notes}`, width - 2).map((l) => `  ${l}`));
  });
  push(dash);

  // ---------- Ringkasan tagihan (selalu tampil) ----------
  push(...leftRight('Subtotal', rp(receipt.subtotal), width));
  const discount = receipt.subtotal - receipt.total;
  if (discount > 0) push(...leftRight('Diskon', `-${rp(discount)}`, width));
  push(...leftRight('TOTAL', rp(receipt.total), width));
  if (receipt.paymentMethod === 'tunai') {
    push(...leftRight('Tunai', rp(receipt.cashReceived ?? 0), width));
    push(...leftRight('Kembalian', rp(receipt.change ?? 0), width));
  } else {
    push(...leftRight('QRIS', rp(receipt.total), width));
  }
  push(dash);

  // ---------- Footer ----------
  if (s.showFooterNote && s.footerNote?.trim()) {
    s.footerNote
      .trim()
      .split('\n')
      .forEach((l) => push(...center(l, width)));
  }
  if (s.showSocialMedia) {
    [
      store.socialInstagram && `IG: ${store.socialInstagram}`,
      store.socialFacebook && `FB: ${store.socialFacebook}`,
      store.socialTwitter && `X: ${store.socialTwitter}`,
      store.socialYoutube && `YT: ${store.socialYoutube}`,
    ]
      .filter((l): l is string => Boolean(l))
      .forEach((l) => push(...center(l, width)));
  }

  return lines;
}