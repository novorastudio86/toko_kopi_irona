import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { quoteDelivery } from '../_shared/deliveryQuote.ts';

// Ongkir untuk titik antar pelanggan (checkout Web Customer). Body: { lat, lng }
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

  let body: { lat?: unknown; lng?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body harus JSON.' }, 400);
  }
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'Titik lokasi tidak valid.' }, 400);
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    return json(await quoteDelivery(admin, lat, lng));
  } catch (err) {
    console.error('delivery-quote', err);
    return json({ error: 'Gagal menghitung rute pengantaran.' }, 502);
  }
});
