import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmployeePicker from '@/components/EmployeePicker';
import PinPad, { PIN_LENGTH } from '@/components/PinPad';
import { colors } from '@/constants/colors';
import { fetchAppEmployees, verifyEmployeePin } from '@/services/employees';
import type { ActiveEmployee, AppEmployee } from '@/types/employee';
import type { AppRole } from '@/types/role';

interface EmployeeLoginScreenProps {
  role: AppRole;
  onBack: () => void;
  onSignedIn: (employee: ActiveEmployee) => void;
}

const ROLE_TITLES: Record<AppRole, string> = { kasir: 'Masuk Kasir', driver: 'Masuk Driver' };

/** Pilih nama karyawan (sesuai peran) lalu masukkan PIN 6 digit */
export default function EmployeeLoginScreen({ role, onBack, onSignedIn }: EmployeeLoginScreenProps) {
  const [employees, setEmployees] = useState<AppEmployee[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<AppEmployee | null>(null);
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Ambil daftar nama sekali saat layar dibuka
  useEffect(() => {
    fetchAppEmployees(role)
      .then(setEmployees)
      .catch((err: Error) => setMessage(err.message))
      .finally(() => setLoadingList(false));
  }, [role]);

  // Hitung mundur selama PIN terkunci
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const lockSeconds = lockedUntil ? Math.ceil((lockedUntil.getTime() - now) / 1000) : 0;
  const locked = lockSeconds > 0;

  // PIN lengkap 6 digit → langsung dicek, tanpa tombol "Masuk"
  function handlePinChange(value: string) {
    setPin(value);
    if (value.length === PIN_LENGTH && selected) checkPin(selected, value);
  }

  async function checkPin(employee: AppEmployee, value: string) {
    setChecking(true);
    setMessage(null);
    try {
      const result = await verifyEmployeePin(employee.id, value, role);
      if (result.ok) {
        onSignedIn(result.employee);
        return;
      }
      setPin('');
      if (result.lockedUntil) {
        setLockedUntil(new Date(result.lockedUntil));
        setNow(Date.now());
        setMessage('Terlalu banyak salah. PIN dikunci sementara.');
      } else {
        setMessage(`PIN salah. Sisa ${result.attemptsLeft} kali percobaan.`);
      }
    } catch (err) {
      setPin('');
      setMessage(err instanceof Error ? err.message : 'Gagal memeriksa PIN.');
    } finally {
      setChecking(false);
    }
  }

  function handleSelect(employee: AppEmployee) {
    setSelected(employee);
    setPin('');
    setMessage(null);
    setLockedUntil(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
          <Text style={styles.backText}>‹ Ganti peran</Text>
        </Pressable>

        <Text style={styles.title}>{ROLE_TITLES[role]}</Text>
        <Text style={styles.subtitle}>Pilih namamu, lalu masukkan PIN 6 digit.</Text>

        {loadingList ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : employees.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Belum ada karyawan {role === 'kasir' ? 'Kasir' : 'Driver'} yang aktif. Tambahkan
              dari Web Admin → Daftar Karyawan.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.picker}>
              <EmployeePicker employees={employees} selected={selected} onSelect={handleSelect} />
            </View>

            {selected ? (
              <View style={styles.pinArea}>
                <Text style={styles.pinLabel}>PIN untuk {selected.fullName}</Text>
                <PinPad value={pin} onChange={handlePinChange} disabled={checking || locked} />
                {checking ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
            ) : null}
          </>
        )}

        {message ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>
              {message}
              {locked ? ` Coba lagi dalam ${lockSeconds} detik.` : ''}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  title: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
  },
  loading: {
    marginTop: 40,
  },
  emptyBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  picker: {
    marginTop: 24,
  },
  pinArea: {
    marginTop: 28,
    alignItems: 'center',
    gap: 16,
  },
  pinLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  messageBox: {
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
});