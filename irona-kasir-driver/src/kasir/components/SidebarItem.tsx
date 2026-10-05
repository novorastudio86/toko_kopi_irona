import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/constants/colors';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  /** Angka kecil di pojok ikon, mis. jumlah pesanan online baru */
  badge?: number;
  onPress: () => void;
}

/** Satu tombol di sidebar: ikon + label di bawahnya */
export default function SidebarItem({
  icon: Icon,
  label,
  active = false,
  badge,
  onPress,
}: SidebarItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.pressed]}
    >
      {/* Garis putih di kiri menandai menu yang sedang dibuka */}
      {active ? <View style={styles.indicator} /> : null}

      <View>
        <Icon
          size={22}
          color={active ? colors.sidebarTextActive : colors.sidebarText}
          strokeWidth={active ? 2.25 : 1.75}
        />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    width: 76,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 6,
  },
  itemActive: {
    backgroundColor: colors.sidebarItemActive,
    borderColor: colors.sidebarItemActiveBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  indicator: {
    position: 'absolute',
    left: -14,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.sidebarTextActive,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.sidebarText,
  },
  labelActive: {
    fontWeight: '700',
    color: colors.sidebarTextActive,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
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