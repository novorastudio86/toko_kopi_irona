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

/**
 * Filter kategori berbentuk pil. Pil terpilih dikunci di kiri (tidak ikut digeser),
 * sisanya bisa digeser ke samping dengan urutan asli.
 */
export default function CategoryPills({ categories, counts, selectedId, onSelect }: CategoryPillsProps) {
  const pills = [
    { id: 'all', name: 'Semua', Icon: LayoutGrid },
    ...categories.map((c) => ({
      id: c.id,
      name: c.name,
      Icon: (c.icon && CATEGORY_ICONS[c.icon]) || Tag,
    })),
  ];
  const active = pills.find((p) => p.id === selectedId) ?? pills[0];

  function renderPill({ id, name, Icon }: (typeof pills)[number]) {
    const isActive = id === active.id;
    return (
      <Pressable
        key={id}
        onPress={() => onSelect(id)}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        style={[styles.pill, isActive && styles.pillActive]}
      >
        <Icon size={14} color={isActive ? colors.textOnDark : colors.textMuted} />
        <Text style={[styles.name, isActive && styles.nameActive]}>{name}</Text>
        <View style={[styles.count, isActive && styles.countActive]}>
          <Text style={[styles.countText, isActive && styles.countTextActive]}>{counts[id] ?? 0}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.bar}>
      {renderPill(active)}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {pills.filter((p) => p.id !== active.id).map(renderPill)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0, // jangan ditekan grid di bawahnya (dulu teks pil terpotong)
  },
  row: {
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nameActive: {
    color: colors.textOnDark,
  },
  count: {
    minWidth: 22,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  countActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  countTextActive: {
    color: colors.textOnDark,
  },
});
