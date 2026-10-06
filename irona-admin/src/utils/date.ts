/** Date → "2026-09-25" menurut jam lokal (WIB). Jangan pakai toISOString() — itu UTC. */
export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Tanggal hari ini (WIB) → "2026-09-25" */
export function todayISO(): string {
  return toLocalISO(new Date());
}

/** "2026-09-25" → Date jam 00:00 waktu lokal (new Date("2026-09-25") dibaca sebagai UTC) */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-09-25" → "Jumat, 25 Sep" */
export function formatDayLabel(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

/** "08:00:00" → "08:00" */
export function formatClock(time: string | null): string {
  return time ? time.slice(0, 5) : '';
}

/** "2026-09-01" → "September 2026" */
export function formatMonthLabel(iso: string): string {
  return parseLocalDate(iso.slice(0, 7) + '-01').toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
}

/** Batas awal riwayat perubahan: 14 hari terakhir (ISO, untuk filter changed_at) */
export function historySince(days = 14): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
