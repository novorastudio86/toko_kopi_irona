import { supabase } from './supabase';
import type {
  BankHoliday,
  Bucket,
  BucketSummary,
  CashFlowEntry,
  Disbursement,
  ExpenseInput,
  FinanceExpense,
  FinanceSettings,
  HppMonth,
  NetProfitMonth,
  OnlineBalanceRow,
} from '../types/finance';

const num = (v: unknown) => Number(v ?? 0);

export async function fetchFinanceSettings(): Promise<FinanceSettings> {
  const { data, error } = await supabase.from('finance_settings').select('*').single();
  if (error) throw error;
  return {
    hppPct: num(data.hpp_pct),
    fixedCostPct: num(data.fixed_cost_pct),
    netProfitPct: num(data.net_profit_pct),
    hppBudgetPct: num(data.hpp_budget_pct),
    bepPct: num(data.bep_pct),
    ownerPct: num(data.owner_pct),
    managerPct: num(data.manager_pct),
    settlementBusinessDays: num(data.settlement_business_days),
  };
}

export async function fetchCashFlowSummary(start: string, end: string): Promise<BucketSummary[]> {
  const { data, error } = await supabase.rpc('cash_flow_summary', { p_start: start, p_end: end });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    bucket: row.bucket,
    opening: num(row.opening),
    totalIn: num(row.total_in),
    totalOut: num(row.total_out),
    closing: num(row.closing),
    currentBalance: num(row.current_balance),
  }));
}

/** bucket null = semua bucket */
export async function fetchCashFlowEntries(
  bucket: Bucket | null,
  start: string,
  end: string
): Promise<CashFlowEntry[]> {
  let query = supabase.from('cash_flow_entries').select('*');
  if (bucket) query = query.eq('bucket', bucket);
  const { data, error } = await query
    .gte('entry_date', start)
    .lte('entry_date', end)
    .order('entry_date')
    .order('sort_at');
  if (error) throw error;
  return (data ?? []).map((row: any, i: number) => ({
    key: `${row.entry_type}-${row.ref_id ?? row.entry_date}-${i}`,
    bucket: row.bucket,
    entryDate: row.entry_date,
    entryType: row.entry_type,
    description: row.description,
    amount: num(row.amount),
    refTable: row.ref_table,
    refId: row.ref_id,
    sortAt: row.sort_at,
  }));
}

export async function fetchHppMonths(): Promise<HppMonth[]> {
  const { data, error } = await supabase.rpc('hpp_monthly');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    month: row.month,
    allocation: num(row.allocation),
    budget: num(row.budget),
    spent: num(row.spent),
    remaining: num(row.remaining),
    reserveShare: num(row.reserve_share),
    movedToReserve: num(row.moved_to_reserve),
    reserveTotal: num(row.reserve_total),
    isClosed: row.is_closed,
  }));
}

export async function fetchNetProfitMonths(): Promise<NetProfitMonth[]> {
  const { data, error } = await supabase.rpc('net_profit_monthly');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    month: row.month,
    netProfit: num(row.net_profit),
    bepShare: num(row.bep_share),
    ownerShare: num(row.owner_share),
    managerShare: num(row.manager_share),
    assetSpent: num(row.asset_spent),
    bepBalance: num(row.bep_balance),
    ownerBalance: num(row.owner_balance),
    managerBalance: num(row.manager_balance),
  }));
}

/* ---------- Pengeluaran manual ---------- */

export async function fetchExpense(id: string): Promise<FinanceExpense> {
  const { data, error } = await supabase.from('finance_expenses').select('*').eq('id', id).single();
  if (error) throw error;
  return {
    id: data.id,
    expenseType: data.expense_type,
    name: data.name,
    employeeId: data.employee_id,
    salaryMonth: data.salary_month,
    amount: num(data.amount),
    expenseDate: data.expense_date,
    notes: data.notes,
  };
}

export async function saveExpense(input: ExpenseInput, id: string | null): Promise<void> {
  const { error } = await supabase.rpc('save_finance_expense', {
    p_id: id,
    p_data: {
      expense_type: input.expenseType,
      name: input.name,
      employee_id: input.employeeId,
      salary_month: input.salaryMonth,
      amount: input.amount,
      expense_date: input.expenseDate,
      notes: input.notes,
    },
  });
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_finance_expense', { p_id: id });
  if (error) throw error;
}

/** Gaji karyawan untuk 1 bulan dari payroll (gaji bersih sudah dipotong kasbon) */
export async function fetchPayrollForMonth(month: string): Promise<
  {
    employeeId: string;
    fullName: string;
    baseSalary: number;
    bonusTotal: number;
    kasbonTotal: number;
    grossSalary: number;
    totalSalary: number;
    paid: boolean;
    /** Lembur malam bulan itu yang belum diputuskan admin (belum masuk gaji) */
    pendingOvertimeMinutes: number;
  }[]
> {
  const start = month.slice(0, 7) + '-01';
  const d = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0);
  const end = `${start.slice(0, 7)}-${String(d.getDate()).padStart(2, '0')}`;

  const [payroll, employees, paid, pending] = await Promise.all([
    supabase.rpc('employee_payroll', { p_start: start, p_end: end }),
    supabase.from('employees').select('id, full_name, is_active').order('full_name'),
    supabase
      .from('finance_expenses')
      .select('employee_id')
      .eq('expense_type', 'gaji')
      .eq('salary_month', start),
    supabase
      .from('attendance')
      .select('employee_id, overtime_night_minutes')
      .eq('overtime_status', 'pending')
      .gte('attendance_date', start)
      .lte('attendance_date', end),
  ]);
  if (payroll.error) throw payroll.error;
  if (employees.error) throw employees.error;
  if (paid.error) throw paid.error;
  if (pending.error) throw pending.error;
  const pendingById = new Map<string, number>();
  (pending.data ?? []).forEach((a: any) =>
    pendingById.set(
      a.employee_id,
      (pendingById.get(a.employee_id) ?? 0) + num(a.overtime_night_minutes)
    )
  );

  const paidIds = new Set((paid.data ?? []).map((p: any) => p.employee_id));
  const payById = new Map((payroll.data ?? []).map((p: any) => [p.employee_id, p]));
  return (employees.data ?? [])
    .filter((e: any) => e.is_active || payById.has(e.id))
    .map((e: any) => {
      const p: any = payById.get(e.id) ?? {};
      return {
        employeeId: e.id,
        fullName: e.full_name,
        baseSalary: num(p.base_salary),
        bonusTotal: num(p.bonus_total),
        kasbonTotal: num(p.kasbon_total),
        grossSalary: num(p.gross_salary),
        totalSalary: num(p.total_salary),
        paid: paidIds.has(e.id),
        pendingOvertimeMinutes: pendingById.get(e.id) ?? 0,
      };
    });
}

/* ---------- Detail sumber baris ---------- */

export async function fetchSalesOfDay(day: string) {
  const start = new Date(`${day}T00:00:00+07:00`).toISOString();
  const end = new Date(`${day}T23:59:59.999+07:00`).toISOString();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, transaction_number, order_type, payment_method, customer_name, total_amount, gateway_mdr, gateway_tax, status, transaction_date'
    )
    .neq('status', 'dibatalkan')
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date');
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    id: t.id as string,
    number: t.transaction_number as string,
    orderType: t.order_type as string,
    paymentMethod: t.payment_method as string,
    customerName: t.customer_name as string | null,
    total: num(t.total_amount),
    fee: num(t.gateway_mdr) + num(t.gateway_tax),
    net: num(t.total_amount) - num(t.gateway_mdr) - num(t.gateway_tax),
    status: t.status as string,
    time: t.transaction_date as string,
  }));
}

/* ---------- Saldo Online ---------- */

export async function fetchOnlineBalance(): Promise<OnlineBalanceRow[]> {
  const { data, error } = await supabase
    .from('online_balance_overview')
    .select('*')
    .order('settled_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    transactionNumber: row.transaction_number,
    transactionDate: row.transaction_date,
    customerName: row.customer_name,
    grossAmount: num(row.gross_amount),
    gatewayMdr: num(row.gateway_mdr),
    gatewayTax: num(row.gateway_tax),
    netAmount: num(row.net_amount),
    settledAt: row.settled_at,
    availableDate: row.available_date,
    disbursedDate: row.disbursed_date,
    status: row.balance_status,
  }));
}

export async function fetchDisbursements(): Promise<Disbursement[]> {
  const { data, error } = await supabase
    .from('online_disbursements')
    .select('*')
    .order('disbursed_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    disbursedDate: row.disbursed_date,
    transactionCount: row.transaction_count,
    grossAmount: num(row.gross_amount),
    feeAmount: num(row.fee_amount),
    netAmount: num(row.net_amount),
    notes: row.notes,
  }));
}

export async function recordDisbursement(date: string, notes: string | null): Promise<void> {
  const { error } = await supabase.rpc('record_online_disbursement', {
    p_date: date,
    p_notes: notes,
  });
  if (error) throw error;
}

export async function cancelDisbursement(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_online_disbursement', { p_id: id });
  if (error) throw error;
}

export async function fetchHolidays(): Promise<BankHoliday[]> {
  const { data, error } = await supabase
    .from('bank_holidays')
    .select('holiday_date, name')
    .order('holiday_date');
  if (error) throw error;
  return (data ?? []).map((h: any) => ({ date: h.holiday_date, name: h.name }));
}

export async function addHoliday(date: string, name: string): Promise<void> {
  const { error } = await supabase.from('bank_holidays').insert({ holiday_date: date, name });
  if (error) {
    if (error.code === '23505') throw new Error('Tanggal libur ini sudah ada.');
    throw error;
  }
}

export async function deleteHoliday(date: string): Promise<void> {
  const { error } = await supabase.from('bank_holidays').delete().eq('holiday_date', date);
  if (error) throw error;
}

export async function fetchStockInDetail(id: string) {
  const { data, error } = await supabase
    .from('stock_movements')
    .select(
      'quantity, purchase_qty, qty_per_package, total_price, unit_price, notes, movement_date, raw_materials(name), units!stock_movements_unit_id_fkey(name), purchase_unit:units!stock_movements_purchase_unit_id_fkey(name)'
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  const row: any = data;
  return {
    materialName: row.raw_materials?.name ?? '—',
    quantity: num(row.quantity),
    unitName: row.units?.name ?? '',
    purchaseQty: num(row.purchase_qty),
    qtyPerPackage: num(row.qty_per_package),
    purchaseUnitName: row.purchase_unit?.name ?? '',
    totalPrice: num(row.total_price),
    unitPrice: num(row.unit_price),
    notes: row.notes as string | null,
  };
}

export async function fetchAssetDetail(id: string) {
  const { data, error } = await supabase
    .from('assets')
    .select('name, purchase_price, quantity, purchase_date, status, notes')
    .eq('id', id)
    .single();
  if (error) throw error;
  return {
    name: data.name as string,
    price: num(data.purchase_price),
    quantity: num(data.quantity),
    purchaseDate: data.purchase_date as string,
    status: data.status as string,
    notes: data.notes as string | null,
  };
}

/* ---------- Tutup buku bulanan ---------- */

export type FinancePeriod = {
  month: string; // "2026-08-01"
  status: 'berjalan' | 'tertutup' | 'dibuka';
  reason: string | null;
  openedByName: string | null;
  openedAt: string | null;
};

export async function fetchFinancePeriods(): Promise<FinancePeriod[]> {
  const { data, error } = await supabase.rpc('finance_periods');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    month: row.month,
    status: row.status,
    reason: row.reason,
    openedByName: row.opened_by_name,
    openedAt: row.opened_at,
  }));
}

/** Bulan-bulan lalu yang sedang dibuka kembali, format "2026-08" */
export async function fetchOpenMonths(): Promise<Set<string>> {
  const { data, error } = await supabase.from('finance_open_periods').select('month');
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => String(r.month).slice(0, 7)));
}

/** Bulan tanggal ini sudah tutup buku? (bulan lalu yang tidak sedang dibuka kembali) */
export function isPeriodLocked(iso: string, today: string, openMonths: Set<string>): boolean {
  const m = iso.slice(0, 7);
  return m < today.slice(0, 7) && !openMonths.has(m);
}

export async function reopenPeriod(month: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_finance_period', {
    p_month: month,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function closePeriod(month: string): Promise<void> {
  const { error } = await supabase.rpc('close_finance_period', { p_month: month });
  if (error) throw error;
}

export async function fetchPeriodLog(): Promise<
  {
    id: string;
    month: string;
    action: 'buka' | 'tutup';
    reason: string | null;
    byName: string | null;
    at: string;
  }[]
> {
  const { data, error } = await supabase
    .from('finance_period_log')
    .select('id, month, action, reason, created_at, employees(full_name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    month: r.month,
    action: r.action,
    reason: r.reason,
    byName: r.employees?.full_name ?? null,
    at: r.created_at,
  }));
}
