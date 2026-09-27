import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // Client dengan konteks user yang memanggil — untuk verifikasi siapa dia
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Tidak terautentikasi.' }, 401);

    const { data: callerEmployee } = await callerClient
      .from('employees')
      .select('is_active, roles(type)')
      .eq('id', caller.id)
      .single();

    const callerRole = (callerEmployee?.roles as any)?.type;
    if (!callerEmployee?.is_active || callerRole !== 'admin') {
      return json({ error: 'Hanya Admin/Owner yang boleh membuat akun baru.' }, 403);
    }

    const {
      username,
      password,
      full_name,
      phone_number,
      role_id,
      base_salary,
      delivery_bonus,
      address,
      hire_date,
    } = await req.json();

    if (!username || !full_name || !phone_number || !role_id) {
      return json({ error: 'Data belum lengkap.' }, 400);
    }

    // Client admin (service_role) — hanya ini yang boleh membuat akun Auth
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: role } = await adminClient.from('roles').select('type').eq('id', role_id).single();
    if (!role) return json({ error: 'Role tidak ditemukan.' }, 400);

    // Role tipe "staf" (mis. Barista) tidak login ke aplikasi apa pun: akunnya tetap dibuat
    // karena data karyawan terhubung ke Auth, tapi dengan password acak yang tidak diketahui siapa pun
    const isStaff = role.type === 'staf';
    if (!isStaff && (!password || String(password).length < 6)) {
      return json({ error: 'Password minimal 6 karakter.' }, 400);
    }
    const loginPassword = isStaff ? `${crypto.randomUUID()}${crypto.randomUUID()}` : password;

    const cleanUsername = String(username).trim().toLowerCase();
    const email = `${cleanUsername}@irona.internal`;

    const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password: loginPassword,
      email_confirm: true,
    });

    if (createUserError || !newUser.user) {
      return json({ error: createUserError?.message ?? 'Gagal membuat akun.' }, 400);
    }

    const { error: insertError } = await adminClient.from('employees').insert({
      id: newUser.user.id,
      username: cleanUsername,
      full_name,
      phone_number,
      address: address ?? null,
      role_id,
      base_salary: base_salary ?? 0,
      delivery_bonus: delivery_bonus ?? 0,
      ...(hire_date ? { hire_date } : {}),
      is_active: true,
    });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(newUser.user.id); // rollback
      return json({ error: insertError.message }, 400);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});