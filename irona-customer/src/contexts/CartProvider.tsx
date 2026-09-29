import { useMemo, type ReactNode } from 'react';
import { CartContext } from '@/hooks/useCart';
import { useQuickCart } from '@/screens/home/useQuickCart';

// ponytail: jumlah item diambil dari qty tombol tambah cepat; ganti dengan daftar item asli saat fitur keranjang dibangun
export default function CartProvider({ children }: { children: ReactNode }) {
  const { itemCount } = useQuickCart();
  const value = useMemo(() => ({ itemCount }), [itemCount]);
  return <CartContext value={value}>{children}</CartContext>;
}
