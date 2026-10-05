import { supabase } from './supabase';
import type { ReceiptSettings, StoreProfile } from '../types/receipt';

const RECEIPT_COLUMNS =
  'paper_width, reprint_limit_enabled, reprint_limit, show_logo, logo_mode, show_store_name, show_address, show_phone, ' +
  'show_email, show_header_text, header_text, show_receipt_number, show_transaction_time, show_queue_number, ' +
  'show_cashier_name, show_customer, show_order_type, show_table_number, show_item_price, ' +
  'show_extras, show_footer_note, footer_note, show_social_media';

export async function fetchReceiptSettings(): Promise<ReceiptSettings> {
  const { data, error } = await supabase.from('receipt_settings').select(RECEIPT_COLUMNS).single();
  if (error) throw error;
  return data as unknown as ReceiptSettings;
}

/** Simpan sebagian kolom (auto-save tiap toggle/isian diubah) */
export async function updateReceiptSettings(patch: Partial<ReceiptSettings>): Promise<void> {
  const { error } = await supabase.from('receipt_settings').update(patch).eq('id', true);
  if (error) throw error;
}

export async function fetchStoreProfile(): Promise<StoreProfile> {
  const { data, error } = await supabase
    .from('store_settings')
    .select(
      'store_name, address, phone, email, logo_url, social_facebook, social_instagram, social_twitter, social_youtube, ' +
        'latitude, longitude'
    )
    .single();
  if (error) throw error;
  const d: any = data;
  return {
    storeName: d.store_name ?? '',
    address: d.address ?? '',
    phone: d.phone ?? '',
    email: d.email ?? '',
    logoUrl: d.logo_url,
    socialFacebook: d.social_facebook ?? '',
    socialInstagram: d.social_instagram ?? '',
    socialTwitter: d.social_twitter ?? '',
    socialYoutube: d.social_youtube ?? '',
    latitude: d.latitude === null ? null : Number(d.latitude),
    longitude: d.longitude === null ? null : Number(d.longitude),
  };
}

export async function saveStoreProfile(p: StoreProfile): Promise<void> {
  const clean = (v: string) => v.trim() || null;
  const { error } = await supabase
    .from('store_settings')
    .update({
      store_name: clean(p.storeName),
      address: clean(p.address),
      phone: clean(p.phone),
      email: clean(p.email),
      logo_url: p.logoUrl,
      social_facebook: clean(p.socialFacebook),
      social_instagram: clean(p.socialInstagram),
      social_twitter: clean(p.socialTwitter),
      social_youtube: clean(p.socialYoutube),
      latitude: p.latitude,
      longitude: p.longitude,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  if (error) throw error;
}

export async function uploadStoreLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('store-assets')
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from('store-assets').getPublicUrl(path).data.publicUrl;
}
