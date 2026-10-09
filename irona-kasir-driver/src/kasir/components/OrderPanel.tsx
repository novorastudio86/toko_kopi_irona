import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Printer, ShoppingBag, Trash2, X } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useResponsive } from '@/hooks/useResponsive';
import type { OrderDraftApi } from '@/kasir/hooks/useOrderDraft';
import { formatRupiah } from '@/utils/formatCurrency';
import CustomerSection from './CustomerSection';
import OrderItemRow from './OrderItemRow';
import OrderSummary from './OrderSummary';
import OrderTypeToggle from './OrderTypeToggle';
import PaymentSection from './PaymentSection';

interface OrderPanelProps {
  order: OrderDraftApi;
  onCancel: () => void;
  onProcess: () => void;
  /** Sedang menyimpan order ke server */
  processing: boolean;
}

/**
 * Kolom kanan (susunan sesuai Figma): Pesanan Aktif → Pelanggan + Dine In/Take Away →
 * Daftar Menu → Metode Pembayaran → Rincian tagihan → Batal / Proses Order
 */
export default function OrderPanel({ order, onCancel, onProcess, processing }: OrderPanelProps) {
  const { draft } = order;
  const hasItems = draft.items.length > 0;
  const { sidePanelWidth } = useResponsive();

  return (
    <View style={[styles.panel, { width: sidePanelWidth }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Pesanan Aktif</Text>
          <Text style={styles.subtitle}>No. order & antrean dibuat saat diproses</Text>
        </View>
        {hasItems ? (
          <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel="Kosongkan pesanan">
            <Trash2 size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <CustomerSection
          member={draft.member}
          customerName={draft.customerName}
          onMemberChange={order.setMember}
          onNameChange={order.setCustomerName}
        />
        <OrderTypeToggle value={draft.orderType} onChange={order.setOrderType} />

        {/* Daftar Menu */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Daftar Menu</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{order.totalQuantity} item</Text>
          </View>
        </View>
        {hasItems ? (
          draft.items.map((item) => (
            <OrderItemRow
              key={item.product.id}
              item={item}
              onChangeQuantity={(q) => order.setItemQuantity(item.product.id, q)}
              onChangeNotes={(notes) => order.setItemNotes(item.product.id, notes)}
              onRemove={() => order.removeItem(item.product.id)}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <ShoppingBag size={28} color={colors.borderStrong} />
            <Text style={styles.emptyText}>Belum ada menu. Tekan "Tas" pada kartu menu.</Text>
          </View>
        )}

        <PaymentSection
          method={draft.paymentMethod}
          onMethodChange={order.setPaymentMethod}
          total={order.total}
          cashReceived={draft.cashReceived}
          onCashChange={order.setCashReceived}
          isReady={order.isReady}
        />

        <OrderSummary
          totalQuantity={order.totalQuantity}
          subtotal={order.subtotal}
          total={order.total}
          paymentMethod={draft.paymentMethod}
          cashReceived={draft.cashReceived}
          change={order.change}
        />
      </ScrollView>

      {/* Tombol bawah selalu terlihat */}
      <View style={styles.footer}>
        <Pressable
          onPress={onCancel}
          disabled={!hasItems}
          style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed, !hasItems && styles.disabled]}
        >
          <X size={16} color={colors.textSecondary} />
          <Text style={styles.cancelText}>Batal</Text>
        </Pressable>
        <Pressable
          onPress={onProcess}
          disabled={!order.isReady || processing}
          style={({ pressed }) => [
            styles.process,
            pressed && styles.processPressed,
            (!order.isReady || processing) && styles.disabled,
          ]}
        >
          {processing ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <>
              <Printer size={18} color={colors.textOnDark} />
              <Text style={styles.processText} numberOfLines={1} adjustsFontSizeToFit>
                Proses Order ({formatRupiah(order.total)})
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  panel: {
    flex: 1, // isi penuh tinggi pembungkusnya di MenuScreen
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 12,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  listTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  cancelPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  process: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  processPressed: {
    backgroundColor: colors.primaryHover,
  },
  processText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  disabled: {
    opacity: 0.45,
  },
});