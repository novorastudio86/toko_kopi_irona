import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import { useResponsive } from '@/hooks/useResponsive';
import CategoryPills from '@/kasir/components/CategoryPills';
import MenuTopBar from '@/kasir/components/MenuTopBar';
import OrderPanel from '@/kasir/components/OrderPanel';
import OrderSuccessModal from '@/kasir/components/OrderSuccessModal';
import ProductCard from '@/kasir/components/ProductCard';
import { useOrderDraft } from '@/kasir/hooks/useOrderDraft';
import PaymentScreen from '@/kasir/screens/PaymentScreen';
import { fetchMenuCatalog, fetchOfflinePromotions } from '@/kasir/services/catalog';
import { createKasirOrder } from '@/kasir/services/orders';
import type { MenuCategory, MenuProduct, Promotion } from '@/kasir/types/catalog';
import type { OrderReceipt } from '@/kasir/types/order';

const GRID_GAP = 10;
/** Kartu tersempit yang masih nyaman dibaca (tanpa stepper, kartu bisa lebih rapat) */
const MIN_CARD_WIDTH = 140;
/** Jarak kanan grid supaya garis scroll tidak menimpa kartu kolom terakhir */
const SCROLLBAR_GAP = 8;

interface MenuScreenProps {
  /** Sesi kasir yang sedang berjalan (null = masih dibuka) */
  sessionId: string | null;
  /** Tombol ☰ pembuka sidebar, ditaruh di kiri kolom cari */
  sidebarToggle: ReactNode;
}

/** Menu kasir: cari & filter menu di kiri, pesanan aktif di kanan */
export default function MenuScreen({ sessionId, sidebarToggle }: MenuScreenProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const order = useOrderDraft(promotions);
  const [processing, setProcessing] = useState(false);
  // Halaman Pembayaran menggantikan grid + keranjang; pesanan tetap di useOrderDraft
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  // Lebar area grid diukur saat tampil; jumlah kolom menyesuaikan lebar layar
  const [gridWidth, setGridWidth] = useState(0);
  const cardsWidth = gridWidth - SCROLLBAR_GAP;
  const columns = Math.max(1, Math.floor((cardsWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)));
  const cardWidth = (cardsWidth - GRID_GAP * (columns - 1)) / columns;
  // Shell tidak memberi jarak bawah untuk Menu: grid digulir sampai tepi layar,
  // panel pesanan berjarak bawah = gutter, sama seperti tepi atas/kanan
  const { gutter } = useResponsive();
  const insetBottom = useSafeAreaInsets().bottom;
  const bottomSpace = gutter + insetBottom;
  // ponytail: area gesture Android (tipis & transparan) boleh menimpa jarak panel;
  // tombol navigasi 3-tombol (tebal) tetap dihindari. Ganti ke insetBottom saja bila ada perangkat yang tertutup.
  const panelBottomSpace = insetBottom > 32 ? insetBottom : gutter;

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMenuCatalog();
      setCategories(data.categories);
      setProducts(data.products);
      // Diskon gagal dimuat tidak menghalangi jualan; pesanan jalan tanpa diskon
      setPromotions(await fetchOfflinePromotions().catch(() => []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat menu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  // Jumlah produk per kategori untuk angka di pil
  const counts: Record<string, number> = { all: products.length };
  products.forEach((p) => {
    counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1;
  });

  // Saat mencari, cari di semua kategori
  const query = search.trim().toLowerCase();
  const visible = products.filter((p) =>
    query ? p.name.toLowerCase().includes(query) : categoryId === 'all' || p.categoryId === categoryId
  );

  function handleCancel() {
    Alert.alert('Batalkan pesanan?', 'Semua menu & isian pelanggan akan dihapus.', [
      { text: 'Tidak', style: 'cancel' },
      { text: 'Batalkan', style: 'destructive', onPress: order.reset },
    ]);
  }

  async function submitOrder() {
    if (!sessionId) {
      Alert.alert('Sesi kasir belum siap', 'Tunggu sebentar lalu coba lagi.');
      return;
    }
    setProcessing(true);
    try {
      const result = await createKasirOrder(sessionId, order.draft);
      setReceipt(result); // tampilkan layar "Pembayaran berhasil"
    } catch (err) {
      Alert.alert('Order gagal disimpan', err instanceof Error ? err.message : 'Coba lagi.');
    } finally {
      setProcessing(false);
    }
  }

  function handleProcess() {
    // QRIS fisik: kasir wajib memastikan dana sudah masuk sebelum order disimpan
    if (order.draft.paymentMethod === 'qris') {
      Alert.alert('Pembayaran QRIS sudah masuk?', 'Cek notifikasi dana masuk sebelum melanjutkan.', [
        { text: 'Belum', style: 'cancel' },
        { text: 'Sudah, proses', onPress: submitOrder },
      ]);
      return;
    }
    submitOrder();
  }

  function handleNewOrder() {
    setReceipt(null);
    setPaying(false);
    order.reset();
  }

  if (paying) {
    return (
      <View style={[styles.payment, { paddingBottom: bottomSpace }]}>
        <PaymentScreen
          order={order}
          onBack={() => setPaying(false)}
          onProcess={handleProcess}
          processing={processing}
        />
        <OrderSuccessModal receipt={receipt} onNewOrder={handleNewOrder} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.catalog}>
        <MenuTopBar search={search} onSearchChange={setSearch} leading={sidebarToggle} />

        {!query ? (
          <CategoryPills
            categories={categories}
            counts={counts}
            selectedId={categoryId}
            onSelect={setCategoryId}
          />
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : error ? (
          <View style={styles.message}>
            <Text style={styles.messageText}>{error}</Text>
            <PrimaryButton title="Coba lagi" onPress={loadCatalog} />
          </View>
        ) : (
          <View style={styles.gridArea}>
            {/* Kepala Kora samar di belakang grid supaya area kosong tidak terlihat hampa */}
            <View style={styles.watermark} pointerEvents="none">
              <Image
                source={require('../../../assets/images/kora-head.webp')}
                style={styles.watermarkImage}
                resizeMode="contain"
              />
            </View>
            <FlatList
              key={columns} // FlatList wajib dipasang ulang saat jumlah kolom berubah
              data={visible}
              extraData={order.draft.items} // render ulang jumlah di kartu saat isi pesanan berubah
              keyExtractor={(item) => item.id}
              numColumns={columns}
              columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
              contentContainerStyle={[styles.grid, { paddingBottom: bottomSpace }]}
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {query ? `Tidak ada menu "${search}".` : 'Belum ada menu di kategori ini.'}
                </Text>
              }
              renderItem={({ item }) => (
                <View style={{ width: cardWidth }}>
                  <ProductCard
                    product={item}
                    quantity={order.draft.items.find((i) => i.product.id === item.id)?.quantity ?? 0}
                    // Di tab per kategori, badge kategori sudah terwakili oleh tab terpilih
                    showCategory={!!query || categoryId === 'all'}
                    onAdd={order.addItem}
                  />
                </View>
              )}
            />
          </View>
        )}
      </View>

      <View style={{ paddingBottom: panelBottomSpace }}>
        <OrderPanel order={order} onCancel={handleCancel} onCheckout={() => setPaying(true)} />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  payment: {
    flex: 1,
  },
  catalog: {
    flex: 1,
    gap: 12,
  },
  loading: {
    marginTop: 60,
  },
  message: {
    marginTop: 40,
    alignItems: 'center',
    gap: 12,
  },
  messageText: {
    fontSize: 14,
    color: colors.danger,
  },
  gridArea: {
    flex: 1,
  },
  watermark: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkImage: {
    width: 260,
    height: 160,
    opacity: 0.06,
  },
  grid: {
    gap: GRID_GAP,
    paddingRight: SCROLLBAR_GAP,
  },
  gridRow: {
    gap: GRID_GAP,
  },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSubtle,
  },
});
