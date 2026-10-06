import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bike, Check, X } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { fetchAvailableDrivers } from '@/kasir/services/online';
import type { AvailableDriver } from '@/kasir/types/online';

interface DriverPickerModalProps {
  visible: boolean;
  currentDriverId: string | null;
  onClose: () => void;
  onPick: (driver: AvailableDriver) => void;
}

/** Pilih driver yang sedang bertugas (sudah absen masuk & belum pulang) */
export default function DriverPickerModal({
  visible,
  currentDriverId,
  onClose,
  onPick,
}: DriverPickerModalProps) {
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Muat ulang tiap kali modal dibuka (driver bisa baru absen / pulang)
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    fetchAvailableDrivers()
      .then(setDrivers)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Pilih Driver</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Hanya driver yang sudah absen masuk hari ini.</Text>

          {loading ? <ActivityIndicator style={styles.loading} color={colors.primary} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !error && drivers.length === 0 ? (
            <Text style={styles.empty}>
              Belum ada driver yang bertugas. Minta driver scan QR absensi dulu.
            </Text>
          ) : null}

          <ScrollView contentContainerStyle={styles.list}>
            {drivers.map((d) => {
              const current = d.employeeId === currentDriverId;
              return (
                <Pressable
                  key={d.employeeId}
                  onPress={() => onPick(d)}
                  disabled={current}
                  style={({ pressed }) => [styles.driver, current && styles.driverCurrent, pressed && styles.pressed]}
                >
                  <View style={styles.icon}>
                    <Bike size={20} color={colors.textSecondary} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{d.fullName}</Text>
                    <Text style={styles.meta}>
                      Masuk{' '}
                      {new Date(d.checkedInAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {d.activeDeliveries > 0 ? `${d.activeDeliveries} pesanan dipegang` : 'Kosong'}
                    </Text>
                  </View>
                  {current ? <Check size={20} color={colors.success} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  card: {
    width: 440,
    maxHeight: '80%',
    gap: 8,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  loading: {
    marginVertical: 20,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  empty: {
    marginVertical: 20,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSubtle,
  },
  list: {
    gap: 8,
    paddingTop: 4,
  },
  driver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverCurrent: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
