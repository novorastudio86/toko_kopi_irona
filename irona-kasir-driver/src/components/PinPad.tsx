import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';

export const PIN_LENGTH = 6;

interface PinPadProps {
  value: string;
  onChange: (pin: string) => void;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'hapus'];

/** 6 titik PIN + tombol angka (tidak memakai keyboard HP, lebih cepat untuk kasir) */
export default function PinPad({ value, onChange, disabled = false }: PinPadProps) {
  function press(key: string) {
    if (disabled) return;
    if (key === 'hapus') onChange(value.slice(0, -1));
    else if (value.length < PIN_LENGTH) onChange(value + key);
  }

  return (
    <View style={styles.container}>
      <View style={styles.dots} accessibilityLabel={`${value.length} dari ${PIN_LENGTH} digit PIN`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotFilled]} />
        ))}
      </View>

      <View style={styles.grid}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              onPress={() => press(key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={key === 'hapus' ? 'Hapus satu digit' : key}
              style={({ pressed }) => [
                styles.key,
                styles.keyButton,
                pressed && styles.keyPressed,
                disabled && styles.keyDisabled,
              ]}
            >
              <Text style={key === 'hapus' ? styles.deleteText : styles.keyText}>
                {key === 'hapus' ? 'Hapus' : key}
              </Text>
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 3 * 76 + 2 * 16, // 3 kolom tombol + 2 jarak
    gap: 16,
  },
  key: {
    width: 76,
    height: 64,
  },
  keyButton: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
});