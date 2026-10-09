import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ImageIcon } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { MenuProduct } from '@/kasir/types/catalog';
import { formatRupiah } from '@/utils/formatCurrency';

interface ProductCardProps {
  product: MenuProduct;
  /** Jumlah produk ini di pesanan (0 = belum dipesan) */
  quantity: number;
  /** Badge kategori di foto (disembunyikan saat tab kategori tertentu dipilih) */
  showCategory: boolean;
  onAdd: (product: MenuProduct, quantity: number) => void;
}

/** Kartu produk di grid Menu (gaya POS Majoo): satu ketuk di mana saja = tambah 1 ke pesanan */
export default function ProductCard({ product, quantity, showCategory, onAdd }: ProductCardProps) {
  const selected = quantity > 0;
  // Bahan baku habis → produk tidak bisa dipesan
  const unavailable = product.stockAvailable === 0;

  return (
    <Pressable
      onPress={() => onAdd(product, 1)}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityLabel={unavailable ? `${product.name} nonaktif` : `Tambah ${product.name}`}
      accessibilityState={{ selected, disabled: unavailable }}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        unavailable && styles.cardUnavailable,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.photo}>
        {product.photoUrl ? (
          <Image source={{ uri: product.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <ImageIcon size={24} color={colors.borderStrong} />
        )}

        {/* Sudah di pesanan: foto digelapkan + jumlahnya, nama & harga tetap normal */}
        {selected ? (
          <View style={styles.selectedOverlay}>
            <Text style={styles.selectedQuantity}>{quantity}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.stockBadge,
            product.stockLow && styles.stockBadgeLow,
            unavailable && styles.stockBadgeUnavailable,
          ]}
        >
          <Text style={[styles.stockText, unavailable && styles.stockTextUnavailable]}>
            {unavailable ? 'Nonaktif' : (product.stockAvailable ?? 0)}
          </Text>
        </View>
        {showCategory ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText} numberOfLines={1}>
              {product.categoryName}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.price}>{formatRupiah(product.price)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 6,
    gap: 6,
    borderRadius: 12,
    borderWidth: 2, // tetap 2 supaya kartu tidak bergeser saat terpilih
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.textMuted,
  },
  cardUnavailable: {
    opacity: 0.5,
    backgroundColor: colors.surfaceMuted,
  },
  cardPressed: {
    opacity: 0.7,
  },
  photo: {
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  selectedQuantity: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  stockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  stockBadgeLow: {
    backgroundColor: colors.danger,
  },
  stockBadgeUnavailable: {
    backgroundColor: colors.borderStrong,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  stockTextUnavailable: {
    color: colors.textSecondary,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 6,
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
    gap: 4,
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
