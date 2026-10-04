import { supabase } from './supabase';
import type { DayHours, HoursChannel, StoreHoursHistoryEntry } from '../types/storeHours';

export async function fetchStoreHours(): Promise<Record<HoursChannel, DayHours[]>> {
  const { data, error } = await supabase
    .from('store_hours')
    .select('channel, day_of_week, is_open, open_time, close_time')
    .order('day_of_week');
  if (error) throw error;

  const result: Record<HoursChannel, DayHours[]> = { offline: [], online: [] };
  (data ?? []).forEach((row: any) => {
    result[row.channel as HoursChannel].push({
      dayOfWeek: row.day_of_week,
      isOpen: row.is_open,
      openTime: row.open_time?.slice(0, 5) ?? '',
      // 24:00 (tengah malam) tidak bisa tampil di input type="time", jadi pakai 00:00
      closeTime: row.close_time?.startsWith('24:') ? '00:00' : row.close_time?.slice(0, 5) ?? '',
    });
  });
  return result;
}

/** Simpan 7 hari satu channel sekaligus (tercatat di riwayat) */
export async function saveStoreHours(channel: HoursChannel, days: DayHours[]): Promise<void> {
  const { error } = await supabase.rpc('save_store_hours', {
    p_channel: channel,
    p_days: days.map((d) => ({
      day_of_week: d.dayOfWeek,
      is_open: d.isOpen,
      open_time: d.isOpen ? d.openTime : null,
      close_time: d.isOpen ? (d.closeTime === '00:00' ? '24:00' : d.closeTime) : null,
    })),
  });
  if (error) throw error;
}

export async function fetchStoreHoursHistory(): Promise<StoreHoursHistoryEntry[]> {
  const { data, error } = await supabase
    .from('store_hours_history')
    .select('id, channel, before_data, after_data, created_at, employees(full_name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    channel: row.channel,
    before: row.before_data,
    after: row.after_data,
    changedByName: row.employees?.full_name ?? null,
    createdAt: row.created_at,
  }));
}
