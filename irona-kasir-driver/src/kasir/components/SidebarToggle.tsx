import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Menu } from 'lucide-react-native';
import { colors } from '@/constants/colors';

interface SidebarToggleProps {
  /** Jumlah pesanan online baru; tetap terlihat walau sidebar tersembunyi */
  badge: number;
  onPress: () => void;
}

/** Tombol ☰ untuk membuka sidebar Kasir */
export default function SidebarToggle({ badge, onPress }: SidebarToggleProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Buka menu samping"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Menu size={20} color={colors.text} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textOnDark,
  },
});
