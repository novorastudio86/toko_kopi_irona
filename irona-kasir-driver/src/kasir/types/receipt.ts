/** Pengaturan Struk dari Web Admin (Penjualan → Custom Struk) */
export interface ReceiptSettings {
  paperWidth: 58 | 80;
  showLogo: boolean;
  logoMode: 'normal' | 'penuh';
  showStoreName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showHeaderText: boolean;
  headerText: string | null;
  showReceiptNumber: boolean;
  showTransactionTime: boolean;
  showQueueNumber: boolean;
  showCashierName: boolean;
  showCustomer: boolean;
  showOrderType: boolean;
  showItemPrice: boolean;
  showExtras: boolean;
  showFooterNote: boolean;
  footerNote: string | null;
  showSocialMedia: boolean;
}

/** Data Toko dari Web Admin */
export interface StoreProfile {
  storeName: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  socialInstagram: string;
  socialFacebook: string;
  socialTwitter: string;
  socialYoutube: string;
}