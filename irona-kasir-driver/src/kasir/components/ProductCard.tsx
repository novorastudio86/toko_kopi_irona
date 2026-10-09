import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ImageIcon, ShoppingBag } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { MenuProduct } from '@/kasir/types/catalog';
import { formatRupiah } from '@/utils/formatCurrency';
import QuantityStepper from './QuantityStepper';

interface ProductCardProps {
  product: MenuProduct;
  onAdd: (product: MenuProduct, quantity: number) => void;
}

/** Kartu produk di grid Menu: foto, nama, harga, jumlah, tombol + Tas */
export default function ProductCard({ product, onAdd }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);

  function handleAdd() {
    onAdd(product, quantity);
    setQuantity(1); // kembali ke 1 setelah masuk keranjang
  }

  return (
    <View style={styles.card}>
      <View style={styles.photo}>
        {product.photoUrl ? (
          <Image source={{ uri: product.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <ImageIcon size={22} color={colors.borderStrong} />
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText} numberOfLines={1}>
            {product.categoryName}
          </Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        {product.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {product.description}
          </Text>
        ) : null}
        <Text style={styles.price}>{formatRupiah(product.price)}</Text>
      </View>

      <View style={styles.actions}>
        <QuantityStepper value={quantity} onChange={setQuantity} compact />
        <Pressable
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel={`Tambah ${product.name} ke tas`}
          style={({ pressed }) => [styles.addButton, pressed && styles.addPressed]}
        >
          <ShoppingBag size={14} color={colors.textOnDark} />
          <Text style={styles.addText}>Tas</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 8,
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photo: {
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    maxWidth: '85%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: colors.surface,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
  price: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  addPressed: {
    backgroundColor: colors.primaryHover,
  },
  addText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnDark,
  },
});