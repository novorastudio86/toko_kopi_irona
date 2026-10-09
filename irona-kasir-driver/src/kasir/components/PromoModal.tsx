import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { OrderDraftApi } from '@/kasir/hooks/useOrderDraft';
import { promoBlocker } from '@/kasir/utils/promotions';
import { formatRupiah } from '@/utils/formatCurrency';

interface PromoModalProps {
  visible: boolean;
  order: OrderDraftApi;
  onClose: () => void;
}

/**
 * Daftar diskon Offline. Manual: kasir pilih/lepas. Otomatis: terpasang sendiri saat syarat
 * terpenuhi. Yang belum memenuhi syarat (produk, jam, hari, member, minimal) tampil buram.
 */
export default function PromoModal({ visible, order, onClose }: PromoModalProps) {
  const appliedId = order.promotion?.promotion.id ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Pressable kosong menahan tekanan di kartu supaya modal tidak tertutup */}
        <Pressable style={styles.card}>
          <Text style={styles.title}>Promo & Diskon</Text>
          <Text style={styles.subtitle}>1 diskon per transaksi. Diskon otomatis terpasang sendiri.</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {order.promotions.length === 0 ? (
              <Text style={styles.empty}>Belum ada diskon Offline yang aktif.</Text>
            ) : (
              order.promotions.map((p) => {
                const blocker = promoBlocker(p, order.promoContext);
                const manual = p.promoType === 'manual';
                const applied = p.id === appliedId;
                return (
                  <Pressable
                    key={p.id}
                    disabled={!!blocker || !manual}
                    onPress={() => order.setPromotionId(applied ? null : p.id)}
                    style={({ pressed }) => [
                      styles.row,
                      applied && styles.rowApplied,
                      pressed && styles.rowPressed,
                      !!blocker && styles.rowBlocked,
                    ]}
                  >
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {p.discountKind === 'persen' ? `${p.discountValue}%` : formatRupiah(p.discountValue)}
                        {' · '}
                        {p.appliesToAllProducts ? 'Semua produk' : `${p.productIds.length} produk`}
                        {blocker ? ` · ${blocker}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.badge, !manual && styles.badgeAuto]}>
                      <Text style={styles.badgeText}>{manual ? 'Manual' : 'Otomatis'}</Text>
                    </View>
                    <View style={[styles.check, applied && styles.checkOn]}>
                      {applied ? <Check size={14} color={colors.textOnDark} /> : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.rowPressed]}>
            <Text style={styles.closeText}>Tutup</Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
    width: 480,
    maxWidth: '100%',
    maxHeight: '90%',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
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
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 8,
  },
  empty: {
    paddingVertical: 20,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowApplied: {
    borderColor: colors.primary,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  // Belum memenuhi syarat: tetap tampil, tapi buram & tidak bisa dipilih
  rowBlocked: {
    opacity: 0.4,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  badgeAuto: {
    backgroundColor: colors.successBg,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  checkOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  close: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
