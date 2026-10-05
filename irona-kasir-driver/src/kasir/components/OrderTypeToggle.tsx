import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { OrderType } from '@/kasir/types/order';

interface OrderTypeToggleProps {
  value: OrderType;
  onChange: (value: OrderType) => void;
}

const OPTIONS: { value: OrderType; label: string; icon: LucideIcon }[] = [
  { value: 'dine_in', label: 'Dine In', icon: UtensilsCrossed },
  { value: 'take_away', label: 'Take Away', icon: ShoppingBag },
];

/** Pilihan Dine In / Take Away */
export default function OrderTypeToggle({ value, onChange }: OrderTypeToggleProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.option, active && styles.optionActive]}
          >
            <Icon size={16} color={active ? colors.textOnDark : colors.textSecondary} />
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.textOnDark,
  },
});