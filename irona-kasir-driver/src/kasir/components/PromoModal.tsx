import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Clock, Package, ShoppingBag, Store, Tag, X } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { OrderDraftApi } from '@/kasir/hooks/useOrderDraft';
import type { Promotion } from '@/kasir/types/catalog';
import { promoBlocker } from '@/kasir/utils/promotions';
import { formatRupiah } from '@/utils/formatCurrency';

interface PromoModalProps {
  visible: boolean;
  order: OrderDraftApi;
  onClose: () => void;
}

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function minPurchaseText(p: Promotion): string {
  const base =
    p.minPurchaseType === 'qty'
      ? `Min. beli ${p.minPurchaseValue} produk`
      : p.minPurchaseType === 'nominal'
        ? `Min. belanja ${formatRupiah(p.minPurchaseValue)}`
        : 'Tanpa minimal pembelian';
  return p.isRepeatable && p.minPurchaseType !== 'none' ? `${base} · berlaku kelipatan` : base;
}

/** Hari & jam berlaku, mis. "Jum · 07:02–19:02" atau "Setiap hari · Sepanjang jam buka" */
function validTimeText(p: Promotion): string {
  const days =
    p.validDays.length === 0 || p.validDays.length === 7
      ? 'Setiap hari'
      : [...p.validDays].sort().map((d) => DAY_NAMES[d]).join(', ');
  const hours =
    p.validStartTime && p.validEndTime
      ? `${p.validStartTime.slice(0, 5)}–${p.validEndTime.slice(0, 5)}`
      : 'Sepanjang jam buka';
  return `${days} · ${hours}`;
}

/**
 * Daftar diskon Offline. Manual: kasir pilih/lepas lalu Simpan. Otomatis: terpasang sendiri saat
 * syarat terpenuhi. Yang belum memenuhi syarat (produk, jam, hari, member, minimal) tampil buram.
 */
export default function PromoModal({ visible, order, onClose }: PromoModalProps) {
  const appliedId = order.promotion?.promotion.id ?? null;
  // Pilihan sementara; baru dipakai ke pesanan saat Simpan
  const [picked, setPicked] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPicked(order.draft.promotionId);
  }

  function save() {
    order.setPromotionId(picked);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Tutup">
              <X size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>List Promosi</Text>
            <Pressable
              onPress={() => setPicked(null)}
              disabled={!picked}
              style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
            >
              <Text style={[styles.resetText, !picked && styles.resetTextOff]}>Reset</Text>
            </Pressable>
            <Pressable onPress={save} style={({ pressed }) => [styles.save, pressed && styles.savePressed]}>
              <Text style={styles.saveText}>Simpan</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.listContent}>
            {order.promotions.length === 0 ? (
              <Text style={styles.empty}>Belum ada diskon Offline yang aktif.</Text>
            ) : (
              order.promotions.map((p) => {
                const blocked = !!promoBlocker(p, order.promoContext);
                const manual = p.promoType === 'manual';
                const selected = manual ? p.id === picked : p.id === appliedId && !picked;
                return (
                  <Pressable
                    key={p.id}
                    disabled={blocked || !manual}
                    onPress={() => setPicked(selected ? null : p.id)}
                    style={({ pressed }) => [
                      styles.ticket,
                      selected && styles.ticketSelected,
                      pressed && styles.pressed,
                      blocked && styles.ticketBlocked,
                    ]}
                  >
                    <View style={styles.body}>
                      <View style={styles.topRow}>
                        <View style={styles.titleBlock}>
                          <Text style={styles.type}>{p.memberOnly ? 'Promo Member' : 'Promo Umum'}</Text>
                          <View style={styles.nameRow}>
                            <Text style={styles.name} numberOfLines={2}>
                              {p.name}
                            </Text>
                            <View style={[styles.badge, !manual && styles.badgeAuto]}>
                              <Text style={[styles.badgeText, !manual && styles.badgeTextAuto]}>
                                {manual ? 'Manual' : 'Otomatis'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={[styles.radio, selected && styles.radioOn]}>
                          {selected ? <View style={styles.radioDot} /> : null}
                        </View>
                      </View>

                      <View style={styles.discountBox}>
                        <View style={styles.discountIcon}>
                          <Tag size={18} color={colors.textOnDark} />
                        </View>
                        <View>
                          <Text style={styles.discountLabel}>
                            {p.discountKind === 'persen' ? 'Diskon' : 'Potongan harga'}
                          </Text>
                          <Text style={styles.discountValue}>
                            {p.discountKind === 'persen' ? `${p.discountValue}%` : formatRupiah(p.discountValue)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.terms}>
                        <Term icon={ShoppingBag} text={minPurchaseText(p)} />
                        <Term
                          icon={Package}
                          text={p.appliesToAllProducts ? 'Semua produk' : `${p.productIds.length} produk terpilih`}
                        />
                        {!p.appliesToTakeAway ? <Term icon={Store} text="Khusus Dine In" /> : null}
                      </View>
                    </View>

                    {/* Sobekan tiket: garis putus-putus + lekukan di kiri/kanan */}
                    <View style={styles.tear}>
                      <View style={[styles.notch, styles.notchLeft]} />
                      <View style={styles.dashClip}>
                        <View style={styles.dash} />
                      </View>
                      <View style={[styles.notch, styles.notchRight]} />
                    </View>

                    <View style={styles.footer}>
                      <View style={styles.footerLabelRow}>
                        <Clock size={14} color={colors.textMuted} />
                        <Text style={styles.footerLabel}>Waktu Berlaku</Text>
                      </View>
                      <Text style={styles.footerValue}>{validTimeText(p)}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Term({ icon: Icon, text }: { icon: typeof Tag; text: string }) {
  return (
    <View style={styles.term}>
      <View style={styles.termIcon}>
        <Icon size={14} color={colors.textSecondary} />
      </View>
      <Text style={styles.termText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const NOTCH = 18;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheet: {
    width: 520,
    maxWidth: '100%',
    height: '100%',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 64,
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  reset: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  resetTextOff: {
    color: colors.textSubtle,
  },
  save: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
  },
  savePressed: {
    backgroundColor: colors.primaryHover,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  listContent: {
    gap: 14,
    padding: 20,
  },
  empty: {
    paddingVertical: 20,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSubtle,
  },
  ticket: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    // Memotong separuh lekukan yang keluar dari kartu
    overflow: 'hidden',
  },
  ticketSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  // Belum memenuhi syarat: tetap tampil, tapi buram & tidak bisa dipilih
  ticketBlocked: {
    opacity: 0.5,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  body: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  // Gaya sama dengan label kategori di kartu menu
  type: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  badgeAuto: {
    backgroundColor: colors.successBg,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  badgeTextAuto: {
    color: colors.success,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  radioOn: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  discountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  discountIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  discountLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  discountValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  terms: {
    gap: 8,
  },
  term: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  termIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  termText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tear: {
    height: NOTCH,
    justifyContent: 'center',
  },
  notch: {
    position: 'absolute',
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  notchLeft: {
    left: -NOTCH / 2 - 1,
  },
  notchRight: {
    right: -NOTCH / 2 - 1,
  },
  // Garis putus-putus satu sisi tidak didukung semua platform → potong kotak dashed setinggi 1px
  dashClip: {
    height: 1,
    marginHorizontal: NOTCH,
    overflow: 'hidden',
  },
  dash: {
    height: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
  },
  footerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  footerValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
