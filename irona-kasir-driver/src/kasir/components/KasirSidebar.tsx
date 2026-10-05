import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, Bike, History, LogOut, Printer, QrCode, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { KasirSection } from '@/kasir/types/section';
import SidebarItem from './SidebarItem';

interface KasirSidebarProps {
  active: KasirSection;
  onChange: (section: KasirSection) => void;
  employeeName: string;
  onSwitchEmployee: () => void;
}

const SECTIONS: { key: KasirSection; label: string; icon: LucideIcon }[] = [
  { key: 'menu', label: 'Menu', icon: BookOpen },
  { key: 'online', label: 'Online', icon: Bike },
  { key: 'histori', label: 'Histori', icon: History },
  { key: 'absensi', label: 'Absensi', icon: QrCode },
  { key: 'printer', label: 'Printer', icon: Printer },
];

/** Sidebar gelap di kiri layar Kasir (mengikuti Figma, warna mengikuti Web Admin) */
export default function KasirSidebar({
  active,
  onChange,
  employeeName,
  onSwitchEmployee,
}: KasirSidebarProps) {
  const firstName = employeeName.split(' ')[0];

  return (
    <SafeAreaView edges={['top', 'bottom', 'left']} style={styles.sidebar}>
      <View style={styles.logoBox}>
        <Image
          source={require('../../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.menu}>
        {SECTIONS.map((s) => (
          <SidebarItem
            key={s.key}
            icon={s.icon}
            label={s.label}
            active={active === s.key}
            onPress={() => onChange(s.key)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.employeeName} numberOfLines={1}>
          {firstName}
        </Text>
        <Pressable
          onPress={onSwitchEmployee}
          accessibilityRole="button"
          accessibilityLabel="Ganti karyawan"
          style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}
        >
          <LogOut size={20} color={colors.sidebarText} />
          <Text style={styles.switchLabel}>Ganti</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 104,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.sidebarBorder,
    alignItems: 'center',
  },
  logoBox: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.sidebarBorder,
  },
  logo: {
    width: 64,
    height: 36, // logo berukuran 16:9
  },
  menu: {
    flex: 1,
    paddingTop: 16,
    gap: 8,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.sidebarBorder,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sidebarItemActive,
    borderWidth: 1,
    borderColor: colors.sidebarItemActiveBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.sidebarTextActive,
  },
  employeeName: {
    maxWidth: 88,
    fontSize: 12,
    fontWeight: '600',
    color: colors.sidebarTextActive,
  },
  switchButton: {
    marginTop: 6,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  switchLabel: {
    fontSize: 11,
    color: colors.sidebarText,
  },
  pressed: {
    backgroundColor: colors.sidebarItemActive,
  },
});