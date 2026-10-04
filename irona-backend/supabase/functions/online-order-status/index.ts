import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { applyMidtransStatus, fetchMidtransStatus, UUID_PATTERN } from '../_shared/midtrans.ts';

// Status pesanan untuk halaman pesanan Web Customer. Body: { id }
// Selama belum lunas, status ditanyakan juga ke Midtrans — cadangan kalau webhook telat / tidak sampai
// (mis. lokal tanpa ngrok). Webhook tetap jalur utama.
// ponytail: 1 panggilan Midtrans per polling (tiap 5 dtk, maks. ~15 menit per pesanan); kalau order
// ramai, cek Midtrans hanya tiap N polling atau setelah batas bayar.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);

  let id = '';
  try {
    id = String((await req.json())?.id ?? '');
  } catch {
    return json({ error: 'Body harus JSON.' }, 400);
  }
  if (!UUID_PATTERN.test(id)) return json(null);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { data: order, error } = await admin
      .from('online_orders')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!order) return json(null);

    if (order.status === 'menunggu_pembayaran') {
      try {
        const n = await fetchMidtransStatus(id);
        if (n) await applyMidtransStatus(admin, n);
      } catch (err) {
        // Midtrans tidak terjangkau: tetap kirim status terakhir dari database
        console.error('online-order-status: cek Midtrans gagal', err);
      }
    }

    const { data, error: getErr } = await admin.rpc('get_online_order', { p_id: id });
    if (getErr) throw getErr;
    return json(data);
  } catch (err) {
    console.error('online-order-status', err);
    return json({ error: 'Gagal memuat pesanan.' }, 500);
  }
});
