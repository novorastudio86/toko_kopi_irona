import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pencil, Phone, User } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { findMemberByPhone } from '@/kasir/services/members';
import type { Member } from '@/kasir/types/order';
import SectionCard from './SectionCard';

interface CustomerSectionProps {
  member: Member | null;
  customerName: string;
  onMemberChange: (member: Member | null) => void;
  onNameChange: (name: string) => void;
}

/** Pelanggan: member dicari lewat No HP (nama terisi otomatis), non-member ketik nama */
export default function CustomerSection({
  member,
  customerName,
  onMemberChange,
  onNameChange,
}: CustomerSectionProps) {
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSearch() {
    if (!phone.trim()) return;
    setSearching(true);
    setMessage(null);
    try {
      const found = await findMemberByPhone(phone);
      if (found) {
        onMemberChange(found);
        setPhone('');
      } else {
        setMessage('Member tidak ditemukan. Ketik nama pelanggan di bawah.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal mencari member.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <SectionCard
      title="Pelanggan"
      right={
        member ? (
          <Pressable onPress={() => onMemberChange(null)} hitSlop={8} style={styles.change}>
            <Pencil size={13} color={colors.textSecondary} />
            <Text style={styles.changeText}>Ubah</Text>
          </Pressable>
        ) : null
      }
    >
      {member ? (
        <View style={styles.memberBox}>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberMeta}>
              Member · {member.phoneNumber} · {member.pointsBalance} poin
            </Text>
          </View>
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>MEMBER</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <Phone size={16} color={colors.textSubtle} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Cari member (No HP)"
              placeholderTextColor={colors.textSubtle}
              keyboardType="phone-pad"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              style={styles.input}
            />
            <Pressable
              onPress={handleSearch}
              disabled={searching || !phone.trim()}
              style={({ pressed }) => [styles.searchButton, pressed && styles.searchPressed]}
            >
              {searching ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={styles.searchText}>Cari</Text>
              )}
            </Pressable>
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.field}>
            <User size={16} color={colors.textSubtle} />
            <TextInput
              value={customerName}
              onChangeText={onNameChange}
              placeholder="Nama pelanggan (non-member)"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="words"
              style={styles.input}
            />
          </View>
        </>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  searchButton: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  searchPressed: {
    backgroundColor: colors.border,
  },
  searchText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  message: {
    fontSize: 12,
    color: colors.warning,
  },
  memberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  memberMeta: {
    fontSize: 12,
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