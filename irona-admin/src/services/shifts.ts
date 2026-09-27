import { supabase } from './supabase';
import type {
  DateOverride,
  EmployeeShiftRow,
  ShiftChangeEvent,
  ShiftPattern,
  ShiftSlot,
  WeeklyShifts,
} from '../types/shift';

function mapSlots(json: any): ShiftSlot[] {
  return (json ?? []).map((s: any) => ({
    shiftPatternId: s.shift_pattern_id,
    shiftName: s.shift_name,
    startTime: s.start_time,
    endTime: s.end_time,
    isSpecialHours: !!s.is_special_hours,
    isChanged: !!s.is_changed,
  }));
}

export async function fetchShiftPatterns(): Promise<ShiftPattern[]> {
  const { data, error } = await supabase
    .from('shift_patterns')
    .select('id, name, start_time, end_time')
    .order('start_time');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}

export async function fetchEmployeeShifts(date: string): Promise<EmployeeShiftRow[]> {
  const { data, error } = await supabase.rpc('list_employee_shifts', { p_date: date });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    employeeId: row.employee_id,
    fullName: row.full_name,
    username: row.username,
    roleName: row.role_name,
    hasSchedule: row.has_schedule,
    isLibur: row.is_libur,
    shiftName: row.shift_name,
    startTime: row.start_time,
    endTime: row.end_time,
    isSwap: row.is_swap,
    swapWithName: row.swap_with_name,
    slots: mapSlots(row.slots),
  }));
}

/** Shift seorang karyawan di satu tanggal (dipakai form tukar untuk tanggal lain) */
export async function fetchEmployeeSlots(employeeId: string, date: string): Promise<ShiftSlot[]> {
  const { data, error } = await supabase.rpc('get_effective_shift', { p_employee_id: employeeId, p_date: date });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return mapSlots(row?.slots);
}

export async function fetchWeeklyShifts(employeeId: string): Promise<WeeklyShifts> {
  const { data, error } = await supabase
    .from('employee_shift_defaults')
    .select('day_of_week, shift_pattern_id, shift_patterns(start_time)')
    .eq('employee_id', employeeId);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  rows.sort((a, b) => (a.shift_patterns?.start_time ?? '').localeCompare(b.shift_patterns?.start_time ?? ''));

  const weekly: WeeklyShifts = {};
  rows.forEach((row) => {
    weekly[row.day_of_week] = [...(weekly[row.day_of_week] ?? []), row.shift_pattern_id];
  });
  return weekly;
}

/** Simpan 7 hari sekaligus. Hari tanpa shift = Libur. */
export async function saveWeeklyShifts(employeeId: string, weekly: WeeklyShifts): Promise<void> {
  const days: Record<string, string[]> = {};
  for (let day = 0; day <= 6; day++) days[String(day)] = weekly[day] ?? [];

  const { error } = await supabase.rpc('save_weekly_shifts', { p_employee_id: employeeId, p_days: days });
  if (error) throw error;
}

export async function fetchUpcomingOverrides(fromDate: string): Promise<DateOverride[]> {
  const { data, error } = await supabase
    .from('shift_date_overrides')
    .select('id, override_date, shift_pattern_id, start_time, end_time, note, shift_patterns(name)')
    .gte('override_date', fromDate)
    .order('override_date');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    date: row.override_date,
    patternId: row.shift_pattern_id,
    patternName: row.shift_patterns?.name ?? '-',
    startTime: row.start_time,
    endTime: row.end_time,
    note: row.note,
  }));
}

export async function saveDateOverride(input: {
  date: string;
  patternId: string;
  startTime: string;
  endTime: string;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase.from('shift_date_overrides').upsert(
    {
      override_date: input.date,
      shift_pattern_id: input.patternId,
      start_time: input.startTime,
      end_time: input.endTime,
      note: input.note,
    },
    { onConflict: 'override_date,shift_pattern_id' }
  );
  if (error) throw error;
}

export async function deleteDateOverride(id: string): Promise<void> {
  const { error } = await supabase.from('shift_date_overrides').delete().eq('id', id);
  if (error) throw error;
}

/** Tukar satu shift milik A dengan satu shift milik B. Tanggal boleh berbeda. */
export async function swapShiftSlots(input: {
  employeeAId: string;
  dateA: string;
  patternAId: string;
  employeeBId: string;
  dateB: string;
  patternBId: string;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('swap_shift_slots', {
    p_employee_a: input.employeeAId,
    p_date_a: input.dateA,
    p_pattern_a: input.patternAId,
    p_employee_b: input.employeeBId,
    p_date_b: input.dateB,
    p_pattern_b: input.patternBId,
    p_note: input.note,
  });
  if (error) throw error;
}

/** Shift milik satu karyawan diambil alih karyawan lain di tanggal itu */
export async function coverShiftSlot(input: {
  fromEmployeeId: string;
  toEmployeeId: string;
  date: string;
  patternId: string;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('cover_shift_slot', {
    p_from_employee: input.fromEmployeeId,
    p_to_employee: input.toEmployeeId,
    p_date: input.date,
    p_pattern: input.patternId,
    p_note: input.note,
  });
  if (error) throw error;
}

/** Tambah shift (mis. jadi double shift) di satu tanggal */
export async function addShiftSlot(input: {
  employeeId: string;
  date: string;
  patternId: string;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('add_shift_slot', {
    p_employee: input.employeeId,
    p_date: input.date,
    p_pattern: input.patternId,
    p_note: input.note,
  });
  if (error) throw error;
}

/** Libur mendadak (cuti/sakit): lepas semua shift karyawan di tanggal itu */
export async function setShiftDayOff(employeeId: string, date: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('set_shift_day_off', { p_employee: employeeId, p_date: date, p_note: note });
  if (error) throw error;
}

/** Batalkan satu perubahan jadwal — jadwal kembali seperti sebelumnya */
export async function undoShiftChange(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('undo_shift_change', { p_event_id: eventId });
  if (error) throw error;
}

export async function fetchShiftChanges(limit = 50): Promise<ShiftChangeEvent[]> {
  const { data, error } = await supabase
    .from('shift_change_events')
    .select(
      'id, kind, note, created_at, creator:employees!shift_change_events_created_by_fkey(full_name), ' +
        'shift_changes(change_date, action, shift_patterns(name, start_time), employee:employees!shift_changes_employee_id_fkey(full_name))'
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const lines = (row.shift_changes ?? []).map((c: any) => ({
      employeeName: c.employee?.full_name ?? '—',
      date: c.change_date,
      shiftName: c.shift_patterns?.name ?? '—',
      shiftStart: c.shift_patterns?.start_time ?? '',
      action: c.action,
    }));
    // Urut per tanggal, lalu "lepas" sebelum "tambah" supaya alurnya terbaca
    lines.sort(
      (a: any, b: any) =>
        a.date.localeCompare(b.date) ||
        a.shiftStart.localeCompare(b.shiftStart) ||
        (a.action === 'lepas' ? -1 : 1) - (b.action === 'lepas' ? -1 : 1)
    );

    return {
      id: row.id,
      kind: row.kind,
      note: row.note,
      createdAt: row.created_at,
      createdByName: row.creator?.full_name ?? null,
      lines,
    };
  });
}
