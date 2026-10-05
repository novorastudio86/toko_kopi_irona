import { supabase } from '@/services/supabase';
import type { ReceiptSettings, StoreProfile } from '@/kasir/types/receipt';
import { toDeviceStorageUrl } from '@/utils/storageUrl';

interface ReceiptSettingsRow {
  paper_width: 58 | 80;
  show_logo: boolean;
  logo_mode: 'normal' | 'penuh';
  show_store_name: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_header_text: boolean;
  header_text: string | null;
  show_receipt_number: boolean;
  show_transaction_time: boolean;
  show_queue_number: boolean;
  show_cashier_name: boolean;
  show_customer: boolean;
  show_order_type: boolean;
  show_item_price: boolean;
  show_extras: boolean;
  show_footer_note: boolean;
  footer_note: string | null;
  show_social_media: boolean;
}

interface StoreRow {
  store_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_twitter: string | null;
  social_youtube: string | null;
}

/** Pengaturan struk + data toko, selalu diambil terbaru supaya perubahan di Web Admin langsung terpakai */
export async function fetchReceiptConfig(): Promise<{
  settings: ReceiptSettings;
  store: StoreProfile;
}> {
  const [settingsRes, storeRes] = await Promise.all([
    supabase.from('receipt_settings').select('*').single<ReceiptSettingsRow>(),
    supabase.from('store_settings').select('*').single<StoreRow>(),
  ]);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  if (storeRes.error) throw new Error(storeRes.error.message);

  const s = settingsRes.data;
  const t = storeRes.data;
  return {
    settings: {
      paperWidth: s.paper_width,
      showLogo: s.show_logo,
      logoMode: s.logo_mode,
      showStoreName: s.show_store_name,
      showAddress: s.show_address,
      showPhone: s.show_phone,
      showEmail: s.show_email,
      showHeaderText: s.show_header_text,
      headerText: s.header_text,
      showReceiptNumber: s.show_receipt_number,
      showTransactionTime: s.show_transaction_time,
      showQueueNumber: s.show_queue_number,
      showCashierName: s.show_cashier_name,
      showCustomer: s.show_customer,
      showOrderType: s.show_order_type,
      showItemPrice: s.show_item_price,
      showExtras: s.show_extras,
      showFooterNote: s.show_footer_note,
      footerNote: s.footer_note,
      showSocialMedia: s.show_social_media,
    },
    store: {
      storeName: t.store_name ?? '',
      address: t.address ?? '',
      phone: t.phone ?? '',
      email: t.email ?? '',
      logoUrl: toDeviceStorageUrl(t.logo_url),
      socialInstagram: t.social_instagram ?? '',
      socialFacebook: t.social_facebook ?? '',
      socialTwitter: t.social_twitter ?? '',
      socialYoutube: t.social_youtube ?? '',
    },
  };
}