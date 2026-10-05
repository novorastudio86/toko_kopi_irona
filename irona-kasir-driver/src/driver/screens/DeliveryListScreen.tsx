import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Bike } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import DeliveryCard from '@/driver/components/DeliveryCard';
import type { DriverTasksApi } from '@/driver/hooks/useDriverTasks';
import type { DeliveryStatus } from '@/driver/types/delivery';

interface DeliveryListScreenProps {
  driver: DriverTasksApi;
  onOpenTask: (transactionId: string) => void;
}

// Yang sedang diantar di atas, lalu yang siap diambil, lalu yang masih dibuat
const ORDER: Partial<Record<DeliveryStatus, number>> = { diantar: 0, siap_diantar: 1, dibuat: 2 };

/** Tab Antaran: daftar pesanan yang ditugaskan ke driver */
export default function DeliveryListScreen({ driver, onOpenTask }: DeliveryListScreenProps) {
  const { tasks, duty, loading, error, reload } = driver;
  const sorted = [...tasks].sort(
    (a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || a.orderedAt.localeCompare(b.orderedAt)
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={(t) => t.transactionId}
      contentContainerStyle={styles.list}
      refreshing={loading}
      onRefresh={reload}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={
        loading ? null : (
          <View style={styles.empty}>
            <Bike size={40} color={colors.borderStrong} />
            <Text style={styles.emptyTitle}>Belum ada antaran</Text>
            <Text style={styles.emptyText}>
              {duty?.onDuty
                ? 'Pesanan yang ditugaskan kasir akan muncul di sini.'
                : 'Scan QR absensi di tablet kasir dulu supaya bisa menerima antaran.'}
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => <DeliveryCard task={item} onPressDetail={() => onOpenTask(item.transactionId)} />}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    gap: 12,
    padding: 20,
    paddingBottom: 40,
  },
  error: {
    marginBottom: 4,
    fontSize: 13,
    color: colors.danger,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.textMuted,
  },
});
