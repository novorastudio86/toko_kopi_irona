import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Info, MapPin, MessageCircle, Send, ShoppingBag, X } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { advanceDelivery, markArrived } from '@/driver/services/deliveries';
import type { DeliveryTask } from '@/driver/types/delivery';
import { DELIVERY_STATUS, estimateMinutes } from '@/driver/utils/deliveryFormat';
import { whatsAppUrl } from '@/utils/contactLinks';
import { formatRupiah } from '@/utils/formatCurrency';
import DeliveryStepper from './DeliveryStepper';
import OrderNumberBadge from './OrderNumberBadge';
import RouteCard from './RouteCard';

interface DeliveryDetailSheetProps {
  /** null = pop-up tertutup */
  task: DeliveryTask | null;
  driverId: string;
  onClose: () => void;
  /** Dipanggil setelah status berubah (muat ulang daftar) */
  onChanged: () => void;
}

const ACCENT = '#d97706';

/** "Kukuh Putra" → "KP" */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** Tahap stepper: 0 Terima, 1 Menuju Lokasi, 2 Tiba, 3 Selesai */
function currentStep(t: DeliveryTask): number {
  if (t.status === 'dibuat') return 0;
  if (t.status === 'siap_diantar') return 1;
  if (t.status === 'diantar') return t.arrivedAt ? 3 : 2;
  return 4;
}

/** Pop-up dari bawah (Figma "Detail Pengantaran"): rute, pelanggan, item, tahap + tombol aksi */
export default function DeliveryDetailSheet({ task, driverId, onClose, onChanged }: DeliveryDetailSheetProps) {
  return (
    <Modal visible={task !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityLabel="Tutup detail" />
        {task ? <SheetContent task={task} driverId={driverId} onClose={onClose} onChanged={onChanged} /> : null}
      </View>
    </Modal>
  );
}

function SheetContent({
  task: t,
  driverId,
  onClose,
  onChanged,
}: DeliveryDetailSheetProps & { task: DeliveryTask }) {
  const [busy, setBusy] = useState(false);
  const step = currentStep(t);
  const status = DELIVERY_STATUS[t.status];
  const eta = t.distanceKm !== null ? estimateMinutes(t.distanceKm) : null;

  async function run(action: () => Promise<void>, doneMessage?: string) {
    setBusy(true);
    try {
      await action();
      onChanged();
      if (doneMessage) {
        Alert.alert('Antaran selesai', doneMessage);
        onClose();
      }
    } catch (err) {
      Alert.alert('Gagal', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelivered() {
    Alert.alert('Pesanan sudah diterima?', `Pastikan pesanan sudah diserahkan ke ${t.customerName}.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Sudah Diterima',
        onPress: () =>
          run(
            () => advanceDelivery(t.transactionId, driverId, 'selesai'),
            `Pesanan ${t.transactionNumber} sudah diterima pelanggan.`
          ),
      },
    ]);
  }

  // Tombol besar di bawah berganti sesuai tahap
  const action =
    step === 1
      ? {
          label: 'Mulai Antar • Menuju Customer',
          onPress: () => run(() => advanceDelivery(t.transactionId, driverId, 'diantar')),
        }
      : step === 2
        ? { label: 'Sudah Sampai di Lokasi', onPress: () => run(() => markArrived(t.transactionId, driverId)) }
        : step === 3
          ? { label: 'Pesanan Diterima Customer', onPress: confirmDelivered }
          : null;

  const itemCount = t.items.length;

  return (
    <SafeAreaView edges={['bottom']} style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.badges}>
            <OrderNumberBadge number={t.transactionNumber} />
            <View style={[styles.statusPill, { backgroundColor: `${status.color}1a`, borderColor: `${status.color}55` }]}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.close} accessibilityLabel="Tutup">
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Detail Pengantaran</Text>
          <Text style={styles.orderedAt}>
            Order Masuk:{' '}
            {new Date(t.orderedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <RouteCard address={t.address} distanceKm={t.distanceKm} destination={t.destination} />

        {/* Pelanggan & alamat */}
        <View style={styles.card}>
          <View style={styles.customerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(t.customerName)}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.customerName} numberOfLines={1}>
                {t.customerName}
              </Text>
              <Text style={styles.phone}>{t.customerPhone || '-'}</Text>
            </View>
            {t.customerPhone ? (
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    whatsAppUrl(
                      t.customerPhone,
                      `Halo ${t.customerName}, saya driver Irona Kopi untuk pesanan ${t.transactionNumber}.`
                    )
                  )
                }
                style={({ pressed }) => [styles.waButton, pressed && styles.pressed]}
              >
                <MessageCircle size={16} color={colors.textOnDark} />
                <Text style={styles.waText}>Chat WA</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.addressRow}>
            <MapPin size={18} color={ACCENT} />
            <View style={styles.flex}>
              <Text style={styles.addressLabel}>Alamat Pengiriman:</Text>
              <Text style={styles.address}>{t.address}</Text>
            </View>
          </View>
          {t.addressNote ? (
            <View style={styles.noteBox}>
              <Info size={14} color={colors.warning} />
              <Text style={styles.noteText}>Catatan: {t.addressNote}</Text>
            </View>
          ) : null}
        </View>

        {/* Item pesanan */}
        <View style={styles.card}>
          <View style={styles.itemsHeader}>
            <View style={styles.itemsTitleRow}>
              <ShoppingBag size={16} color={ACCENT} />
              <Text style={styles.itemsTitle}>Item Pesanan ({itemCount} menu)</Text>
            </View>
            <View style={styles.paidChip}>
              <Text style={styles.paidText}>Sudah Dibayar (QRIS)</Text>
            </View>
          </View>

          {t.items.map((item, idx) => (
            <View key={idx} style={[styles.itemRow, idx > 0 && styles.itemBorder]}>
              <View style={styles.qtyBox}>
                <Text style={styles.qtyText}>{item.quantity}x</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.notes ? <Text style={styles.itemNote}>{item.notes}</Text> : null}
                <Text style={styles.unitPrice}>@ {formatRupiah(item.unitPrice)}</Text>
              </View>
              <Text style={styles.lineTotal}>{formatRupiah(item.lineTotal)}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total dibayar (termasuk ongkir)</Text>
            <Text style={styles.totalValue}>{formatRupiah(t.grandTotal)}</Text>
          </View>
          <Text style={styles.noCollect}>Tidak perlu menagih uang ke pelanggan.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <DeliveryStepper current={step} />

        {action ? (
          <Pressable
            onPress={action.onPress}
            disabled={busy}
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed, busy && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color={colors.textOnDark} />
            ) : (
              <>
                <Send size={18} color={colors.textOnDark} />
                <Text style={styles.actionText}>{action.label}</Text>
                {step === 1 && eta !== null ? (
                  <View style={styles.etaChip}>
                    <Text style={styles.etaText}>{eta} mnt</Text>
                    <ChevronRight size={16} color={colors.textOnDark} />
                  </View>
                ) : (
                  <ChevronRight size={18} color={colors.textOnDark} />
                )}
              </>
            )}
          </Pressable>
        ) : (
          <Text style={styles.waiting}>Pesanan masih dibuat. Tunggu sampai kasir menandai siap diantar.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdropTap: {
    flex: 1,
    minHeight: 40,
  },
  sheet: {
    maxHeight: '94%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    marginTop: 10,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  header: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  orderedAt: {
    fontSize: 12,
    color: colors.textMuted,
  },
  body: {
    gap: 12,
    padding: 16,
  },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textOnDark,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  phone: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.textMuted,
  },
  waButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#16a34a',
  },
  waText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  pressed: {
    opacity: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  address: {
    marginTop: 2,
    fontSize: 14,
    color: colors.textSecondary,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginLeft: 28,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: colors.warningBg,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemsTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: colors.text,
  },
  paidChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: colors.successBg,
  },
  paidText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 4,
  },
  itemBorder: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  qtyBox: {
    minWidth: 32,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  itemNote: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  unitPrice: {
    marginTop: 2,
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textSubtle,
  },
  lineTotal: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  totalValue: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  noCollect: {
    fontSize: 12,
    color: colors.success,
  },
  footer: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  actionPressed: {
    backgroundColor: colors.primaryHover,
  },
  actionText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  etaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  etaText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  disabled: {
    opacity: 0.5,
  },
  waiting: {
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textMuted,
  },
});
