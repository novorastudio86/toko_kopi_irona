import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, ChevronRight, ReceiptText, Search } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import HistoryDetailPanel from '@/kasir/components/HistoryDetailPanel';
import HistoryRow from '@/kasir/components/HistoryRow';
import { fetchTransactionHistory } from '@/kasir/services/history';
import type { HistoryTransaction } from '@/kasir/types/history';
import { formatRupiah } from '@/utils/formatCurrency';

/** Tanggal lokal "YYYY-MM-DD" */
function toDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** Menu Histori: transaksi kasir per hari + detail struk + cetak ulang */
export default function HistoryScreen() {
  const today = toDateString(new Date());
  const [date, setDate] = useState(today);
  const [transactions, setTransactions] = useState<HistoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTransactions(await fetchTransactionHistory(date));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat histori.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  // Muat ulang setiap tanggal berganti
  useEffect(() => {
    load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const visible = transactions.filter(
    (t) =>
      !query ||
      t.transactionNumber.toLowerCase().includes(query) ||
      t.customerName.toLowerCase().includes(query)
  );
  const selected = transactions.find((t) => t.transactionId === selectedId) ?? null;

  // Ringkasan hari itu: hanya transaksi yang tidak direfund penuh / dibatalkan
  const valid = transactions.filter((t) => t.status === 'selesai' || t.status === 'refund_sebagian');
  const sum = (list: HistoryTransaction[]) => list.reduce((s, t) => s + t.total, 0);
  const summary = [
    { label: 'Transaksi', value: String(valid.length) },
    { label: 'Penjualan', value: formatRupiah(sum(valid)) },
    { label: 'Tunai', value: formatRupiah(sum(valid.filter((t) => t.paymentMethod === 'tunai'))) },
    { label: 'QRIS', value: formatRupiah(sum(valid.filter((t) => t.paymentMethod === 'qris'))) },
  ];

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.listColumn}>
        {/* Pilih tanggal + cari */}
        <View style={styles.toolbar}>
          <View style={styles.dateNav}>
            <Pressable onPress={() => setDate(shiftDate(date, -1))} hitSlop={8} style={styles.navButton}>
              <ChevronLeft size={18} color={colors.textSecondary} />
            </Pressable>
            <Text style={styles.dateText}>{date === today ? `Hari ini · ${dateLabel}` : dateLabel}</Text>
            <Pressable
              onPress={() => setDate(shiftDate(date, 1))}
              disabled={date >= today}
              hitSlop={8}
              style={[styles.navButton, date >= today && styles.disabled]}
            >
              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Search size={16} color={colors.textSubtle} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Cari No. Order / nama"
              placeholderTextColor={colors.textSubtle}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Ringkasan hari itu */}
        <View style={styles.summary}>
          {summary.map((s) => (
            <View key={s.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{s.label}</Text>
              <Text style={styles.summaryValue}>{s.value}</Text>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={visible}
          keyExtractor={(t) => t.transactionId}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={
            loading ? null : (
              <Text style={styles.empty}>
                {query ? 'Transaksi tidak ditemukan.' : 'Belum ada transaksi di tanggal ini.'}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <HistoryRow
              transaction={item}
              selected={item.transactionId === selectedId}
              onPress={() => setSelectedId(item.transactionId)}
            />
          )}
        />
      </View>

      <View style={styles.detailColumn}>
        {selected ? (
          <HistoryDetailPanel transaction={selected} onPrinted={load} />
        ) : (
          <View style={styles.placeholder}>
            <ReceiptText size={36} color={colors.borderStrong} />
            <Text style={styles.placeholderText}>Pilih transaksi untuk melihat struknya.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  listColumn: {
    flex: 1,
    gap: 12,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navButton: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dateText: {
    minWidth: 220,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
  },
  summary: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    gap: 2,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  list: {
    gap: 8,
    paddingBottom: 16,
  },
  empty: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSubtle,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  detailColumn: {
    width: 400,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  placeholderText: {
    fontSize: 13,
    color: colors.textSubtle,
  },
  disabled: {
    opacity: 0.35,
  },
});
