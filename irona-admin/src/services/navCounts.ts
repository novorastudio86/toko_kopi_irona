import { supabase } from './supabase';

/** Total baris tiap tabel/view (aktif + nonaktif). Tabel yang gagal dihitung dilewati. */
export async function fetchNavCounts(tables: string[]): Promise<Record<string, number>> {
  const results = await Promise.all(
    tables.map((table) =>
      supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .then(({ count, error }) => [table, error ? null : count] as const)
    )
  );
  return Object.fromEntries(results.filter(([, count]) => count !== null)) as Record<string, number>;
}
