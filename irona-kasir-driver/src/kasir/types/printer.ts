/** Printer Bluetooth yang dipilih di menu Printer (disimpan di tablet) */
export interface SavedPrinter {
  name: string;
  /** Alamat MAC Bluetooth, mis. "66:22:3A:11:4F:90" */
  address: string;
}

/** Jatah cetak struk sebuah transaksi (limit/remaining null = tanpa batas) */
export interface PrintAllowance {
  printCount: number;
  limit: number | null;
  remaining: number | null;
}