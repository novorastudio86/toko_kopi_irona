/** "0812-3456 789" / "+62812…" → "62812…" (format nomor untuk wa.me) */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

/** Link chat WhatsApp, bisa dengan pesan awal */
export function whatsAppUrl(phone: string, message?: string): string {
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${toWhatsAppNumber(phone)}${text}`;
}

/** Link Google Maps untuk mencari alamat (sementara, sebelum ada titik GPS) */
export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Link navigasi Google Maps ke titik tujuan (rute dari lokasi HP saat ini) */
export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}
