import { createClient } from 'npm:@supabase/supabase-js@2';
import { signatureOf } from '../_shared/midtrans.ts';

// Payment Notification URL Midtrans → https://<project>/functions/v1/midtrans-webhook
// verify_jwt = false (Midtrans tidak mengirim JWT); keaslian dicek lewat signature_key.
// Balas 200 untuk notifikasi yang sudah diproses/diabaikan supaya Midtrans tidak mengirim ulang.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method tidak didukung.', { status: 405 });

  // deno-lint-ignore no-explicit-any
  let n: any;
  try {
    n = await req.json();
  } catch {
    return new Response('Body harus JSON.', { status: 400 });
  }

  const orderId = String(n?.order_id ?? '');
  const statusCode = String(n?.status_code ?? '');
  const grossAmount = String(n?.gross_amount ?? '');
  if (!orderId || n?.signature_key !== (await signatureOf(orderId, statusCode, grossAmount))) {
    return new Response('Signature tidak valid.', { status: 401 });
  }

  // Mis. "Test notification" dari dashboard Midtrans: order_id bukan pesanan kita (bukan uuid)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return new Response('ok');
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { data: order, error } = await admin
      .from('online_orders')
      .select('id, total')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return new Response('ok');
    if (Number(grossAmount) !== Number(order.total)) {
      console.error('midtrans-webhook: nominal tidak cocok', orderId, grossAmount, order.total);
      return new Response('ok');
    }

    const status = String(n.transaction_status);
    const paid = status === 'settlement' || (status === 'capture' && n.fraud_status === 'accept');
    if (paid) {
      const { error: settleErr } = await admin.rpc('settle_online_order', {
        p_id: orderId,
        p_midtrans_status: status,
      });
      if (settleErr) throw settleErr;
    } else {
      const next =
        status === 'expire' ? 'kedaluwarsa'
        : status === 'cancel' || status === 'deny' || status === 'failure' ? 'dibatalkan'
        : null;
      const { error: updErr } = await admin
        .from('online_orders')
        .update(next ? { midtrans_status: status, status: next } : { midtrans_status: status })
        .eq('id', orderId)
        .eq('status', 'menunggu_pembayaran');
      if (updErr) throw updErr;
    }
    return new Response('ok');
  } catch (err) {
    console.error('midtrans-webhook', err);
    // 500 → Midtrans mengirim ulang notifikasi
    return new Response('Gagal memproses notifikasi.', { status: 500 });
  }
});
