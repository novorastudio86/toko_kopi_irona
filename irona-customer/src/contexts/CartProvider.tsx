import { useMemo, useState, type ReactNode } from 'react';
import { CartContext } from '@/hooks/useCart';

// ponytail: counter dummy; ganti dengan daftar item + qty saat fitur keranjang dibangun
export default function CartProvider({ children }: { children: ReactNode }) {
  const [itemCount, setItemCount] = useState(0);
  const value = useMemo(
    () => ({ itemCount, addItem: () => setItemCount((n) => n + 1) }),
    [itemCount]
  );
  return <CartContext value={value}>{children}</CartContext>;
}
