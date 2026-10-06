import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/constants/colors';

interface RejectOrderModalProps {
  visible: boolean;
  orderNumber: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const REASONS = ['Menu/bahan habis', 'Toko segera tutup', 'Pesanan terlalu banyak', 'Alamat tidak terjangkau'];

/** Konfirmasi tolak pesanan + alasan (dicatat & nanti dikirim ke email pelanggan) */
export default function RejectOrderModal({
  visible,
  orderNumber,
  submitting,
  onClose,
  onConfirm,
}: RejectOrderModalProps) {
  const [reason, setReason] = useState('');

  const valid = reason.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={() => setReason('')}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Tolak pesanan {orderNumber}?</Text>
          <Text style={styles.subtitle}>
            Pesanan dibatalkan dan pelanggan diberi tahu. Pengembalian dana diproses Owner dari Web
            Admin.
          </Text>

          <View style={styles.chips}>
            {REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setReason(r)}
                style={[styles.chip, reason === r && styles.chipActive]}
              >
                <Text style={[styles.chipText, reason === r && styles.chipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Atau tulis alasan lain"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.button, styles.buttonGhost]}>
              <Text style={styles.ghostText}>Batal</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(reason.trim())}
              disabled={!valid || submitting}
              style={[styles.button, styles.buttonDanger, (!valid || submitting) && styles.disabled]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textOnDark} />
              ) : (
                <Text style={styles.dangerText}>Tolak Pesanan</Text>
              )}
            </Pressable>
          </View>
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
    width: 460,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    fontWeight: '700',
    color: colors.danger,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  ghostText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dangerText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  disabled: {
    opacity: 0.45,
  },
});
