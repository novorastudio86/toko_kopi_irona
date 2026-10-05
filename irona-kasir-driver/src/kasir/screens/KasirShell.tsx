import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrientationLock } from 'expo-screen-orientation';
import { colors } from '@/constants/colors';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import KasirSidebar from '@/kasir/components/KasirSidebar';
import AttendanceScreen from '@/kasir/screens/AttendanceScreen';
import HistoryScreen from '@/kasir/screens/HistoryScreen';
import MenuScreen from '@/kasir/screens/MenuScreen';
import PrinterSettingsScreen from '@/kasir/screens/PrinterSettingsScreen';
import { endCashierSession, startCashierSession } from '@/kasir/services/cashierSession';
import type { KasirSection } from '@/kasir/types/section';
import type { ActiveEmployee } from '@/types/employee';

interface KasirShellProps {
  employee: ActiveEmployee;
  onSwitchEmployee: () => void;
}

const SECTION_TITLES: Record<KasirSection, string> = {
  menu: 'Menu',
  online: 'Pesanan Online',
  histori: 'Histori Transaksi',
  absensi: 'Absensi',
  printer: 'Printer',
};

/** Kerangka halaman Kasir: sidebar di kiri, isi menu yang dipilih di kanan */
export default function KasirShell({ employee, onSwitchEmployee }: KasirShellProps) {
  // Kasir memakai tablet mendatar (Galaxy Tab A8)
  useScreenOrientation(OrientationLock.LANDSCAPE);
  const [section, setSection] = useState<KasirSection>('menu');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Buka sesi kasir sekali saat kasir masuk (untuk Laporan Pendapatan Kasir & Jam Operasional)
  useEffect(() => {
    startCashierSession(employee.id)
      .then(setSessionId)
      .catch((err: Error) => Alert.alert('Gagal membuka sesi kasir', err.message));
  }, [employee.id]);

  async function handleSwitchEmployee() {
    // Tutup sesi dulu; kalau gagal (mis. offline) tetap lanjut, sesi ditutup otomatis saat masuk lagi
    if (sessionId) await endCashierSession(sessionId).catch(() => undefined);
    onSwitchEmployee();
  }

  return (
    <View style={styles.container}>
      <KasirSidebar
        active={section}
        onChange={setSection}
        employeeName={employee.fullName}
        onSwitchEmployee={handleSwitchEmployee}
      />

      <SafeAreaView edges={['top', 'bottom', 'right']} style={styles.content}>
        {/* Menu punya bar atas sendiri (cari + jam), jadi tidak perlu judul */}
        {section !== 'menu' ? <Text style={styles.title}>{SECTION_TITLES[section]}</Text> : null}

        {/* Menu selalu dipasang (hanya disembunyikan) supaya pesanan yang sedang dibuat
            tidak hilang saat kasir membuka Absensi / Histori sebentar */}
        <View style={[styles.body, styles.bodyFull, section !== 'menu' && styles.hidden]}>
          <MenuScreen sessionId={sessionId} />
        </View>

        {section !== 'menu' ? (
          <View style={styles.body}>
            {section === 'histori' ? (
              <HistoryScreen />
            ) : section === 'absensi' ? (
              <AttendanceScreen />
            ) : section === 'printer' ? (
              <PrinterSettingsScreen />
            ) : (
              // Sementara: menu lain dibuat di langkah berikutnya
              <Text style={styles.subtitle}>Halaman ini akan dibuat di langkah berikutnya.</Text>
            )}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row', // sidebar dan isi berdampingan
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    flex: 1,
    marginTop: 20,
  },
  bodyFull: {
    marginTop: 0,
  },
  hidden: {
    display: 'none',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
  },
});