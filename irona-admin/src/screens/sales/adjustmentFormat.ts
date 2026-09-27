import type { ProductStatus, TneType } from '../../types/adjustment';

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  belum_dibuat: 'Belum Dibuat',
  sudah_dibuat: 'Sudah Dibuat',
};

export const TNE_TYPE_LABELS: Record<TneType, string> = {
  resep_produk: 'Dari Resep Existing · Produk',
  resep_racikan: 'Dari Resep Existing · Racikan',
  racikan_baru: 'Racikan Baru (Brainstorm)',
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'Dine In',
  take_away: 'Take Away',
  online: 'Online',
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID', { maximumFractionDigits: 3 });
}
