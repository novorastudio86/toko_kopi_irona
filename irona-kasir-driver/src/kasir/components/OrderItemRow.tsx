import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ImageIcon, X } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { CartItem } from '@/kasir/types/catalog';
import { formatRupiah } from '@/utils/formatCurrency';
import QuantityStepper from './QuantityStepper';

interface OrderItemRowProps {
  item: CartItem;
  onChangeQuantity: (quantity: number) => void;
  onChangeNotes: (notes: string) => void;
  onRemove: () => void;
}

/** Satu baris di Daftar Menu: foto kecil, nama, harga, catatan, jumlah, hapus */
export default function OrderItemRow({
  item,
  onChangeQuantity,
  onChangeNotes,
  onRemove,
}: OrderItemRowProps) {
  const { product, quantity, notes } = item;

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {product.photoUrl ? (
          <Image source={{ uri: product.photoUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <ImageIcon size={18} color={colors.borderStrong} />
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.price}>
          {formatRupiah(product.price * quantity)}
          <Text style={styles.unit}>
            {'  '}({quantity}× @ {formatRupiah(product.price)})
          </Text>
        </Text>
        <TextInput
          value={notes}
          onChangeText={onChangeNotes}
          placeholder="+ Catatan (mis. Less Sugar)"
          placeholderTextColor={colors.textSubtle}
          style={styles.notes}
          maxLength={100}
        />
      </View>

      <QuantityStepper value={quantity} onChange={onChangeQuantity} />
      <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Hapus ${product.name}`}>
        <X size={18} color={colors.textSubtle} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  notes: {
    marginTop: 2,
    paddingVertical: 2,
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  unit: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textMuted,
  },
});