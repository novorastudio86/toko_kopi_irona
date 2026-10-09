import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Phone, User, X } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { isPhoneQuery, searchMembersByPhone } from '@/kasir/services/members';
import type { Member } from '@/kasir/types/order';

interface CustomerSectionProps {
  member: Member | null;
  customerName: string;
  onMemberChange: (member: Member | null) => void;
  onNameChange: (name: string) => void;
}

/**
 * Pelanggan dalam 1 baris: ketik angka → muncul daftar member yang No HP-nya cocok
 * (tekan untuk memilih), ketik huruf / dikosongkan → non-member.
 */
export default function CustomerSection({
  member,
  customerName,
  onMemberChange,
  onNameChange,
}: CustomerSectionProps) {
  // Hasil disimpan bersama query-nya, supaya hasil lama tidak tampil untuk ketikan baru
  const [found, setFound] = useState<{ query: string; members: Member[]; error?: string } | null>(null);
  const phoneMode = customerName.trim().length > 0 && isPhoneQuery(customerName);
  // Saran baru dicari setelah minimal 3 digit, jeda 300 ms selama mengetik
  const query = phoneMode && customerName.replace(/\D/g, '').length >= 3 ? customerName : '';

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const members = await searchMembersByPhone(query);
        if (!cancelled) setFound({ query, members });
      } catch (err) {
        if (!cancelled)
          setFound({ query, members: [], error: err instanceof Error ? err.message : 'Gagal mencari member.' });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);
  const ready = found?.query === query;

  if (member) {
    return (
      <View style={[styles.field, styles.memberField]}>
        <User size={16} color={colors.textSecondary} />
        <Text style={styles.memberName} numberOfLines={1}>
          {member.name}
          <Text style={styles.memberMeta}>
            {'  '}
            {member.pointsBalance} poin
          </Text>
        </Text>
        <View style={styles.memberBadge}>
          <Text style={styles.memberBadgeText}>MEMBER</Text>
        </View>
        <Pressable onPress={() => onMemberChange(null)} hitSlop={8} accessibilityLabel="Hapus member">
          <X size={16} color={colors.textSubtle} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        {phoneMode ? (
          <Phone size={16} color={colors.textSubtle} />
        ) : (
          <User size={16} color={colors.textSubtle} />
        )}
        <TextInput
          value={customerName}
          onChangeText={onNameChange}
          placeholder="No HP member / nama pelanggan"
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
        />
        {query && !ready ? <ActivityIndicator size="small" color={colors.textSubtle} /> : null}
      </View>

      {query && ready ? (
        found.error ? (
          <Text style={styles.message}>{found.error}</Text>
        ) : found.members.length > 0 ? (
          <View style={styles.list}>
            {found.members.map((m, index) => (
              <Pressable
                key={m.id}
                onPress={() => onMemberChange(m)}
                style={({ pressed }) => [
                  styles.option,
                  index > 0 && styles.optionBorder,
                  pressed && styles.optionPressed,
                ]}
              >
                <Text style={styles.optionName} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={styles.optionPhone}>{m.phoneNumber}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.message}>Member tidak ditemukan.</Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  list: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  optionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  optionName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  optionPhone: {
    fontSize: 13,
    color: colors.textMuted,
  },
  message: {
    fontSize: 12,
    color: colors.warning,
  },
  memberField: {
    paddingRight: 12,
    backgroundColor: colors.surfaceMuted,
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  memberMeta: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
  },
  memberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  memberBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textOnDark,
  },
});
