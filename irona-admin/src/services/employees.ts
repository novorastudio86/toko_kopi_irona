import { supabase } from './supabase';
import type {
  EmployeeDetail,
  EmployeeInput,
  EmployeeListItem,
  PayrollRow,
  RoleOption,
  RoleType,
  RoleWithEmployees,
} from '../types/employee';

export async function fetchRoles(): Promise<RoleOption[]> {
  const { data, error } = await supabase.from('roles').select('id, name, type').order('name');
  if (error) throw error;
  return (data ?? []) as RoleOption[];
}

export async function fetchEmployees(): Promise<EmployeeListItem[]> {
  const [employeeRes, roleRes] = await Promise.all([
    supabase
      .from('employees')
      .select(
        'id, full_name, phone_number, username, role_id, base_salary, delivery_bonus, is_active, hire_date'
      )
      .order('full_name'),
    fetchRoles(),
  ]);

  if (employeeRes.error) throw employeeRes.error;
  const roleMap = new Map(roleRes.map((r) => [r.id, r]));

  return (employeeRes.data ?? []).map((row: any) => {
    const role = roleMap.get(row.role_id);
    return {
      id: row.id,
      fullName: row.full_name,
      phoneNumber: row.phone_number,
      username: row.username,
      roleId: row.role_id,
      roleName: role?.name ?? '—',
      roleType: role?.type ?? 'kasir',
      baseSalary: Number(row.base_salary ?? 0),
      deliveryBonus: Number(row.delivery_bonus ?? 0),
      isActive: row.is_active,
      hireDate: row.hire_date,
    };
  });
}

export async function fetchEmployeeDetail(id: string): Promise<EmployeeDetail | null> {
  const [employeeRes, roleList] = await Promise.all([
    supabase
      .from('employees')
      .select(
        'id, code, full_name, address, phone_number, username, role_id, base_salary, delivery_bonus, is_active, created_at, hire_date, qr_token'
      )
      .eq('id', id)
      .maybeSingle(),
    fetchRoles(),
  ]);

  if (employeeRes.error) throw employeeRes.error;
  const row: any = employeeRes.data;
  if (!row) return null;

  const role = roleList.find((r) => r.id === row.role_id);
  return {
    id: row.id,
    code: row.code,
    fullName: row.full_name,
    address: row.address,
    phoneNumber: row.phone_number,
    username: row.username,
    roleId: row.role_id,
    roleName: role?.name ?? '—',
    roleType: role?.type ?? 'kasir',
    baseSalary: Number(row.base_salary ?? 0),
    deliveryBonus: Number(row.delivery_bonus ?? 0),
    isActive: row.is_active,
    createdAt: row.created_at,
    hireDate: row.hire_date,
    qrToken: row.qr_token,
  };
}

/** Akun login dibuat lewat Edge Function karena butuh hak akses service role. Mengembalikan id karyawan baru */
export async function createEmployee(input: EmployeeInput): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-employee', {
    body: {
      username: input.username,
      password: input.password,
      full_name: input.fullName,
      phone_number: input.phoneNumber,
      address: input.address,
      role_id: input.roleId,
      base_salary: input.baseSalary,
      delivery_bonus: input.deliveryBonus,
      hire_date: input.hireDate,
    },
  });

  if (error || data?.error) {
    let message = data?.error ?? error?.message ?? 'Gagal membuat karyawan.';
    // supabase-js tidak otomatis membaca isi respons saat status bukan 2xx,
    // jadi ambil manual pesan aslinya dari function
    if (error && 'context' in error && error.context instanceof Response) {
      try {
        const body = await error.context.clone().json();
        if (body?.error) message = body.error;
      } catch {
        // isi respons bukan JSON, biarkan pesan generik
      }
    }
    throw new Error(message);
  }
  return data.id as string;
}

/** Password dikosongkan = tidak diubah */
export async function updateEmployee(id: string, input: EmployeeInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke('update-employee', {
    body: {
      id,
      username: input.username,
      password: input.password || undefined,
      full_name: input.fullName,
      phone_number: input.phoneNumber,
      address: input.address,
      role_id: input.roleId,
      base_salary: input.baseSalary,
      delivery_bonus: input.deliveryBonus,
      hire_date: input.hireDate,
    },
  });

  if (error || data?.error) {
    let message = data?.error ?? error?.message ?? 'Gagal mengubah karyawan.';
    if (error && 'context' in error && error.context instanceof Response) {
      try {
        const body = await error.context.clone().json();
        if (body?.error) message = body.error;
      } catch {
        // isi respons bukan JSON, biarkan pesan generik
      }
    }
    throw new Error(message);
  }
}

/** PIN 6 digit untuk masuk Kasir/Driver App (disimpan sebagai hash, tidak bisa dibaca lagi) */
export async function setEmployeePin(employeeId: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('set_employee_pin', {
    p_employee_id: employeeId,
    p_pin: pin,
  });
  if (error) throw error;
}

/** Karyawan yang sudah punya PIN */
export async function fetchEmployeesWithPin(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('employee_pin_status');
  if (error) throw error;
  return new Set((data ?? []).map((r: { employee_id: string }) => r.employee_id));
}

/** Karyawan nonaktif otomatis ditolak saat login */
export async function setEmployeeActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('employees').update({ is_active: active }).eq('id', id);
  if (error) throw error;
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

/** Kartu QR lama otomatis tidak berlaku begitu token diganti */
export async function regenerateEmployeeQr(id: string): Promise<string> {
  const { data, error } = await supabase
    .from('employees')
    .update({ qr_token: crypto.randomUUID() })
    .eq('id', id)
    .select('qr_token')
    .single();
  if (error) throw error;
  return data.qr_token as string;
}

/** Daftar role beserta karyawan di dalamnya */
export async function fetchRolesWithEmployees(): Promise<RoleWithEmployees[]> {
  const [roleList, employeeRes] = await Promise.all([
    fetchRoles(),
    supabase
      .from('employees')
      .select('id, full_name, username, role_id, base_salary, delivery_bonus, is_active')
      .order('full_name'),
  ]);

  if (employeeRes.error) throw employeeRes.error;

  return roleList.map((role) => ({
    ...role,
    employees: (employeeRes.data ?? [])
      .filter((e: any) => e.role_id === role.id)
      .map((e: any) => ({
        id: e.id,
        fullName: e.full_name,
        username: e.username,
        isActive: e.is_active,
        baseSalary: Number(e.base_salary ?? 0),
        deliveryBonus: Number(e.delivery_bonus ?? 0),
      })),
  }));
}

export async function saveRole(
  input: { name: string; type: RoleType },
  roleId: string | null = null
): Promise<void> {
  if (roleId) {
    const { error } = await supabase.from('roles').update(input).eq('id', roleId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('roles').insert(input);
  if (error) throw error;
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from('roles').delete().eq('id', id);
  if (error) throw error;
}

/** Rincian gaji per karyawan dalam satu periode */
export async function fetchPayroll(start: string, end: string): Promise<Map<string, PayrollRow>> {
  const { data, error } = await supabase.rpc('employee_payroll', { p_start: start, p_end: end });
  if (error) throw error;

  return new Map(
    (data ?? []).map((row: any) => [
      row.employee_id as string,
      {
        employeeId: row.employee_id,
        baseSalary: Number(row.base_salary ?? 0),
        deliveryRate: Number(row.delivery_rate ?? 0),
        deliveryCount: Number(row.delivery_count ?? 0),
        deliveryBonusTotal: Number(row.delivery_bonus_total ?? 0),
        overtimeMinutes: Number(row.overtime_minutes ?? 0),
        hourlyRate: Number(row.hourly_rate ?? 0),
        overtimeBonusTotal: Number(row.overtime_bonus_total ?? 0),
        extraShiftMinutes: Number(row.extra_shift_minutes ?? 0),
        extraShiftBonusTotal: Number(row.extra_shift_bonus_total ?? 0),
        bonusTotal: Number(row.bonus_total ?? 0),
        kasbonCount: Number(row.kasbon_count ?? 0),
        kasbonTotal: Number(row.kasbon_total ?? 0),
        grossSalary: Number(row.gross_salary ?? 0),
        totalSalary: Number(row.total_salary ?? 0),
      },
    ])
  );
}
