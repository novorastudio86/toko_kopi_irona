import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { CartItem } from '@/kasir/types/catalog';
import { formatRupiah } from '@/utils/formatCurrency';
import QuantityStepper from './QuantityStepper';

interface OrderItemRowProps {
  item: CartItem;
  takeAway: boolean;
  /** Potongan diskon yang terpasang di produk ini */
  discount?: { name: string; amount: number };
  onChangeQuantity: (quantity: number) => void;
  onChangeNotes: (notes: string) => void;
  onRemove: () => void;
}

/**
 * Satu baris di Daftar Menu: "jumlah  nama  total  ×".
 * Tekan baris → muncul stepper & tombol catatan; tekan baris lagi → tutup.
 */
export default function OrderItemRow({
  item,
  takeAway,
  discount,
  onChangeQuantity,
  onChangeNotes,
  onRemove,
}: OrderItemRowProps) {
  const { product, quantity, notes } = item;
  const [expanded, setExpanded] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const showNoteInput = expanded && (noteOpen || notes.length > 0);

  function toggle() {
    setExpanded((v) => !v);
    setNoteOpen(false);
  }

  return (
    <View style={[styles.row, expanded && styles.rowExpanded]}>
      <Pressable onPress={toggle} style={styles.main} accessibilityLabel={`Ubah ${product.name}`}>
        <View style={styles.line}>
          <Text style={styles.qty}>{quantity}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.price}>{formatRupiah(product.price * quantity - (discount?.amount ?? 0))}</Text>
          <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Hapus ${product.name}`}>
            <X size={18} color={colors.textSubtle} />
          </Pressable>
        </View>
        {takeAway ? <Text style={styles.takeAway}>+ Take Away ({quantity}x)</Text> : null}
        {discount ? (
          <Text style={styles.discount}>
            {discount.name} (-{formatRupiah(discount.amount)})
          </Text>
        ) : null}
        {notes && !expanded ? <Text style={styles.notes}>Catatan: {notes}</Text> : null}
      </Pressable>

      {expanded ? (
        <View style={styles.extend}>
          <View style={styles.extendLine}>
            <QuantityStepper value={quantity} onChange={onChangeQuantity} compact />
            {!showNoteInput ? (
              <Pressable
                onPress={() => setNoteOpen(true)}
                style={({ pressed }) => [styles.noteButton, pressed && styles.noteButtonPressed]}
              >
                <Text style={styles.noteButtonText}>+ Catatan</Text>
              </Pressable>
            ) : null}
          </View>
          {showNoteInput ? (
            <TextInput
              value={notes}
              onChangeText={onChangeNotes}
              placeholder="Catatan (mis. Less Sugar)"
              placeholderTextColor={colors.textSubtle}
              autoFocus={noteOpen}
              style={styles.noteInput}
              maxLength={100}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rowExpanded: {
    borderColor: colors.borderStrong,
  },
  main: {
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qty: {
    minWidth: 18,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  // Baris tambahan sejajar nama (geser selebar kolom jumlah + gap)
  takeAway: {
    marginLeft: 28,
    fontSize: 12,
    fontWeight: '400',
    color: colors.text,
  },
  discount: {
    marginLeft: 28,
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  notes: {
    marginLeft: 28,
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
  },
  extend: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  extendLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  noteButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  noteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  noteInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    fontSize: 12,
    color: colors.text,
  },
});
