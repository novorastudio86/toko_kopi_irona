import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { quoteDelivery } from '../_shared/deliveryQuote.ts';
import { authHeader, MIDTRANS_API } from '../_shared/midtrans.ts';

// Checkout Web Customer: hitung ulang harga & ongkir di server, simpan pesanan, minta QRIS Midtrans.
// Body: { customerName, phone, location: { lat, lng }, address, driverNote, orderNote, items: [{ productId, qty }] }
// Harga, ongkir, diskon & total dari client diabaikan.

const PAY_WINDOW_MIN = 15; // samakan dengan PAY_WINDOW_MIN di irona-customer orderLogic.ts
const PHONE_PATTERN = /^(\+62|62|0)8\d{8,11}$/;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

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

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body harus JSON.' }, 400);
  }

  const customerName = text(body?.customerName, 60);
  const phone = text(body?.phone, 20).replace(/[\s-]/g, '');
  const lat = Number(body?.location?.lat);
  const lng = Number(body?.location?.lng);
  const rawItems: unknown[] = Array.isArray(body?.items) ? body.items : [];
  if (!customerName) return json({ error: 'Nama pemesan wajib diisi.' }, 400);
  if (!PHONE_PATTERN.test(phone)) return json({ error: 'Nomor WhatsApp tidak valid.' }, 400);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'Titik antar tidak valid.' }, 400);
  }
  if (rawItems.length === 0 || rawItems.length > 50) return json({ error: 'Isi keranjang tidak valid.' }, 400);

  // Gabungkan produk yang sama
  const qtyById = new Map<string, number>();
  for (const it of rawItems as { productId?: unknown; qty?: unknown }[]) {
    const qty = Number(it?.qty);
    if (typeof it?.productId !== 'string' || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return json({ error: 'Isi keranjang tidak valid.' }, 400);
    }
    qtyById.set(it.productId, (qtyById.get(it.productId) ?? 0) + qty);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { data: open, error: openErr } = await admin.rpc('is_store_open', { p_channel: 'online' });
    if (openErr) throw openErr;
    if (!open) return json({ error: 'Pesanan online sedang tutup.' }, 409);

    const { data: menu, error: menuErr } = await admin.rpc('online_menu_products');
    if (menuErr) throw menuErr;
    // deno-lint-ignore no-explicit-any
    const byId = new Map((menu as any[]).map((p) => [p.id, p]));
    const items = [];
    for (const [productId, qty] of qtyById) {
      const p = byId.get(productId);
      if (!p) return json({ error: 'Ada menu yang sudah tidak tersedia. Muat ulang halaman.' }, 409);
      // IDR di Midtrans harus bilangan bulat
      items.push({
        productId,
        name: p.name as string,
        qty,
        price: Math.round(Number(p.price)),
        onlineExtra: Math.round(Number(p.online_extra)),
      });
    }

    const quote = await quoteDelivery(admin, lat, lng);
    if (!quote.deliverable || quote.fee === null) {
      return json({ error: 'Titik antar di luar jangkauan.' }, 400);
    }
    const { data: settings, error: setErr } = await admin
      .from('online_order_settings')
      .select('service_fee')
      .single();
    if (setErr) throw setErr;

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const deliveryFee = Math.round(quote.fee);
    const serviceFee = Math.round(Number(settings.service_fee));
    const total = subtotal + deliveryFee + serviceFee;

    const { data: order, error: insErr } = await admin
      .from('online_orders')
      .insert({
        customer_name: customerName,
        phone,
        address: text(body?.address, 300) || null,
        lat,
        lng,
        driver_note: text(body?.driverNote, 200) || null,
        order_note: text(body?.orderNote, 100) || null,
        items,
        subtotal,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        total,
        delivery_distance_km: quote.distanceKm,
        pay_expires_at: new Date(Date.now() + PAY_WINDOW_MIN * 60_000).toISOString(),
      })
      .select('id, code')
      .single();
    if (insErr) throw insErr;

    const itemDetails = [
      ...items.map((i) => ({ id: i.productId, name: i.name.slice(0, 50), price: i.price, quantity: i.qty })),
      { id: 'ongkir', name: 'Ongkir', price: deliveryFee, quantity: 1 },
      { id: 'biaya-layanan', name: 'Biaya layanan', price: serviceFee, quantity: 1 },
    ].filter((d) => d.price > 0);

    const res = await fetch(`${MIDTRANS_API}/v2/charge`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({
        payment_type: 'qris',
        transaction_details: { order_id: order.id, gross_amount: total },
        item_details: itemDetails,
        customer_details: { first_name: customerName, phone },
        qris: { acquirer: 'gopay' },
        custom_expiry: { expiry_duration: PAY_WINDOW_MIN, unit: 'minute' },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const charge = await res.json().catch(() => null);
    // deno-lint-ignore no-explicit-any
    const qrUrl = charge?.actions?.find((a: any) => a.name === 'generate-qr-code')?.url;
    if (!res.ok || charge?.status_code !== '201' || !qrUrl) {
      console.error('midtrans charge gagal', res.status, charge);
      await admin
        .from('online_orders')
        .update({ status: 'dibatalkan', midtrans_status: charge?.status_message ?? `http ${res.status}` })
        .eq('id', order.id);
      return json({ error: 'Gagal membuat QRIS. Coba lagi sebentar.' }, 502);
    }

    const { error: updErr } = await admin
      .from('online_orders')
      .update({
        midtrans_transaction_id: charge.transaction_id,
        midtrans_status: charge.transaction_status,
        qr_url: qrUrl,
      })
      .eq('id', order.id);
    if (updErr) throw updErr;

    const { data: result, error: getErr } = await admin.rpc('get_online_order', { p_id: order.id });
    if (getErr) throw getErr;
    return json(result);
  } catch (err) {
    console.error('create-online-order', err);
    return json({ error: 'Gagal membuat pesanan.' }, 500);
  }
});
