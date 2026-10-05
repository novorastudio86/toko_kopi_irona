import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Printer } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { usePrintReceipt } from '@/kasir/hooks/usePrintReceipt';
import type { HistoryTransaction } from '@/kasir/types/history';
import ReceiptPreview from './ReceiptPreview';

interface HistoryDetailPanelProps {
  transaction: HistoryTransaction;
  /** Dipanggil setelah struk berhasil dicetak, supaya jumlah cetak di daftar diperbarui */
  onPrinted: () => void;
}

/** Panel kanan Histori: info transaksi + preview struk + Cetak Ulang */
export default function HistoryDetailPanel({ transaction: t, onPrinted }: HistoryDetailPanelProps) {
  const printer = usePrintReceipt();
  const canPrint = t.status === 'selesai' || t.status === 'refund_sebagian';

  async function handlePrint() {
    if (await printer.print(t)) onPrinted();
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.transactionNumber}</Text>
        <Text style={styles.meta}>
          {new Date(t.transactionDate).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          · Kasir {t.cashierName}
          {t.receiptPrintCount > 0 ? ` · dicetak ${t.receiptPrintCount}×` : ''}
        </Text>
      </View>

      {/* Preview struk sama dengan yang dicetak (mengikuti Custom Struk di Web Admin) */}
      <View style={styles.preview}>
        <ReceiptPreview key={t.transactionId} receipt={t} />
      </View>

      <View style={styles.footer}>
        {printer.message ? (
          <Text style={printer.message.type === 'error' ? styles.error : styles.success}>
            {printer.message.text}
          </Text>
        ) : null}
        {!canPrint ? (
          <Text style={styles.error}>Transaksi ini sudah direfund/dibatalkan, struk tidak dicetak.</Text>
        ) : null}
        <Pressable
          onPress={handlePrint}
          disabled={!canPrint || printer.printing}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            (!canPrint || printer.printing) && styles.disabled,
          ]}
        >
          {printer.printing ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <>
              <Printer size={18} color={colors.textOnDark} />
              <Text style={styles.buttonText}>
                {t.receiptPrintCount > 0 ? 'Cetak Ulang Struk' : 'Cetak Struk'}
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
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  header: {
    gap: 2,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  preview: {
    flex: 1,
    padding: 12,
  },
  footer: {
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  buttonPressed: {
    backgroundColor: colors.primaryHover,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  disabled: {
    opacity: 0.45,
  },
  success: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  error: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
});
