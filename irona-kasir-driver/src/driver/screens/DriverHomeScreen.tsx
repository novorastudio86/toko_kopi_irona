import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrientationLock } from 'expo-screen-orientation';
import PrimaryButton from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import type { ActiveEmployee } from '@/types/employee';

interface DriverHomeScreenProps {
  employee: ActiveEmployee;
  onSwitchEmployee: () => void;
}

/** Sementara: halaman Driver. Nanti diganti daftar pesanan antar. */
export default function DriverHomeScreen({ employee, onSwitchEmployee }: DriverHomeScreenProps) {
  // Driver memakai HP tegak
  useScreenOrientation(OrientationLock.PORTRAIT_UP);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.badge}>DRIVER</Text>
        <Text style={styles.title}>Halo, {employee.fullName} 👋</Text>
        <Text style={styles.subtitle}>Halaman Driver akan kita buat setelah halaman Kasir.</Text>
      </View>
      <PrimaryButton title="Ganti Karyawan" onPress={onSwitchEmployee} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
    color: colors.textOnDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    overflow: 'hidden',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
});