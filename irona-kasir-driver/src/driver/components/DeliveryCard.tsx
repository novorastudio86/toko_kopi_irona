import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, Route } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { DeliveryTask } from '@/driver/types/delivery';
import { estimateMinutes, summarizeItems } from '@/driver/utils/deliveryFormat';
import OrderNumberBadge from './OrderNumberBadge';
import StatusDot from './StatusDot';

interface DeliveryCardProps {
  task: DeliveryTask;
  onPressDetail: () => void;
}

/** Kartu antaran (Figma "Article - CARD"): pelanggan, menu, alamat, jarak, status, Detail */
export default function DeliveryCard({ task: t, onPressDetail }: DeliveryCardProps) {
  return (
    <Pressable onPress={onPressDetail} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>
            {t.customerName}
          </Text>
          <Text style={styles.items} numberOfLines={1}>
            {summarizeItems(t.items)}
          </Text>
        </View>
        <OrderNumberBadge number={t.transactionNumber} />
      </View>

      <View style={styles.location}>
        <View style={styles.row}>
          <MapPin size={16} color="#d97706" />
          <Text style={styles.address} numberOfLines={2}>
            {t.address}
          </Text>
        </View>
        {t.distanceKm !== null ? (
          <View style={[styles.row, styles.indent]}>
            <Route size={12} color={colors.textMuted} />
            <Text style={styles.meta}>{t.distanceKm.toLocaleString('id-ID')} km</Text>
            <Text style={styles.meta}>•</Text>
            <Text style={styles.metaStrong}>Est. ±{estimateMinutes(t.distanceKm)} mnt</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <StatusDot status={t.status} />
        <Pressable onPress={onPressDetail} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Detail</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  items: {
    fontSize: 13,
    color: colors.textMuted,
  },
  location: {
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indent: {
    gap: 6,
    paddingLeft: 24,
  },
  address: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metaStrong: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  buttonPressed: {
    backgroundColor: colors.primaryHover,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textOnDark,
  },
});
