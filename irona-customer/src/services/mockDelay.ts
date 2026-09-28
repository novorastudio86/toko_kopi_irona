// TODO(backend): hapus file ini setelah semua services memanggil Supabase.
const MOCK_DELAY_MS = 300;

/** Simulasi latensi jaringan untuk data mock */
export function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), MOCK_DELAY_MS));
}
