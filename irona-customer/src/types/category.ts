/** Kategori menu (tabel categories) */
export interface Category {
  id: string;
  name: string;
  /** Nama tampil di Web Customer; null = pakai `name` */
  onlineName: string | null;
  displayOrder: number;
  showOnline: boolean;
}
