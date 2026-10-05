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
          <ImageIcon size={28} color={colors.borderStrong} />
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
          <Text style={styles.description} numberOfLines={2}>
            {product.description}
          </Text>
        ) : null}
        <Text style={styles.price}>{formatRupiah(product.price)}</Text>
      </View>

      <View style={styles.actions}>
        <QuantityStepper value={quantity} onChange={setQuantity} />
        <Pressable
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel={`Tambah ${product.name} ke tas`}
          style={({ pressed }) => [styles.addButton, pressed && styles.addPressed]}
        >
          <ShoppingBag size={16} color={colors.textOnDark} />
          <Text style={styles.addText}>Tas</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photo: {
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    maxWidth: '85%',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  price: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  addPressed: {
    backgroundColor: colors.primaryHover,
  },
  addText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textOnDark,
  },
});