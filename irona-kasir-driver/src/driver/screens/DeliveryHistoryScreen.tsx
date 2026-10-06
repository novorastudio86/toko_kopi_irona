import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import OrderNumberBadge from '@/driver/components/OrderNumberBadge';
import { fetchDeliveryHistory } from '@/driver/services/deliveries';
import type { DeliveryTask } from '@/driver/types/delivery';

interface DeliveryHistoryScreenProps {
  driverId: string;
}

type Range = 'hari' | 'bulan';

/** Awal hari / awal bulan ini dalam WIB */
function rangeStart(range: Range): Date {
  const wib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const day = range === 'hari' ? wib : `${wib.slice(0, 8)}01`;
  return new Date(`${day}T00:00:00+07:00`);
}

const formatTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

/** Tab Histori: pesanan yang sudah selesai diantar (tanpa nominal bonus) */
export default function DeliveryHistoryScreen({ driverId }: DeliveryHistoryScreenProps) {
  const [range, setRange] = useState<Range>('hari');
  const [items, setItems] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchDeliveryHistory(driverId, rangeStart(range)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat histori.');
    } finally {
      setLoading(false);
    }
  }, [driverId, range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FlatList
      data={items}
      keyExtractor={(t) => t.transactionId}
      contentContainerStyle={styles.list}
      refreshing={loading}
      onRefresh={load}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.segment}>
            {(['hari', 'bulan'] as const).map((r) => (
              <Pressable key={r} onPress={() => setRange(r)} style={[styles.segmentItem, range === r && styles.segmentActive]}>
                <Text style={[styles.segmentText, range === r && styles.segmentTextActive]}>
                  {r === 'hari' ? 'Hari Ini' : 'Bulan Ini'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.summary}>
            {items.length} antaran selesai {range === 'hari' ? 'hari ini' : 'bulan ini'}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={loading ? null : <Text style={styles.empty}>Belum ada antaran selesai.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.name} numberOfLines={1}>
              {item.customerName}
            </Text>
            <OrderNumberBadge number={item.transactionNumber} />
          </View>
          <View style={styles.row}>
            <MapPin size={14} color={colors.textMuted} />
            <Text style={styles.address} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
          <Text style={styles.meta}>
            {range === 'bulan'
              ? new Date(item.orderedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' · '
              : ''}
            Berangkat {formatTime(item.pickedUpAt)} · Selesai {formatTime(item.completedAt)}
            {item.distanceKm !== null ? ` · ${item.distanceKm.toLocaleString('id-ID')} km` : ''}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    gap: 10,
    marginBottom: 2,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.text,
  },
  summary: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  empty: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSubtle,
  },
  card: {
    gap: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  address: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
