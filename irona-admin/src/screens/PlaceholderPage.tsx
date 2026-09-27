import { useLocation } from 'react-router';
import { getNavTitle } from '../constants/navigation';

export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const title = getNavTitle(pathname);
  const isKnown = title !== pathname;

  return (
    <p className="p-6 text-sm text-neutral-500 xl:p-8">
      {isKnown ? `Halaman "${title}" belum dibangun.` : `Halaman "${pathname}" tidak ditemukan.`}
    </p>
  );
}