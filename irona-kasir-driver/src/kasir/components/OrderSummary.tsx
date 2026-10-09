import { StyleSheet, Text, View } from 'react-native';
import { Coins } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { PaymentMethod } from '@/kasir/types/order';
import { formatRupiah } from '@/utils/formatCurrency';

interface OrderSummaryProps {
  totalQuantity: number;
  subtotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived: number;
  change: number;
}

/** Rincian tagihan: subtotal, uang diterima, total, kembalian (tanpa pajak) */
export default function OrderSummary({
  totalQuantity,
  subtotal,
  total,
  paymentMethod,
  cashReceived,
  change,
}: OrderSummaryProps) {
  const isCash = paymentMethod === 'tunai';

  return (
    <View style={styles.card}>
      <View style={styles.line}>
        <Text style={styles.label}>Subtotal ({totalQuantity} item)</Text>
        <Text style={styles.value}>{formatRupiah(subtotal)}</Text>
      </View>
      {subtotal > total ? (
        <View style={styles.line}>
          <Text style={styles.label}>Diskon</Text>
          <Text style={styles.value}>-{formatRupiah(subtotal - total)}</Text>
        </View>
      ) : null}
      {isCash ? (
        <View style={styles.line}>
          <Text style={styles.label}>Uang diterima (tunai)</Text>
          <Text style={styles.value}>{formatRupiah(cashReceived)}</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.line}>
        <Text style={styles.totalLabel}>TOTAL TAGIHAN</Text>
        <Text style={styles.totalValue}>{formatRupiah(total)}</Text>
      </View>

      {isCash && cashReceived > 0 ? (
        <View style={[styles.changeBox, change < 0 && styles.changeBoxShort]}>
          <Coins size={16} color={change < 0 ? colors.danger : colors.success} />
          <Text style={styles.changeLabel}>{change < 0 ? 'Uang kurang' : 'Kembalian'}</Text>
          <Text style={[styles.changeValue, change < 0 && styles.changeShort]}>
            {formatRupiah(Math.abs(change))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    marginVertical: 4,
    backgroundColor: colors.border,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.text,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  changeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.successBg,
  },
  changeBoxShort: {
    backgroundColor: colors.dangerBg,
  },
  changeLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  changeValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  changeShort: {
    color: colors.danger,
  },
});