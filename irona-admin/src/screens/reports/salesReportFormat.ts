export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'Dine In',
  take_away: 'Take Away',
  online: 'Delivery (Online)',
};

export const PAYMENT_LABELS: Record<string, string> = { tunai: 'Tunai', qris: 'QRIS' };

export const CHANNEL_LABELS: Record<string, string> = { offline: 'Offline', online: 'Online' };

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Rp dengan 2 desimal hanya kalau ada pecahan (untuk MDR) */
export function rpDetail(n: number): string {
  return `Rp ${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
}
