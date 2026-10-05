import { StyleSheet, Text, View } from 'react-native';
import type { DeliveryStatus } from '@/driver/types/delivery';
import { DELIVERY_STATUS } from '@/driver/utils/deliveryFormat';

/** Titik warna + label status (Figma: "● Siap Diantar") */
export default function StatusDot({ status }: { status: DeliveryStatus }) {
  const s = DELIVERY_STATUS[status];
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: s.color }]} />
      <Text style={[styles.label, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
