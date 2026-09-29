import { createContext, useContext } from 'react';

export interface CartState {
  itemCount: number;
}

export const CartContext = createContext<CartState | null>(null);

export function useCart(): CartState {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart harus dipakai di dalam <CartProvider>');
  return cart;
}
