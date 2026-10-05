import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import CategoryPills from '@/kasir/components/CategoryPills';
import MenuTopBar from '@/kasir/components/MenuTopBar';
import OrderPanel from '@/kasir/components/OrderPanel';
import OrderSuccessModal from '@/kasir/components/OrderSuccessModal';
import ProductCard from '@/kasir/components/ProductCard';
import { useOrderDraft } from '@/kasir/hooks/useOrderDraft';
import { fetchMenuCatalog } from '@/kasir/services/catalog';
import { createKasirOrder } from '@/kasir/services/orders';
import type { MenuCategory, MenuProduct } from '@/kasir/types/catalog';
import type { OrderReceipt } from '@/kasir/types/order';

const GRID_COLUMNS = 3;
const GRID_GAP = 14;

interface MenuScreenProps {
  /** Sesi kasir yang sedang berjalan (null = masih dibuka) */
  sessionId: string | null;
}

/** Menu kasir: cari & filter menu di kiri, pesanan aktif di kanan */
export default function MenuScreen({ sessionId }: MenuScreenProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const order = useOrderDraft();
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  // Lebar area grid diukur saat tampil, lalu dibagi rata untuk 3 kolom
  const [gridWidth, setGridWidth] = useState(0);
  const cardWidth = (gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMenuCatalog();
      setCategories(data.categories);
      setProducts(data.products);
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
    order.reset();
  }

  return (
    <View style={styles.container}>
      <View style={styles.catalog}>
        <MenuTopBar search={search} onSearchChange={setSearch} />

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
          <FlatList
            data={visible}
            keyExtractor={(item) => item.id}
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {query ? `Tidak ada menu "${search}".` : 'Belum ada menu di kategori ini.'}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={{ width: cardWidth }}>
                <ProductCard product={item} onAdd={order.addItem} />
              </View>
            )}
          />
        )}
      </View>

      <OrderPanel
        order={order}
        onCancel={handleCancel}
        onProcess={handleProcess}
        processing={processing}
      />

      <OrderSuccessModal receipt={receipt} onNewOrder={handleNewOrder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  catalog: {
    flex: 1,
    gap: 16,
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
  grid: {
    gap: GRID_GAP,
    paddingBottom: 24,
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