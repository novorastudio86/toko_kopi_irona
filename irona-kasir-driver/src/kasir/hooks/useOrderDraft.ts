import { useState } from 'react';
import type { MenuProduct } from '@/kasir/types/catalog';
import type { Member, OrderDraft, OrderType, PaymentMethod } from '@/kasir/types/order';

const EMPTY_DRAFT: OrderDraft = {
  items: [],
  member: null,
  customerName: '',
  orderType: 'dine_in',
  paymentMethod: 'tunai',
  cashReceived: 0,
};

/**
 * Semua state & aksi untuk pesanan yang sedang dibuat.
 * Dipisah dari layar supaya MenuScreen tetap ringkas, dan nanti mudah dipakai saat menyimpan order.
 */
export function useOrderDraft() {
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);

  // Nilai turunan: dihitung dari draft, tidak disimpan di state
  const totalQuantity = draft.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = draft.items.reduce((sum, i) => sum + i.quantity * i.product.price, 0);
  const total = subtotal; // tanpa pajak; diskon & poin menyusul
  const change = draft.paymentMethod === 'tunai' ? draft.cashReceived - total : 0;
  const isReady =
    draft.items.length > 0 &&
    (draft.paymentMethod === 'qris' || draft.cashReceived >= total);

  function update(patch: Partial<OrderDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function addItem(product: MenuProduct, quantity: number) {
    setDraft((current) => {
      const existing = current.items.find((i) => i.product.id === product.id);
      const items = existing
        ? current.items.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
          )
        : [...current.items, { product, quantity, notes: '' }];
      return { ...current, items };
    });
  }

  function setItemQuantity(productId: string, quantity: number) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((i) => (i.product.id === productId ? { ...i, quantity } : i)),
    }));
  }

  function setItemNotes(productId: string, notes: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((i) => (i.product.id === productId ? { ...i, notes } : i)),
    }));
  }

  function removeItem(productId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((i) => i.product.id !== productId),
    }));
  }

  return {
    draft,
    totalQuantity,
    subtotal,
    total,
    change,
    isReady,
    addItem,
    setItemQuantity,
    setItemNotes,
    removeItem,
    clearItems: () => update({ items: [] }),
    setMember: (member: Member | null) =>
      update({ member, customerName: member ? member.name : '' }),
    setCustomerName: (customerName: string) => update({ customerName }),
    setOrderType: (orderType: OrderType) => update({ orderType }),
    setPaymentMethod: (paymentMethod: PaymentMethod) => update({ paymentMethod, cashReceived: 0 }),
    setCashReceived: (cashReceived: number) => update({ cashReceived }),
    reset: () => setDraft(EMPTY_DRAFT),
  };
}

export type OrderDraftApi = ReturnType<typeof useOrderDraft>;