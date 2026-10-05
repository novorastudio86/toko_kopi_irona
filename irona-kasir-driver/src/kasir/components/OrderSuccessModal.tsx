import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Plus, Printer } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { usePrintReceipt } from '@/kasir/hooks/usePrintReceipt';
import type { OrderReceipt } from '@/kasir/types/order';
import { formatRupiah } from '@/utils/formatCurrency';
import ReceiptPreview from './ReceiptPreview';

interface OrderSuccessModalProps {
  receipt: OrderReceipt | null;
  onNewOrder: () => void;
}

/** Muncul setelah order tersimpan: No. Antrean, kembalian, poin + preview struk di kanan */
export default function OrderSuccessModal({ receipt, onNewOrder }: OrderSuccessModalProps) {
  const printer = usePrintReceipt();

  function handleNewOrder() {
    printer.clearMessage();
    onNewOrder();
  }

  return (
    <Modal visible={receipt !== null} transparent animationType="fade" onRequestClose={handleNewOrder}>
      <View style={styles.backdrop}>
        {receipt ? (
          <View style={styles.card}>
            <View style={styles.summary}>
              <CheckCircle2 size={48} color={colors.success} />
              <Text style={styles.title}>Pembayaran berhasil</Text>
              <Text style={styles.meta}>
                {receipt.transactionNumber} · {receipt.customerName} ·{' '}
                {receipt.orderType === 'dine_in' ? 'Dine In' : 'Take Away'} ·{' '}
                {receipt.paymentMethod === 'tunai' ? 'Tunai' : 'QRIS'}
              </Text>

              <View style={styles.queueBox}>
                <Text style={styles.queueLabel}>No. Antrean</Text>
                <Text style={styles.queueNumber}>
                  #{String(receipt.queueNumber).padStart(2, '0')}
                </Text>
              </View>

              <View style={styles.lines}>
                <View style={styles.line}>
                  <Text style={styles.label}>Total tagihan</Text>
                  <Text style={styles.value}>{formatRupiah(receipt.total)}</Text>
                </View>
                {receipt.cashReceived !== null ? (
                  <View style={styles.line}>
                    <Text style={styles.label}>Uang diterima</Text>
                    <Text style={styles.value}>{formatRupiah(receipt.cashReceived)}</Text>
                  </View>
                ) : null}
                {receipt.change !== null ? (
                  <View style={[styles.line, styles.changeLine]}>
                    <Text style={styles.changeLabel}>Kembalian</Text>
                    <Text style={styles.changeValue}>{formatRupiah(receipt.change)}</Text>
                  </View>
                ) : null}
                {receipt.isMember ? (
                  <Text style={styles.points}>
                    +{receipt.pointsEarned} poin · saldo {receipt.pointsBalance ?? '-'} poin
                  </Text>
                ) : null}
              </View>

              {printer.message ? (
                <Text
                  style={printer.message.type === 'error' ? styles.printError : styles.printSuccess}
                >
                  {printer.message.text}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  onPress={() => printer.print(receipt)}
                  disabled={printer.printing}
                  style={({ pressed }) => [
                    styles.secondary,
                    pressed && styles.secondaryPressed,
                    printer.printing && styles.disabled,
                  ]}
                >
                  {printer.printing ? (
                    <ActivityIndicator color={colors.textSecondary} />
                  ) : (
                    <>
                      <Printer size={16} color={colors.textSecondary} />
                      <Text style={styles.secondaryText}>Cetak Struk</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleNewOrder}
                  style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
                >
                  <Plus size={18} color={colors.textOnDark} />
                  <Text style={styles.primaryText}>Pesanan Baru</Text>
                </Pressable>
              </View>
            </View>

            {/* Kanan: preview struk sesuai Custom Struk di Web Admin */}
            <View style={styles.previewColumn}>
              <Text style={styles.previewTitle}>Preview Struk</Text>
              <ReceiptPreview receipt={receipt} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  card: {
    flexDirection: 'row',
    width: 860,
    maxWidth: '95%',
    height: 600,
    maxHeight: '92%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  summary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 28,
  },
  previewColumn: {
    width: 390,
    padding: 16,
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  previewTitle: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
  },
  queueBox: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 36,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  queueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSubtle,
  },
  queueNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.textOnDark,
    fontVariant: ['tabular-nums'],
  },
  lines: {
    alignSelf: 'stretch',
    gap: 6,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  changeLine: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.successBg,
  },
  changeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
  },
  changeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.success,
  },
  points: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignSelf: 'stretch',
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  printSuccess: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  printError: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  primary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryHover,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  disabled: {
    opacity: 0.5,
  },
});