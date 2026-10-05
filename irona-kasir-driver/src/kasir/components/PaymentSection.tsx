import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Banknote, QrCode, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { PaymentMethod } from '@/kasir/types/order';
import SectionCard from './SectionCard';

interface PaymentSectionProps {
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  total: number;
  cashReceived: number;
  onCashChange: (amount: number) => void;
  isReady: boolean;
}

const METHODS: { value: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { value: 'tunai', label: 'Tunai', icon: Banknote },
  { value: 'qris', label: 'QRIS', icon: QrCode },
];

const QUICK_CASH = [10000, 20000, 50000, 100000, 200000];

/** 150000 → "150.000" (tanpa "Rp", untuk isian nominal) */
function formatThousands(value: number): string {
  return value > 0 ? value.toLocaleString('id-ID') : '';
}

/** Metode Pembayaran: Tunai (tombol nominal cepat + isian) atau QRIS */
export default function PaymentSection({
  method,
  onMethodChange,
  total,
  cashReceived,
  onCashChange,
  isReady,
}: PaymentSectionProps) {
  return (
    <SectionCard
      title="Metode Pembayaran"
      right={
        isReady ? (
          <View style={styles.ready}>
            <View style={styles.readyDot} />
            <Text style={styles.readyText}>Siap Bayar</Text>
          </View>
        ) : null
      }
    >
      <View style={styles.methods}>
        {METHODS.map(({ value, label, icon: Icon }) => {
          const active = value === method;
          return (
            <Pressable
              key={value}
              onPress={() => onMethodChange(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.method, active && styles.methodActive]}
            >
              <Icon size={20} color={active ? colors.textOnDark : colors.textSecondary} />
              <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {method === 'tunai' ? (
        <>
          <View style={styles.quickRow}>
            <Text style={styles.quickLabel}>Cepat:</Text>
            {[total, ...QUICK_CASH].map((amount, i) => {
              const tooSmall = amount < total;
              const selected = cashReceived === amount && amount > 0;
              return (
                <Pressable
                  key={i === 0 ? 'pas' : amount}
                  onPress={() => onCashChange(amount)}
                  disabled={tooSmall || total === 0}
                  style={[
                    styles.quick,
                    selected && styles.quickSelected,
                    (tooSmall || total === 0) && styles.quickDisabled,
                  ]}
                >
                  <Text style={[styles.quickText, selected && styles.quickTextSelected]}>
                    {i === 0 ? 'Pas' : formatThousands(amount)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>Masukkan nominal pembayaran</Text>
          <View style={styles.inputBox}>
            <Text style={styles.inputPrefix}>Rp</Text>
            <TextInput
              value={formatThousands(cashReceived)}
              onChangeText={(text) => onCashChange(Number(text.replace(/\D/g, '')) || 0)}
              placeholder="0"
              placeholderTextColor={colors.textSubtle}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        </>
      ) : (
        <Text style={styles.qrisHint}>
          Minta pelanggan scan QRIS di meja kasir. Pastikan dana sudah masuk (cek notifikasi),
          baru tekan Proses Order.
        </Text>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  ready: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  readyText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  methods: {
    flexDirection: 'row',
    gap: 8,
  },
  method: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  methodLabelActive: {
    color: colors.textOnDark,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  quickLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 2,
  },
  quick: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickDisabled: {
    opacity: 0.35,
  },
  quickText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quickTextSelected: {
    color: colors.textOnDark,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inputPrefix: {
    fontSize: 14,
    color: colors.textMuted,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  qrisHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
});