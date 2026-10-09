import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { colors } from '@/constants/colors';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Versi kecil untuk kartu produk */
  compact?: boolean;
}

/** Tombol − jumlah + (dipakai di kartu produk dan keranjang) */
export default function QuantityStepper({ value, onChange, min = 1, compact = false }: QuantityStepperProps) {
  const iconSize = compact ? 14 : 16;
  return (
    <View style={styles.box}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        hitSlop={6}
        accessibilityLabel="Kurangi"
        style={({ pressed }) => [
          styles.button,
          compact && styles.buttonCompact,
          pressed && styles.pressed,
          value <= min && styles.disabled,
        ]}
      >
        <Minus size={iconSize} color={colors.textSecondary} />
      </Pressable>
      <Text style={[styles.value, compact && styles.valueCompact]}>{value}</Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        hitSlop={6}
        accessibilityLabel="Tambah"
        style={({ pressed }) => [styles.button, compact && styles.buttonCompact, pressed && styles.pressed]}
      >
        <Plus size={iconSize} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  button: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  buttonCompact: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    opacity: 0.35,
  },
  value: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  valueCompact: {
    minWidth: 18,
    fontSize: 13,
  },
});