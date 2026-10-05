import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Clock, Search, X } from 'lucide-react-native';
import { colors } from '@/constants/colors';

interface MenuTopBarProps {
  search: string;
  onSearchChange: (text: string) => void;
}

/** Bar atas halaman Menu: kolom cari + tanggal & jam */
export default function MenuTopBar({ search, onSearchChange }: MenuTopBarProps) {
  const [now, setNow] = useState(() => new Date());

  // Jam cukup diperbarui tiap 30 detik (tampilan hanya jam:menit)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const dateText = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.bar}>
      <View style={styles.searchBox}>
        <Search size={18} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Cari menu..."
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => onSearchChange('')} hitSlop={8} accessibilityLabel="Hapus pencarian">
            <X size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.clock}>
        <Clock size={14} color={colors.textMuted} />
        <Text style={styles.clockText}>
          {dateText} · {timeText} WIB
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  searchBox: {
    flex: 1,
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  clockText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});