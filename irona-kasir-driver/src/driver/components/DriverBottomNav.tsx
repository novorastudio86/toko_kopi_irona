import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { History, Store, User, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { DriverTab } from '@/driver/types/delivery';

interface DriverBottomNavProps {
  active: DriverTab;
  onChange: (tab: DriverTab) => void;
}

/** Navigasi bawah (Figma "Nav"): Histori — tombol tengah Antaran — Profil */
export default function DriverBottomNav({ active, onChange }: DriverBottomNavProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.nav}>
      <View style={styles.row}>
        <SideTab icon={History} label="Histori" active={active === 'histori'} onPress={() => onChange('histori')} />

        {/* Tombol tengah melayang */}
        <Pressable
          onPress={() => onChange('antaran')}
          accessibilityRole="button"
          accessibilityLabel="Antaran"
          style={styles.center}
        >
          <View style={styles.centerRing}>
            <View style={[styles.centerButton, active === 'antaran' && styles.centerButtonActive]}>
              <Store size={26} color={colors.textOnDark} />
            </View>
          </View>
          <Text style={[styles.label, active === 'antaran' && styles.labelActive]}>Antaran</Text>
        </Pressable>

        <SideTab icon={User} label="Profil" active={active === 'profil'} onPress={() => onChange('profil')} />
      </View>
    </SafeAreaView>
  );
}

function SideTab({
  icon: Icon,
  label,
  active,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.tab}>
      <Icon size={24} color={active ? colors.text : colors.textSubtle} strokeWidth={active ? 2.25 : 1.75} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  tab: {
    width: 80,
    alignItems: 'center',
    gap: 4,
  },
  center: {
    alignItems: 'center',
    gap: 2,
  },
  centerRing: {
    width: 68,
    height: 68,
    marginTop: -34,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textSecondary,
  },
  centerButtonActive: {
    backgroundColor: colors.primary,
    shadowColor: '#0f172a',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSubtle,
  },
  labelActive: {
    fontWeight: '700',
    color: colors.text,
  },
});
