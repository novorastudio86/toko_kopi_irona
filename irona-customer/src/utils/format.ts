/** Rp 13.750 */
export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

/** 08xx / 628xx / +628xx, 10–14 digit (setelah dibersihkan dengan cleanPhone) */
export const PHONE_PATTERN = /^(\+62|62|0)8\d{8,11}$/;

/** "0812-3456 7890" → "081234567890" */
export function cleanPhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}
