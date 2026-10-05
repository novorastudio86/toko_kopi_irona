import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Bike, Map as MapIcon, MessageCircle, Printer } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { usePrintReceipt } from '@/kasir/hooks/usePrintReceipt';
import { advanceOnlineOrder, assignOnlineDriver } from '@/kasir/services/online';
import type { OnlineEventType, OnlineOrder, OnlineStatus } from '@/kasir/types/online';
import { googleMapsUrl, whatsAppUrl } from '@/utils/contactLinks';
import { formatRupiah } from '@/utils/formatCurrency';
import DriverPickerModal from './DriverPickerModal';
import OnlineStatusBadge from './OnlineStatusBadge';
import OnlineStatusStepper from './OnlineStatusStepper';
import ReceiptPreview from './ReceiptPreview';
import RejectOrderModal from './RejectOrderModal';

interface OnlineOrderDetailPanelProps {
  order: OnlineOrder;
  sessionId: string | null;
  /** Dipanggil setelah status / driver / jumlah cetak berubah */
  onChanged: () => void;
}

const EVENT_LABELS: Record<OnlineEventType, string> = {
  masuk: 'Pesanan masuk',
  dibuat: 'Mulai dibuat',
  siap_diantar: 'Siap diantar',
  driver_ditugaskan: 'Driver ditugaskan',
  diantar: 'Diantar driver',
  selesai: 'Selesai',
  dibatalkan: 'Ditolak',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

/** Panel kanan halaman Online: detail pesanan + tombol untuk memajukan status */
export default function OnlineOrderDetailPanel({
  order: o,
  sessionId,
  onChanged,
}: OnlineOrderDetailPanelProps) {
  const printer = usePrintReceipt();
  const [tab, setTab] = useState<'detail' | 'struk'>('detail');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [pickingDriver, setPickingDriver] = useState(false);

  async function run(action: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      onChanged();
      return true;
    } catch (err) {
      Alert.alert('Gagal', err instanceof Error ? err.message : 'Terjadi kesalahan.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const advance = (to: OnlineStatus, note?: string) =>
    run(() => advanceOnlineOrder(o.transactionId, to, sessionId, note));

  async function handleReject(reason: string) {
    if (await advance('dibatalkan', reason)) setRejecting(false);
  }

  async function handlePickDriver(driverId: string) {
    setPickingDriver(false);
    await run(() => assignOnlineDriver(o.transactionId, driverId, sessionId));
  }

  function confirmFinish() {
    Alert.alert(
      'Tandai pesanan selesai?',
      'Biasanya driver yang menandai selesai dari aplikasinya. Lanjutkan kalau driver sudah konfirmasi pesanan diterima pelanggan.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Tandai Selesai', onPress: () => advance('selesai') },
      ]
    );
  }

  async function handlePrint() {
    if (await printer.print(o)) onChanged();
  }

  const discount = o.subtotal - o.total;
  const rejectReason =
    o.onlineStatus === 'dibatalkan'
      ? ([...o.events].reverse().find((e) => e.status === 'dibatalkan')?.notes ?? null)
      : null;
  const canPickDriver = o.onlineStatus === 'dibuat' || o.onlineStatus === 'siap_diantar';

  // Tombol aksi sesuai tahap pesanan
  let actions: ReactNode = null;
  if (o.onlineStatus === 'masuk') {
    actions = (
      <>
        <ActionButton label="Tolak" variant="danger" onPress={() => setRejecting(true)} disabled={busy} />
        <ActionButton label="Terima & Buat" onPress={() => advance('dibuat')} busy={busy} grow />
      </>
    );
  } else if (o.onlineStatus === 'dibuat') {
    actions = (
      <>
        <ActionButton label="Tolak" variant="danger" onPress={() => setRejecting(true)} disabled={busy} />
        <ActionButton label="Siap Diantar" onPress={() => advance('siap_diantar')} busy={busy} grow />
      </>
    );
  } else if (o.onlineStatus === 'siap_diantar') {
    actions = o.driverId ? (
      <ActionButton label="Driver Berangkat" onPress={() => advance('diantar')} busy={busy} grow />
    ) : (
      <ActionButton label="Pilih Driver" onPress={() => setPickingDriver(true)} busy={busy} grow />
    );
  } else if (o.onlineStatus === 'diantar') {
    actions = <ActionButton label="Tandai Selesai" onPress={confirmFinish} busy={busy} grow />;
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{o.transactionNumber}</Text>
          <OnlineStatusBadge status={o.onlineStatus} />
        </View>
        <Text style={styles.meta}>
          {new Date(o.transactionDate).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          · Lunas QRIS
          {o.receiptPrintCount > 0 ? ` · struk dicetak ${o.receiptPrintCount}×` : ''}
        </Text>
        <View style={styles.tabs}>
          {(['detail', 'struk'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'detail' ? 'Detail' : 'Struk'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'struk' ? (
        <View style={styles.preview}>
          <ReceiptPreview key={o.transactionId} receipt={o} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {o.onlineStatus !== 'dibatalkan' ? (
            <OnlineStatusStepper status={o.onlineStatus} />
          ) : (
            <View style={styles.rejectBox}>
              <Text style={styles.rejectTitle}>Pesanan ditolak</Text>
              {rejectReason ? <Text style={styles.rejectText}>Alasan: {rejectReason}</Text> : null}
              <Text style={styles.rejectText}>Pengembalian dana diproses Owner dari Web Admin.</Text>
            </View>
          )}

          <Section title="Pelanggan">
            <Text style={styles.strong}>
              {o.customerName}
              <Text style={styles.muted}>{o.isMember ? '  · Member' : '  · Tamu'}</Text>
            </Text>
            <Text style={styles.text}>{o.customerPhone || '-'}</Text>
            {o.customerEmail ? <Text style={styles.text}>{o.customerEmail}</Text> : null}
            {o.customerPhone ? (
              <LinkButton
                icon={<MessageCircle size={16} color={colors.success} />}
                label="Chat WhatsApp"
                onPress={() =>
                  Linking.openURL(
                    whatsAppUrl(o.customerPhone, `Halo ${o.customerName}, pesanan ${o.transactionNumber} dari Irona Kopi`)
                  )
                }
              />
            ) : null}
          </Section>

          <Section title="Alamat Antar">
            <Text style={styles.strong}>{o.address}</Text>
            {o.addressNote ? <Text style={styles.text}>Catatan: {o.addressNote}</Text> : null}
            {o.distanceKm !== null ? (
              <Text style={styles.muted}>Jarak {o.distanceKm.toLocaleString('id-ID')} km dari toko</Text>
            ) : null}
            <LinkButton
              icon={<MapIcon size={16} color={colors.info} />}
              label="Buka di Google Maps"
              onPress={() => Linking.openURL(googleMapsUrl(o.address))}
            />
          </Section>

          {o.onlineStatus !== 'masuk' && o.onlineStatus !== 'dibatalkan' ? (
            <Section title="Driver">
              <View style={styles.driverRow}>
                <Bike size={18} color={o.driverName ? colors.info : colors.textSubtle} />
                <Text style={[styles.strong, styles.flex]}>{o.driverName ?? 'Belum dipilih'}</Text>
                {canPickDriver ? (
                  <Pressable onPress={() => setPickingDriver(true)} disabled={busy} hitSlop={8}>
                    <Text style={styles.link}>{o.driverId ? 'Ganti' : 'Pilih Driver'}</Text>
                  </Pressable>
                ) : null}
              </View>
            </Section>
          ) : null}

          <Section title={`Pesanan (${o.items.reduce((s, i) => s + i.quantity, 0)} item)`}>
            {o.items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.qty}>{item.quantity}×</Text>
                <View style={styles.flex}>
                  <Text style={styles.strong}>{item.name}</Text>
                  {item.notes ? <Text style={styles.note}>{item.notes}</Text> : null}
                </View>
                <Text style={styles.text}>{formatRupiah(item.lineTotal)}</Text>
              </View>
            ))}
          </Section>

          <Section title="Rincian Pembayaran">
            <Line label="Subtotal" value={formatRupiah(o.subtotal)} />
            {discount > 0 ? <Line label="Diskon" value={`-${formatRupiah(discount)}`} /> : null}
            <Line label="Ongkir" value={formatRupiah(o.deliveryFee)} />
            <Line label="Biaya Layanan" value={formatRupiah(o.serviceFee)} />
            <View style={styles.divider} />
            <Line label="Total Dibayar" value={formatRupiah(o.grandTotal)} bold />
            {o.pointsEarned > 0 ? <Text style={styles.muted}>+{o.pointsEarned} poin untuk member</Text> : null}
          </Section>

          <Section title="Riwayat">
            {o.events.map((e, idx) => (
              <View key={idx} style={styles.eventRow}>
                <Text style={styles.eventTime}>{formatTime(e.createdAt)}</Text>
                <Text style={[styles.text, styles.flex]}>
                  {EVENT_LABELS[e.status]}
                  {e.notes ? <Text style={styles.muted}> · {e.notes}</Text> : null}
                </Text>
              </View>
            ))}
          </Section>
        </ScrollView>
      )}

      <View style={styles.footer}>
        {printer.message ? (
          <Text style={printer.message.type === 'error' ? styles.error : styles.success}>
            {printer.message.text}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {o.onlineStatus !== 'dibatalkan' ? (
            <Pressable
              onPress={handlePrint}
              disabled={printer.printing}
              accessibilityLabel="Cetak struk"
              style={({ pressed }) => [styles.printButton, pressed && styles.pressed]}
            >
              {printer.printing ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Printer size={20} color={colors.text} />
              )}
            </Pressable>
          ) : null}
          {actions}
        </View>
      </View>

      <RejectOrderModal
        visible={rejecting}
        orderNumber={o.transactionNumber}
        submitting={busy}
        onClose={() => setRejecting(false)}
        onConfirm={handleReject}
      />
      <DriverPickerModal
        visible={pickingDriver}
        currentDriverId={o.driverId}
        onClose={() => setPickingDriver(false)}
        onPick={(d) => handlePickDriver(d.employeeId)}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Line({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={bold ? styles.strong : styles.text}>{label}</Text>
      <Text style={bold ? styles.totalValue : styles.text}>{value}</Text>
    </View>
  );
}

function LinkButton({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.linkButtonText}>{label}</Text>
    </Pressable>
  );
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  grow?: boolean;
}

function ActionButton({ label, onPress, variant = 'primary', busy = false, disabled = false, grow = false }: ActionButtonProps) {
  const danger = variant === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        styles.actionButton,
        danger ? styles.actionDanger : styles.actionPrimary,
        grow && styles.flex,
        pressed && styles.pressed,
        (busy || disabled) && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.textOnDark} />
      ) : (
        <Text style={danger ? styles.actionDangerText : styles.actionPrimaryText}>{label}</Text>
      )}
    </Pressable>
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
    gap: 4,
    paddingHorizontal: 14,
    paddingTop: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  tabs: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  tab: {
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.text,
  },
  preview: {
    flex: 1,
    padding: 12,
  },
  body: {
    gap: 10,
    padding: 12,
  },
  rejectBox: {
    gap: 2,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.dangerBg,
  },
  rejectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  rejectText: {
    fontSize: 13,
    color: colors.danger,
  },
  section: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    marginBottom: 2,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  strong: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  text: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  muted: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
  },
  note: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.warning,
  },
  flex: {
    flex: 1,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.info,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 2,
  },
  qty: {
    width: 28,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  divider: {
    height: 1,
    marginVertical: 4,
    backgroundColor: colors.border,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 10,
  },
  eventTime: {
    width: 42,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  printButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: colors.primary,
  },
  actionDanger: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  actionPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  actionDangerText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },
  pressed: {
    opacity: 0.75,
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
