import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import type { AppEmployee } from '@/types/employee';

interface EmployeePickerProps {
  employees: AppEmployee[];
  selected: AppEmployee | null;
  onSelect: (employee: AppEmployee) => void;
}

/** "Dropdown" nama karyawan: kotak pilihan yang membuka daftar nama + pencarian */
export default function EmployeePicker({ employees, selected, onSelect }: EmployeePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const filtered = query
    ? employees.filter((e) => e.fullName.toLowerCase().includes(query))
    : employees;

  function close() {
    setOpen(false);
    setSearch('');
  }

  return (
    <>
      <Text style={styles.label}>Nama karyawan</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
        accessibilityRole="button"
        accessibilityLabel="Pilih nama karyawan"
      >
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.fullName : 'Pilih namamu'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Pilih nama</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Text style={styles.close}>Tutup</Text>
            </Pressable>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cari nama..."
            placeholderTextColor={colors.textSubtle}
            style={styles.search}
            autoCorrect={false}
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<Text style={styles.empty}>Nama tidak ditemukan.</Text>}
            renderItem={({ item }) => (
              <Pressable
                disabled={!item.hasPin}
                onPress={() => {
                  onSelect(item);
                  close();
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, !item.hasPin && styles.rowDisabled]}>
                    {item.fullName}
                  </Text>
                  <Text style={styles.rowRole}>
                    {item.hasPin ? item.roleName : 'Belum punya PIN — hubungi Owner'}
                  </Text>
                </View>
                {selected?.id === item.id ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  fieldPressed: {
    borderColor: colors.primary,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    fontSize: 15,
    color: colors.textSubtle,
  },
  chevron: {
    fontSize: 16,
    color: colors.textMuted,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  close: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  search: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 32,
    color: colors.textSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowDisabled: {
    color: colors.textSubtle,
  },
  rowRole: {
    fontSize: 12,
    color: colors.textMuted,
  },
  check: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
});