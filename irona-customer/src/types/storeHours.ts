export type HoursChannel = 'offline' | 'online';

/** Satu baris tabel store_hours */
export interface StoreHours {
  channel: HoursChannel;
  /** 0 = Minggu … 6 = Sabtu */
  dayOfWeek: number;
  isOpen: boolean;
  /** "08:00"; null kalau tutup */
  openTime: string | null;
  closeTime: string | null;
}
