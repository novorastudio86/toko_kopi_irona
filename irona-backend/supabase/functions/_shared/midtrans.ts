import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Midtrans Core API. Secret: MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION ("true" untuk production).
// Panduan setup: docs/MIDTRANS-SETUP.md

export function serverKey(): string {
  const key = Deno.env.get('MIDTRANS_SERVER_KEY');
  if (!key) throw new Error('MIDTRANS_SERVER_KEY belum diisi.');
  return key;
}

export const MIDTRANS_API =
  Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true'
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';

export function authHeader(): string {
  return `Basic ${btoa(`${serverKey()}:`)}`;
}

/** signature_key notifikasi = SHA512(order_id + status_code + gross_amount + ServerKey) */
export async function signatureOf(orderId: string, statusCode: string, grossAmount: string) {
  const data = new TextEncoder().encode(orderId + statusCode + grossAmount + serverKey());
  const hash = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Status Midtrans terbaru untuk 1 order (GET /v2/{order_id}/status); null = belum ada di Midtrans */
// deno-lint-ignore no-explicit-any
export async function fetchMidtransStatus(orderId: string): Promise<any | null> {
  const res = await fetch(`${MIDTRANS_API}/v2/${orderId}/status`, {
    headers: { Accept: 'application/json', Authorization: authHeader() },
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.transaction_status) return null;
  return body;
}

/**
 * Terapkan status Midtrans (notifikasi webhook / hasil cek status) ke online_orders.
 * Dipakai midtrans-webhook & online-order-status; aman dipanggil berulang.
 */
export async function applyMidtransStatus(
  admin: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  n: any
): Promise<void> {
  const orderId = String(n.order_id);
  const { data: order, error } = await admin
    .from('online_orders')
    .select('id, total')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return;
  if (Number(n.gross_amount) !== Number(order.total)) {
    console.error('midtrans: nominal tidak cocok', orderId, n.gross_amount, order.total);
    return;
  }

  const status = String(n.transaction_status);
  const paid = status === 'settlement' || (status === 'capture' && n.fraud_status === 'accept');
  if (paid) {
    const { error: settleErr } = await admin.rpc('settle_online_order', {
      p_id: orderId,
      p_midtrans_status: status,
    });
    if (settleErr) throw settleErr;
    return;
  }
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
