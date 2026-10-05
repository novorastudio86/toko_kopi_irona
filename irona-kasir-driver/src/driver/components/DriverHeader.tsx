import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { DutyStatus } from '@/driver/types/delivery';

interface DriverHeaderProps {
  driverName: string;
  duty: DutyStatus | null;
  /** Jumlah pesanan siap diambil (kotak Antrean) */
  readyCount: number;
  hasNotification: boolean;
  onPressNotification: () => void;
}

/** Header gelap Driver App (Figma "Header"): logo, nama driver, status bertugas, antrean */
export default function DriverHeader({
  driverName,
  duty,
  readyCount,
  hasNotification,
  onPressNotification,
}: DriverHeaderProps) {
  const onDuty = duty?.onDuty ?? false;
  const dutyLabel = onDuty ? 'Bertugas' : duty?.checkOut ? 'Sudah pulang' : 'Belum absen';

  return (
    <SafeAreaView edges={['top']} style={styles.header}>
      <View style={styles.top}>
        <View style={styles.logoBox}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.identity}>
          <Text style={styles.title}>Driver Irona Kopi</Text>
          <View style={styles.identityRow}>
            <Text style={styles.name} numberOfLines={1}>
              {driverName}
            </Text>
            <View style={styles.separator} />
            <View style={[styles.pill, onDuty ? styles.pillOn : styles.pillOff]}>
              <View style={[styles.pillDot, { backgroundColor: onDuty ? '#34d399' : colors.textSubtle }]} />
              <Text style={[styles.pillText, { color: onDuty ? '#34d399' : colors.sidebarText }]}>{dutyLabel}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={onPressNotification}
          accessibilityLabel="Notifikasi tugas baru"
          style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
        >
          <Bell size={20} color={colors.sidebarTextActive} />
          {hasNotification ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>

      <View style={styles.queue}>
        <Text style={styles.queueLabel}>ANTREAN</Text>
        <Text style={styles.queueValue}>{readyCount} Siap Antar</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: colors.sidebar,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 8,
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sidebarItemActive,
  },
  logo: {
    width: 44,
    height: 44,
  },
  identity: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.sidebarTextActive,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.sidebarText,
  },
  separator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sidebarText,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillOn: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  pillOff: {
    borderColor: colors.sidebarBorder,
    backgroundColor: colors.sidebarItemActive,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.sidebarBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  pressed: {
    backgroundColor: colors.sidebarItemActive,
  },
  queue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.sidebarBorder,
    backgroundColor: colors.sidebarItemActive,
  },
  queueLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.sidebarText,
  },
  queueValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fbbf24',
  },
});
