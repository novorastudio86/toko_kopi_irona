import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LayoutGrid, Tag } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { CATEGORY_ICONS } from '@/kasir/constants/categoryIcons';
import type { MenuCategory } from '@/kasir/types/catalog';

interface CategoryPillsProps {
  categories: MenuCategory[];
  /** Jumlah produk per kategori (kunci 'all' = semua) */
  counts: Record<string, number>;
  selectedId: string; // 'all' atau id kategori
  onSelect: (id: string) => void;
}

/** Filter kategori berbentuk pil yang bisa digeser ke samping */
export default function CategoryPills({ categories, counts, selectedId, onSelect }: CategoryPillsProps) {
  const pills = [
    { id: 'all', name: 'Semua', Icon: LayoutGrid },
    ...categories.map((c) => ({
      id: c.id,
      name: c.name,
      Icon: (c.icon && CATEGORY_ICONS[c.icon]) || Tag,
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {pills.map(({ id, name, Icon }) => {
        const active = id === selectedId;
        return (
          <Pressable
            key={id}
            onPress={() => onSelect(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Icon size={16} color={active ? colors.textOnDark : colors.textMuted} />
            <Text style={[styles.name, active && styles.nameActive]}>{name}</Text>
            <View style={[styles.count, active && styles.countActive]}>
              <Text style={[styles.countText, active && styles.countTextActive]}>
                {counts[id] ?? 0}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0, // jangan ikut memanjang ke bawah, cukup setinggi pil
  },
  row: {
    gap: 10,
    paddingVertical: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nameActive: {
    color: colors.textOnDark,
  },
  count: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  countActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  countTextActive: {
    color: colors.textOnDark,
  },
});