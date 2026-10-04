import { createClient } from 'npm:@supabase/supabase-js@2';
import { applyMidtransStatus, signatureOf, UUID_PATTERN } from '../_shared/midtrans.ts';

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
  if (!UUID_PATTERN.test(orderId)) return new Response('ok');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    await applyMidtransStatus(admin, n);
    return new Response('ok');
  } catch (err) {
    console.error('midtrans-webhook', err);
    // 500 → Midtrans mengirim ulang notifikasi
    return new Response('Gagal memproses notifikasi.', { status: 500 });
  }
});
