import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrientationLock } from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/constants/colors';
import { useResponsive } from '@/hooks/useResponsive';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import KasirSidebar from '@/kasir/components/KasirSidebar';
import SidebarToggle from '@/kasir/components/SidebarToggle';
import { useOnlineOrders } from '@/kasir/hooks/useOnlineOrders';
import AttendanceScreen from '@/kasir/screens/AttendanceScreen';
import HistoryScreen from '@/kasir/screens/HistoryScreen';
import MenuScreen from '@/kasir/screens/MenuScreen';
import OnlineScreen from '@/kasir/screens/OnlineScreen';
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

/** Kerangka halaman Kasir: isi menu yang dipilih; sidebar muncul sebagai laci dari kiri */
export default function KasirShell({ employee, onSwitchEmployee }: KasirShellProps) {
  // Kasir memakai tablet mendatar (Galaxy Tab A8)
  useScreenOrientation(OrientationLock.LANDSCAPE);
  const [section, setSection] = useState<KasirSection>('menu');
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Sidebar tersembunyi secara bawaan supaya area menu lebih lega
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Pesanan online didengarkan terus (bukan hanya saat menu Online dibuka) untuk badge sidebar
  const online = useOnlineOrders();
  const { gutter } = useResponsive();

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

  const sidebarToggle = <SidebarToggle badge={online.newCount} onPress={() => setSidebarOpen(true)} />;

  return (
    <View style={styles.container}>
      {/* Layar penuh seperti mesin POS: status bar disembunyikan */}
      <StatusBar hidden />

      {/* Menu mengatur jarak bawahnya sendiri supaya grid bisa digulir sampai tepi layar */}
      <SafeAreaView
        edges={section === 'menu' ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
        style={[styles.content, { padding: gutter }, section === 'menu' && { paddingBottom: 0 }]}
      >
        {/* Menu punya bar atas sendiri (☰ + cari + jam), jadi tidak perlu judul */}
        {section !== 'menu' ? (
          <View style={styles.titleRow}>
            {sidebarToggle}
            <Text style={styles.title}>{SECTION_TITLES[section]}</Text>
          </View>
        ) : null}

        {/* Menu selalu dipasang (hanya disembunyikan) supaya pesanan yang sedang dibuat
            tidak hilang saat kasir membuka Absensi / Histori sebentar */}
        <View style={[styles.body, styles.bodyFull, section !== 'menu' && styles.hidden]}>
          <MenuScreen sessionId={sessionId} sidebarToggle={sidebarToggle} />
        </View>

        {section !== 'menu' ? (
          <View style={styles.body}>
            {section === 'online' ? (
              <OnlineScreen online={online} sessionId={sessionId} />
            ) : section === 'histori' ? (
              <HistoryScreen />
            ) : section === 'absensi' ? (
              <AttendanceScreen />
            ) : section === 'printer' ? (
              <PrinterSettingsScreen />
            ) : null}
          </View>
        ) : null}
      </SafeAreaView>

      {sidebarOpen ? (
        <>
          <Pressable
            style={styles.backdrop}
            onPress={() => setSidebarOpen(false)}
            accessibilityLabel="Tutup menu samping"
          />
          <View style={styles.drawer}>
            <KasirSidebar
              active={section}
              onChange={(s) => {
                setSection(s);
                setSidebarOpen(false);
              }}
              employeeName={employee.fullName}
              onlineBadge={online.newCount}
              onSwitchEmployee={handleSwitchEmployee}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
});