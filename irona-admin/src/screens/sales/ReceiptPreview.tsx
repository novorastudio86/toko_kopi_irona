import type { ReceiptSettings, StoreProfile } from '../../types/receipt';

/** Karakter per baris printer thermal */
const CHARS: Record<58 | 80, number> = { 58: 32, 80: 48 };

const rp = (n: number) => n.toLocaleString('id-ID');

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

// Data contoh untuk preview
const SAMPLE = {
  receiptNumber: 'TRX-260927-0042',
  time: '27/09/2026 14:35',
  queue: 'A-017',
  cashier: 'Siti',
  // Non-member: nama diketik kasir. Member: nama otomatis dari No HP, mis. 'Rina Kartika (Member)'
  customer: 'Bima Aditya',
  orderType: 'Take Away',
  table: '5',
  items: [
    {
      name: 'Kopi Susu Gula Aren',
      qty: 2,
      price: 18000,
      extras: [{ name: 'Extra Shot', price: 5000 }],
    },
    { name: 'Croissant Almond Butter', qty: 1, price: 25000, extras: [] },
  ],
  discount: 5000,
  cashReceived: 100000,
};

type Props = {
  settings: ReceiptSettings;
  store: StoreProfile;
  /** Contoh metode bayar di preview: tunai (dengan kembalian) atau qris */
  samplePayment: 'tunai' | 'qris';
};

export default function ReceiptPreview({ settings: s, store, samplePayment }: Props) {
  const width = CHARS[s.paper_width];
  const dash = '-'.repeat(width);
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  // ---------- Header ----------
  if (s.show_store_name) push(...center((store.storeName || 'Irona Kopi').toUpperCase(), width));
  if (s.show_address) push(...center(store.address || 'Alamat toko (isi di Data Toko)', width));
  if (s.show_phone) push(...center(`Telp: ${store.phone || '08xx-xxxx-xxxx'}`, width));
  if (s.show_email) push(...center(store.email || 'email@toko.com', width));
  if (s.show_header_text && s.header_text?.trim()) push(...center(s.header_text.trim(), width));
  push(dash);

  const info: [boolean, string, string][] = [
    [s.show_receipt_number, 'No. Nota', SAMPLE.receiptNumber],
    [s.show_transaction_time, 'Waktu', SAMPLE.time],
    [s.show_queue_number, 'No. Urut', SAMPLE.queue],
    [s.show_cashier_name, 'Kasir', SAMPLE.cashier],
    [s.show_customer, 'Pelanggan', SAMPLE.customer],
    [s.show_order_type, 'Jenis Order', SAMPLE.orderType],
    [s.show_table_number, 'No. Meja', SAMPLE.table],
  ];
  const shownInfo = info.filter(([show]) => show);
  shownInfo.forEach(([, label, value]) => push(...leftRight(label, value, width)));
  if (shownInfo.length) push(dash);

  // ---------- Body ----------
  let subtotal = 0;
  SAMPLE.items.forEach((item) => {
    const extrasPrice = item.extras.reduce((sum, e) => sum + e.price, 0);
    const lineTotal = (item.price + extrasPrice) * item.qty;
    subtotal += lineTotal;
    push(...leftRight(`${item.qty}x ${item.name}`, rp(lineTotal), width));
    if (s.show_item_price) push(`  @${rp(item.price)}`);
    item.extras.forEach((e) => {
      if (s.show_extras && s.show_item_price) push(`  + ${e.name} @${rp(e.price)}`);
      else if (s.show_extras) push(`  + ${e.name}`);
      else if (s.show_item_price) push(`  + ekstra @${rp(e.price)}`);
    });
  });
  push(dash);

  // Ringkasan tagihan — selalu tampil
  const afterDiscount = subtotal - SAMPLE.discount;
  const rounding = Math.ceil(afterDiscount / 500) * 500 - afterDiscount;
  const total = afterDiscount + rounding;
  push(...leftRight('Subtotal', rp(subtotal), width));
  push(...leftRight('Diskon', `-${rp(SAMPLE.discount)}`, width));
  push(...leftRight('Pembulatan', rp(rounding), width));
  push(...leftRight('TOTAL', rp(total), width));
  if (samplePayment === 'tunai') {
    push(...leftRight('Tunai', rp(SAMPLE.cashReceived), width));
    push(...leftRight('Kembalian', rp(SAMPLE.cashReceived - total), width));
  } else {
    push(...leftRight('QRIS', rp(total), width));
  }
  push(dash);

  // ---------- Footer ----------
  if (s.show_footer_note && s.footer_note?.trim()) {
    s.footer_note
      .trim()
      .split('\n')
      .forEach((l) => push(...center(l, width)));
  }
  if (s.show_social_media) {
    const socials = [
      store.socialInstagram && `IG: ${store.socialInstagram}`,
      store.socialFacebook && `FB: ${store.socialFacebook}`,
      store.socialTwitter && `X: ${store.socialTwitter}`,
      store.socialYoutube && `YT: ${store.socialYoutube}`,
    ].filter(Boolean) as string[];
    (socials.length ? socials : ['IG: @ironakopi (isi di Data Toko)']).forEach((l) =>
      push(...center(l, width))
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        // font-mono 12px di sini juga, supaya satuan `ch` = lebar 1 karakter struk (bukan huruf Jakarta Sans)
        className="rounded-sm bg-white px-3 py-4 font-mono text-[12px] shadow-[0_2px_12px_rgba(15,23,42,0.15)]"
        style={{ width: `calc(${width}ch + 24px)` }}
      >
        {s.show_logo && (
          <div className={`mb-2 flex justify-center ${s.logo_mode === 'penuh' ? '' : 'px-8'}`}>
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt="Logo"
                className={`object-contain grayscale ${s.logo_mode === 'penuh' ? 'w-full' : 'max-h-14'}`}
              />
            ) : (
              <div
                className={`flex items-center justify-center border border-dashed border-[#94a3b8] text-[10px] text-[#94a3b8] ${
                  s.logo_mode === 'penuh' ? 'h-16 w-full' : 'h-12 w-24'
                }`}
              >
                LOGO
              </div>
            )}
          </div>
        )}
        <pre className="whitespace-pre font-mono text-[12px] leading-[1.35] text-[#0f172a]">
          {lines.join('\n')}
        </pre>
      </div>
      <p className="text-xs text-[#94a3b8]">
        Preview kertas {s.paper_width} mm · {width} karakter/baris · data contoh
      </p>
    </div>
  );
}
