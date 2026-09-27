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
      return json({ error: 'Hanya Admin/Owner yang boleh mengubah data karyawan.' }, 403);
    }

    const {
      id,
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

    if (!id || !username || !full_name || !phone_number || !role_id) {
      return json({ error: 'Data belum lengkap.' }, 400);
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: current, error: currentError } = await adminClient
      .from('employees')
      .select('username, roles(type)')
      .eq('id', id)
      .single();

    if (currentError || !current) return json({ error: 'Karyawan tidak ditemukan.' }, 404);

    const { data: newRole } = await adminClient.from('roles').select('type').eq('id', role_id).single();
    if (!newRole) return json({ error: 'Role tidak ditemukan.' }, 400);

    const wasStaff = (current.roles as any)?.type === 'staf';
    const isStaff = newRole.type === 'staf';

    if (password && String(password).length < 6) {
      return json({ error: 'Password minimal 6 karakter.' }, 400);
    }
    // Pindah dari staf (tanpa aplikasi) ke Kasir/Driver: wajib dibuatkan password baru
    if (wasStaff && !isStaff && !password) {
      return json({ error: 'Isi password untuk akses aplikasi, karena role baru memerlukan login.' }, 400);
    }

    const newUsername = String(username).trim().toLowerCase();
    const authUpdate: Record<string, string> = {};

    // Username adalah bagian dari email login, jadi ikut diperbarui di Auth
    if (newUsername !== current.username) authUpdate.email = `${newUsername}@irona.internal`;
    if (isStaff) {
      // Staf tidak login: password lama (kalau ada) diganti password acak supaya tidak bisa dipakai lagi
      if (!wasStaff) authUpdate.password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    } else if (password) {
      authUpdate.password = password;
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(id, authUpdate);
      if (authError) return json({ error: authError.message }, 400);
    }

    const { error: updateError } = await adminClient
      .from('employees')
      .update({
        username: newUsername,
        full_name,
        phone_number,
        address: address ?? null,
        role_id,
        base_salary: base_salary ?? 0,
        delivery_bonus: delivery_bonus ?? 0,
        ...(hire_date ? { hire_date } : {}),
      })
      .eq('id', id);

    if (updateError) {
      // Kembalikan email login kalau update tabel gagal, supaya tidak jadi tidak sinkron
      if (authUpdate.email) {
        await adminClient.auth.admin.updateUserById(id, {
          email: `${current.username}@irona.internal`,
        });
      }
      return json({ error: updateError.message }, 400);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});