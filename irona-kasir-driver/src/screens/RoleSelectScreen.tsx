import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandHeader from '@/components/BrandHeader';
import RoleCard from '@/components/RoleCard';
import { colors } from '@/constants/colors';
import type { AppRole } from '@/types/role';

interface RoleSelectScreenProps {
  ownerName: string;
  onSelectRole: (role: AppRole) => void;
  onSignOutDevice: () => void;
}

/** Setelah perangkat dibuka Owner: pilih masuk sebagai Kasir atau Driver */
export default function RoleSelectScreen({
  ownerName,
  onSelectRole,
  onSignOutDevice,
}: RoleSelectScreenProps) {
  return (
    <View style={styles.container}>
      <BrandHeader
        title="Siap melayani hari ini?"
        subtitle="Aplikasi Kasir & Driver Toko Kopi Irona."
      />

      <SafeAreaView edges={['bottom']} style={styles.body}>
        <Text style={styles.title}>Masuk sebagai</Text>
        <Text style={styles.subtitle}>Pilih peranmu, lalu masuk dengan nama & PIN.</Text>

        <View style={styles.menu}>
          <RoleCard
            icon="🧾"
            title="Kasir"
            description="Terima pesanan, pembayaran, dan kelola antrean"
            onPress={() => onSelectRole('kasir')}
          />
          <RoleCard
            icon="🛵"
            title="Driver"
            description="Lihat dan antarkan pesanan online"
            onPress={() => onSelectRole('driver')}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Perangkat dibuka oleh {ownerName}</Text>
          <Pressable onPress={onSignOutDevice} hitSlop={8}>
            <Text style={styles.signOut}>Keluar perangkat</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
  },
  menu: {
    marginTop: 24,
    gap: 12,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 16,
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  signOut: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
});