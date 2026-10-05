import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Printer } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { HistoryTransaction } from '@/kasir/types/history';
import { formatRupiah } from '@/utils/formatCurrency';

interface HistoryRowProps {
  transaction: HistoryTransaction;
  selected: boolean;
  onPress: () => void;
}

const STATUS_LABELS: Record<HistoryTransaction['status'], string | null> = {
  selesai: null,
  refund_sebagian: 'Refund sebagian',
  refund_penuh: 'Direfund',
  dibatalkan: 'Dibatalkan',
};

/** Satu baris di daftar Histori: jam, No. Order, pelanggan, total */
export default function HistoryRow({ transaction: t, selected, onPress }: HistoryRowProps) {
  const time = new Date(t.transactionDate).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const statusLabel = STATUS_LABELS[t.status];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
    >
      <Text style={styles.time}>{time}</Text>

      <View style={styles.queue}>
        <Text style={styles.queueText}>#{String(t.queueNumber).padStart(2, '0')}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.number}>{t.transactionNumber}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {t.customerName}
          {t.isMember ? ' · Member' : ''} · {t.orderType === 'dine_in' ? 'Dine In' : 'Take Away'}{' '}
          · {t.paymentMethod === 'tunai' ? 'Tunai' : 'QRIS'}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.total, statusLabel !== null && styles.totalStruck]}>
          {formatRupiah(t.total)}
        </Text>
        {statusLabel ? (
          <Text style={styles.status}>{statusLabel}</Text>
        ) : t.receiptPrintCount > 0 ? (
          <View style={styles.printed}>
            <Printer size={11} color={colors.textSubtle} />
            <Text style={styles.printedText}>{t.receiptPrintCount}×</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  time: {
    width: 44,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  queue: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  queueText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textOnDark,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  number: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  totalStruck: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  status: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  printed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  printedText: {
    fontSize: 11,
    color: colors.textSubtle,
  },
});
