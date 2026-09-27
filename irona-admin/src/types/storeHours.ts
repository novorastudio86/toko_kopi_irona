export type HoursChannel = 'offline' | 'online';

export interface DayHours {
  /** 0 = Minggu … 6 = Sabtu */
  dayOfWeek: number;
  isOpen: boolean;
  /** "08:00" */
  openTime: string;
  closeTime: string;
}

export interface StoreHoursHistoryEntry {
  id: string;
  channel: HoursChannel;
  before:
    | {
        day_of_week: number;
        is_open: boolean;
        open_time: string | null;
        close_time: string | null;
      }[]
    | null;
  after: {
    day_of_week: number;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
  }[];
  changedByName: string | null;
  createdAt: string;
}
