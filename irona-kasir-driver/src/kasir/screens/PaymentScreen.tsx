import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Printer } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import OrderSummary from '@/kasir/components/OrderSummary';
import PaymentSection from '@/kasir/components/PaymentSection';
import SectionCard from '@/kasir/components/SectionCard';
import type { OrderDraftApi } from '@/kasir/hooks/useOrderDraft';
import { formatRupiah } from '@/utils/formatCurrency';

interface PaymentScreenProps {
  order: OrderDraftApi;
  /** Kembali ke Menu (isi pesanan tetap tersimpan) */
  onBack: () => void;
  onProcess: () => void;
  /** Sedang menyimpan order ke server */
  processing: boolean;
}

/** Halaman Pembayaran: ringkasan pesanan di kiri, metode bayar + rincian tagihan di kanan */
export default function PaymentScreen({ order, onBack, onProcess, processing }: PaymentScreenProps) {
  const { draft } = order;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          disabled={processing}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          accessibilityLabel="Kembali ke menu"
        >
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Pembayaran</Text>
      </View>

      <View style={styles.columns}>
        {/* Kiri: ringkasan pesanan (hanya baca; ubah lewat tombol kembali) */}
        <ScrollView style={styles.column} contentContainerStyle={styles.columnContent}>
          <SectionCard
            title="Ringkasan Pesanan"
            right={
              <Text style={styles.meta}>
                {draft.orderType === 'take_away' ? 'Take Away' : 'Dine In'}
                {draft.customerName ? ` · ${draft.customerName}` : ''}
              </Text>
            }
          >
            {draft.items.map((item) => (
              <View key={item.product.id} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>
                    {item.quantity}× {item.product.name}
                  </Text>
                  {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
                </View>
                <Text style={styles.itemTotal}>{formatRupiah(item.quantity * item.product.price)}</Text>
              </View>
            ))}
          </SectionCard>
        </ScrollView>

        {/* Kanan: metode bayar, rincian tagihan, tombol proses */}
        <View style={styles.column}>
          <ScrollView contentContainerStyle={styles.columnContent} keyboardShouldPersistTaps="handled">
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  columnContent: {
    gap: 12,
    paddingBottom: 12,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemNotes: {
    fontSize: 12,
    color: colors.textMuted,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  process: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  processPressed: {
    backgroundColor: colors.primaryHover,
  },
  processText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  disabled: {
    opacity: 0.45,
  },
});
