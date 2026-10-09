import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bike, Search } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useResponsive } from '@/hooks/useResponsive';
import OnlineOrderDetailPanel from '@/kasir/components/OnlineOrderDetailPanel';
import OnlineOrderRow from '@/kasir/components/OnlineOrderRow';
import type { OnlineOrdersApi } from '@/kasir/hooks/useOnlineOrders';
import type { OnlineOrder, OnlineStatus } from '@/kasir/types/online';

interface OnlineScreenProps {
  online: OnlineOrdersApi;
  sessionId: string | null;
}

type TabKey = 'baru' | 'diproses' | 'diantar' | 'selesai';

const TABS: { key: TabKey; label: string; statuses: OnlineStatus[] }[] = [
  { key: 'baru', label: 'Baru', statuses: ['masuk'] },
  { key: 'diproses', label: 'Diproses', statuses: ['dibuat', 'siap_diantar'] },
  { key: 'diantar', label: 'Diantar', statuses: ['diantar'] },
  { key: 'selesai', label: 'Selesai Hari Ini', statuses: ['selesai', 'dibatalkan'] },
];

const EMPTY_TEXT: Record<TabKey, string> = {
  baru: 'Belum ada pesanan baru.',
  diproses: 'Tidak ada pesanan yang sedang dibuat.',
  diantar: 'Tidak ada pesanan yang sedang diantar.',
  selesai: 'Belum ada pesanan selesai hari ini.',
};

/** Menu Online: pesanan dari Web Customer, diproses kasir sampai diserahkan ke driver */
export default function OnlineScreen({ online, sessionId }: OnlineScreenProps) {
  const { orders, loading, error, reload } = online;
  const [tab, setTab] = useState<TabKey>('baru');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { sidePanelWidth } = useResponsive();

  const countOf = (key: TabKey) =>
    orders.filter((o) => TABS.find((t) => t.key === key)!.statuses.includes(o.onlineStatus)).length;

  const statuses = TABS.find((t) => t.key === tab)!.statuses;
  const query = search.trim().toLowerCase();
  const matches = (o: OnlineOrder) =>
    !query ||
    o.transactionNumber.toLowerCase().includes(query) ||
    o.customerName.toLowerCase().includes(query) ||
    o.customerPhone.includes(query);
  const visible = orders
    .filter((o) => statuses.includes(o.onlineStatus) && matches(o))
    // Yang selesai: terbaru di atas; yang berjalan: terlama di atas (didahulukan)
    .sort((a, b) =>
      tab === 'selesai'
        ? b.transactionDate.localeCompare(a.transactionDate)
        : a.transactionDate.localeCompare(b.transactionDate)
    );
  // Detail tetap tampil walaupun pesanan sudah pindah ke tab lain
  const selected = orders.find((o) => o.transactionId === selectedId) ?? null;


  return (
    <View style={styles.container}>
      <View style={styles.listColumn}>
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const count = countOf(t.key);
            const active = t.key === tab;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                {count > 0 ? (
                  <View style={[styles.count, t.key === 'baru' && styles.countNew, active && styles.countActive]}>
                    <Text style={[styles.countText, (t.key === 'baru' || active) && styles.countTextLight]}>
                      {count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={colors.textSubtle} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cari No. Pesanan / nama / No. WA"
            placeholderTextColor={colors.textSubtle}
            style={styles.searchInput}
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={visible}
          keyExtractor={(o) => o.transactionId}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={reload}
          ListEmptyComponent={
            loading ? null : (
              <Text style={styles.empty}>{query ? 'Pesanan tidak ditemukan.' : EMPTY_TEXT[tab]}</Text>
            )
          }
          renderItem={({ item }) => (
            <OnlineOrderRow
              order={item}
              selected={item.transactionId === selectedId}
              onPress={() => setSelectedId(item.transactionId)}
            />
          )}
        />
      </View>

      <View style={{ width: sidePanelWidth }}>
        {selected ? (
          <OnlineOrderDetailPanel order={selected} sessionId={sessionId} onChanged={reload} />
        ) : (
          <View style={styles.placeholder}>
            <Bike size={36} color={colors.borderStrong} />
            <Text style={styles.placeholderText}>Pilih pesanan untuk melihat detailnya.</Text>
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
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textOnDark,
  },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  countNew: {
    backgroundColor: colors.danger,
  },
  countActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  countTextLight: {
    color: colors.textOnDark,
  },
  searchBox: {
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
});
