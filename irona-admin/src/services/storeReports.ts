import { supabase } from './supabase';
import { toTs } from './salesReports';
import type { CashierIncomeRow, OpeningHourRow } from '../types/storeReport';

const num = (v: unknown) => Number(v ?? 0);
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Sesi kasir yang login di rentang tanggal lokal (inklusif), terbaru dulu */
export async function fetchCashierIncome(start: string, end: string): Promise<CashierIncomeRow[]> {
  const ts = toTs(start, end);
  const { data, error } = await supabase.rpc('report_cashier_income', {
    p_start: ts.start,
    p_end: ts.end,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    sessionId: r.session_id,
    employeeId: r.employee_id,
    cashierName: r.cashier_name,
    loginAt: r.login_at,
    logoutAt: r.logout_at,
    transactions: num(r.transactions),
    cashAmount: num(r.cash_amount),
    nonCashAmount: num(r.non_cash_amount),
    onlineAmount: num(r.online_amount),
    totalAmount: num(r.total_amount),
    cashOutCount: num(r.cash_out_count),
    cashOutAmount: num(r.cash_out_amount),
    refundCount: num(r.refund_count),
    refundAmount: num(r.refund_amount),
  }));
}

export async function fetchOpeningHours(start: string, end: string): Promise<OpeningHourRow[]> {
  const { data, error } = await supabase.rpc('report_opening_hours', {
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    day: r.day,
    sessionCount: num(r.session_count),
    shift1Cashier: r.shift1_cashier,
    shift1Login: r.shift1_login,
    shift1Logout: r.shift1_logout,
    shift2Cashier: r.shift2_cashier,
    shift2Login: r.shift2_login,
    shift2Logout: r.shift2_logout,
    gapMinutes: numOrNull(r.gap_minutes),
    scheduledOpen: r.scheduled_open,
    scheduledClose: r.scheduled_close,
    storeOpen: Boolean(r.store_open),
    openDiffMinutes: numOrNull(r.open_diff_minutes),
    closeDiffMinutes: numOrNull(r.close_diff_minutes),
  }));
}
