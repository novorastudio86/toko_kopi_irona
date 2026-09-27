/** Rp 13.750 */
export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

/** Rp 182 / Rp 0,5 — untuk harga per satuan bahan yang bisa pecahan */
export function formatRupiahDetail(value: number): string {
  return `Rp ${value.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
}

/** 76,4% */
export function formatPercent(value: number): string {
  return `${value.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** "18000" → "18.000" untuk tampilan input rupiah */
export function formatThousands(digits: string): string {
  return digits ? Number(digits).toLocaleString('id-ID') : '';
}

/** 1250 → "1.250", 0.5 → "0,5" — untuk jumlah stok/takaran */
export function formatQty(value: number): string {
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}