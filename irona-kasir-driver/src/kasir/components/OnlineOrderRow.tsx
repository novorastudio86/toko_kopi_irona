import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bike, MapPin } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { OnlineOrder } from '@/kasir/types/online';
import { formatRupiah } from '@/utils/formatCurrency';
import OnlineStatusBadge from './OnlineStatusBadge';

interface OnlineOrderRowProps {
  order: OnlineOrder;
  selected: boolean;
  onPress: () => void;
}

/** "5 mnt lalu" / "1 jam 20 mnt lalu" */
function elapsed(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  return `${hours} jam ${minutes % 60} mnt lalu`;
}

/** Satu kartu di daftar pesanan online */
export default function OnlineOrderRow({ order: o, selected, onPress }: OnlineOrderRowProps) {
  const itemCount = o.items.reduce((sum, i) => sum + i.quantity, 0);
  const time = new Date(o.transactionDate).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const isNew = o.onlineStatus === 'masuk';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isNew && styles.rowNew,
        selected && styles.rowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.top}>
        <Text style={styles.number}>{o.transactionNumber}</Text>
        <OnlineStatusBadge status={o.onlineStatus} />
      </View>

      <Text style={styles.customer} numberOfLines={1}>
        {o.customerName}
        {o.isMember ? ' · Member' : ' · Tamu'}
      </Text>

      <View style={styles.metaRow}>
        <MapPin size={12} color={colors.textSubtle} />
        <Text style={styles.meta} numberOfLines={1}>
          {o.address}
          {o.distanceKm !== null ? ` · ${o.distanceKm.toLocaleString('id-ID')} km` : ''}
        </Text>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.meta}>
          {time} · {elapsed(o.transactionDate)} · {itemCount} item
        </Text>
        <Text style={styles.total}>{formatRupiah(o.grandTotal)}</Text>
      </View>

      {o.driverName && o.onlineStatus !== 'selesai' ? (
        <View style={styles.metaRow}>
          <Bike size={12} color={colors.info} />
          <Text style={styles.driver}>{o.driverName}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowNew: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  number: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  customer: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  driver: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.info,
  },
});
