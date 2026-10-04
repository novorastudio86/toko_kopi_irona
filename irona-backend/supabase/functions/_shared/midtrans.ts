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
