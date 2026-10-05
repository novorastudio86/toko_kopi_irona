import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PrimaryButton from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import DriverHomeScreen from '@/driver/screens/DriverHomeScreen';
import KasirShell from '@/kasir/screens/KasirShell';
import EmployeeLoginScreen from '@/screens/EmployeeLoginScreen';
import OwnerLoginScreen from '@/screens/OwnerLoginScreen';
import RoleSelectScreen from '@/screens/RoleSelectScreen';
import { getSignedInOwner, signOutDevice } from '@/services/auth';
import type { OwnerProfile } from '@/types/auth';
import type { ActiveEmployee } from '@/types/employee';
import type { AppRole } from '@/types/role';

/**
 * Tahap aplikasi:
 * - checking      : mengecek apakah perangkat sudah pernah dibuka Owner
 * - offline       : gagal terhubung ke server saat mengecek
 * - ownerLogin    : belum ada Owner → tampilkan login Owner
 * - roleSelect    : Owner sudah login → pilih Kasir / Driver
 * - employeeLogin : pilih nama karyawan + PIN
 * - home          : karyawan sudah masuk (Kasir → KasirShell, Driver → DriverHomeScreen)
 */
type Stage =
  | { name: 'checking' }
  | { name: 'offline'; message: string }
  | { name: 'ownerLogin' }
  | { name: 'roleSelect'; owner: OwnerProfile }
  | { name: 'employeeLogin'; owner: OwnerProfile; role: AppRole }
  | { name: 'home'; owner: OwnerProfile; employee: ActiveEmployee };

export default function App() {
  const [stage, setStage] = useState<Stage>({ name: 'checking' });

  async function checkDevice() {
    setStage({ name: 'checking' });
    try {
      const owner = await getSignedInOwner();
      setStage(owner ? { name: 'roleSelect', owner } : { name: 'ownerLogin' });
    } catch (err) {
      setStage({
        name: 'offline',
        message: err instanceof Error ? err.message : 'Tidak bisa terhubung ke server.',
      });
    }
  }

  useEffect(() => {
    checkDevice();
  }, []);

  function handleSignOutDevice() {
    Alert.alert('Keluar perangkat?', 'Perangkat harus dibuka lagi dengan login Owner.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await signOutDevice();
          setStage({ name: 'ownerLogin' });
        },
      },
    ]);
  }

  return (
    <SafeAreaProvider>
      {stage.name === 'checking' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {stage.name === 'offline' && (
        <View style={[styles.center, styles.offline]}>
          <Text style={styles.offlineTitle}>Tidak ada koneksi</Text>
          <Text style={styles.offlineText}>{stage.message}</Text>
          <PrimaryButton title="Coba lagi" onPress={checkDevice} />
        </View>
      )}

      {stage.name === 'ownerLogin' && (
        <OwnerLoginScreen onSignedIn={(owner) => setStage({ name: 'roleSelect', owner })} />
      )}

      {stage.name === 'roleSelect' && (
        <RoleSelectScreen
          ownerName={stage.owner.fullName}
          onSelectRole={(role) => setStage({ name: 'employeeLogin', owner: stage.owner, role })}
          onSignOutDevice={handleSignOutDevice}
        />
      )}

      {stage.name === 'employeeLogin' && (
        <EmployeeLoginScreen
          role={stage.role}
          onBack={() => setStage({ name: 'roleSelect', owner: stage.owner })}
          onSignedIn={(employee) => setStage({ name: 'home', owner: stage.owner, employee })}
        />
      )}

      {stage.name === 'home' && stage.employee.role === 'kasir' && (
        <KasirShell
          employee={stage.employee}
          onSwitchEmployee={() =>
            setStage({ name: 'employeeLogin', owner: stage.owner, role: 'kasir' })
          }
        />
      )}

      {stage.name === 'home' && stage.employee.role === 'driver' && (
        <DriverHomeScreen
          employee={stage.employee}
          onSwitchEmployee={() =>
            setStage({ name: 'employeeLogin', owner: stage.owner, role: 'driver' })
          }
        />
      )}

      {/* Latar gelap (foto) → teks status bar putih; latar terang → teks gelap */}
      <StatusBar style={stage.name === 'ownerLogin' || stage.name === 'roleSelect' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  offline: {
    alignItems: 'stretch', // tombol "Coba lagi" selebar layar
    paddingHorizontal: 32,
    gap: 12,
  },
  offlineTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  offlineText: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
});