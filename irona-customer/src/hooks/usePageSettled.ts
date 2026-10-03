import { useOutletContext } from 'react-router';

export interface PageContext {
  settled: boolean;
}

/** false selama tirai pindah halaman masih terbuka (SiteLayout): halaman bisa menahan efek isinya */
export const usePageSettled = () => useOutletContext<PageContext>().settled;
