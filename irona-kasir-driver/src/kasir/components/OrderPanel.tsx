import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowRight, CircleCheck, Percent, Save, ShoppingBag, Ticket, Trash2 } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useResponsive } from '@/hooks/useResponsive';
import type { OrderDraftApi } from '@/kasir/hooks/useOrderDraft';
import { formatRupiah } from '@/utils/formatCurrency';
import CustomerSection from './CustomerSection';
import OrderItemRow from './OrderItemRow';
import OrderTypeToggle from './OrderTypeToggle';
import PromoModal from './PromoModal';

interface OrderPanelProps {
  order: OrderDraftApi;
  onCancel: () => void;
  /** Buka halaman Pembayaran */
  onCheckout: () => void;
}

/**
 * Kolom kanan: No. order → Pelanggan + Dine In/Take Away → Daftar Menu →
 * (Kode voucher, khusus member) → Promo / Simpan → Hapus / Bayar (metode bayar di PaymentScreen)
 */
export default function OrderPanel({ order, onCancel, onCheckout }: OrderPanelProps) {
  const { draft, promotion } = order;
  const hasItems = draft.items.length > 0;
  const { sidePanelWidth } = useResponsive();
  const [promoOpen, setPromoOpen] = useState(false);
  const [voucher, setVoucher] = useState('');

  // ponytail: tampilan saja — penukaran voucher (poin reward) & open bill menunggu backend
  function comingSoon(feature: string) {
    Alert.alert(feature, 'Fitur ini segera hadir.');
  }

  return (
    <View style={[styles.panel, { width: sidePanelWidth }]}>
      {/* Header: No. order (format backend; nomor urut baru diisi server saat diproses) */}
      <View style={styles.header}>
        <Text style={styles.title}>{orderNumberPreview()}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <CustomerSection
          member={draft.member}
          customerName={draft.customerName}
          onMemberChange={order.setMember}
          onNameChange={order.setCustomerName}
        />
        <OrderTypeToggle value={draft.orderType} onChange={order.setOrderType} />

        {/* Daftar Menu */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Daftar Menu</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{order.totalQuantity} item</Text>
          </View>
        </View>
        {hasItems ? (
          draft.items.map((item) => {
            const cut = promotion?.discounts[item.product.id];
            return (
              <OrderItemRow
                key={item.product.id}
                item={item}
                takeAway={draft.orderType === 'take_away'}
                discount={promotion && cut ? { name: promotion.promotion.name, amount: cut } : undefined}
                onChangeQuantity={(q) => order.setItemQuantity(item.product.id, q)}
                onChangeNotes={(notes) => order.setItemNotes(item.product.id, notes)}
                onRemove={() => order.removeItem(item.product.id)}
              />
            );
          })
        ) : (
          <View style={styles.empty}>
            <ShoppingBag size={28} color={colors.borderStrong} />
            <Text style={styles.emptyText}>Belum ada menu. Tekan "Tas" pada kartu menu.</Text>
          </View>
        )}
      </ScrollView>

      {/* Tombol bawah selalu terlihat */}
      <View style={styles.footer}>
        {draft.member ? (
          <View style={styles.voucher}>
            <Ticket size={16} color={colors.textSubtle} />
            <TextInput
              value={voucher}
              onChangeText={setVoucher}
              placeholder="Kode voucher"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="characters"
              style={styles.voucherInput}
            />
            <Pressable
              onPress={() => comingSoon('Kode voucher')}
              disabled={!voucher.trim()}
              hitSlop={8}
              style={!voucher.trim() && styles.disabled}
              accessibilityLabel="Pakai kode voucher"
            >
              <CircleCheck size={22} color={colors.primary} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footerRow}>
          <Pressable
            onPress={() => setPromoOpen(true)}
            style={({ pressed }) => [styles.secondary, !!promotion && styles.secondaryActive, pressed && styles.pressed]}
          >
            <Percent size={16} color={promotion ? colors.success : colors.textSecondary} />
            <Text style={[styles.secondaryText, !!promotion && styles.promoText]} numberOfLines={1}>
              {promotion ? `Promo -${formatRupiah(promotion.total)}` : 'Promo'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => comingSoon('Simpan (open bill)')}
            disabled={!hasItems}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed, !hasItems && styles.disabled]}
          >
            <Save size={16} color={colors.textSecondary} />
            <Text style={styles.secondaryText}>Simpan</Text>
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Pressable
            onPress={onCancel}
            disabled={!hasItems}
            hitSlop={4}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed, !hasItems && styles.disabled]}
            accessibilityLabel="Batalkan pesanan"
          >
            <Trash2 size={20} color={colors.danger} />
          </Pressable>
          <Pressable
            onPress={onCheckout}
            disabled={!hasItems}
            style={({ pressed }) => [styles.process, pressed && styles.processPressed, !hasItems && styles.disabled]}
          >
            <Text style={styles.processText} numberOfLines={1} adjustsFontSizeToFit>
              Bayar ({formatRupiah(order.total)})
            </Text>
            <ArrowRight size={18} color={colors.textOnDark} />
          </Pressable>
        </View>
      </View>

      <PromoModal visible={promoOpen} order={order} onClose={() => setPromoOpen(false)} />
    </View>
  );
}
/** "INV-YYMMDD-····" — format No. order dari create_kasir_order */
function orderNumberPreview(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `INV-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-····`;
}

const styles = StyleSheet.create({
  panel: {
    flex: 1, // isi penuh tinggi pembungkusnya di MenuScreen
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 12,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  countBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  footer: {
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  voucher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  voucherInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  secondaryActive: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  secondaryText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  promoText: {
    color: colors.success,
  },
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  process: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  processPressed: {
    backgroundColor: colors.primaryHover,
  },
  processText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  disabled: {
    opacity: 0.45,
  },
});
