export interface StoreProfile {
  storeName: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  socialFacebook: string;
  socialInstagram: string;
  socialTwitter: string;
  socialYoutube: string;
}

/** Nama kolom = nama di tabel receipt_settings (disimpan otomatis per kolom) */
export interface ReceiptSettings {
  paper_width: 58 | 80;
  reprint_limit_enabled: boolean;
  reprint_limit: number;
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
  show_table_number: boolean;
  show_item_price: boolean;
  show_extras: boolean;
  show_footer_note: boolean;
  footer_note: string | null;
  show_social_media: boolean;
}
