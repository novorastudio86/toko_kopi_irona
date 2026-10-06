export interface HistoryEntry {
  id: string;
  subject: string; // nama produk / kategori / resep yang berubah
  tag?: string; // mis. "Produk" / "Racikan" di riwayat resep
  action: 'dibuat' | 'diubah' | 'dinonaktifkan' | 'diaktifkan' | 'dihapus';
  changes: Record<string, { from: unknown; to: unknown }> | null;
  changedAt: string;
}
