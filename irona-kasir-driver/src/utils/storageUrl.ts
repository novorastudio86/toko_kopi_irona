export function toDeviceStorageUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = url.indexOf('/storage/v1/');
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (marker === -1 || !base) return url;
  return base.replace(/\/$/, '') + url.slice(marker);
}