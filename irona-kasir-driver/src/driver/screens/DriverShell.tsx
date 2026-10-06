import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { OrientationLock } from 'expo-screen-orientation';
import { colors } from '@/constants/colors';
import DeliveryDetailSheet from '@/driver/components/DeliveryDetailSheet';
import DriverBottomNav from '@/driver/components/DriverBottomNav';
import DriverHeader from '@/driver/components/DriverHeader';
import { useDriverTasks } from '@/driver/hooks/useDriverTasks';
import DeliveryHistoryScreen from '@/driver/screens/DeliveryHistoryScreen';
import DeliveryListScreen from '@/driver/screens/DeliveryListScreen';
import DriverProfileScreen from '@/driver/screens/DriverProfileScreen';
import type { DriverTab } from '@/driver/types/delivery';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import type { ActiveEmployee } from '@/types/employee';

interface DriverShellProps {
  employee: ActiveEmployee;
  onSwitchEmployee: () => void;
}

/** Kerangka Driver App: header + isi tab + navigasi bawah; Detail sebagai pop-up */
export default function DriverShell({ employee, onSwitchEmployee }: DriverShellProps) {
  // Driver memakai HP tegak
  useScreenOrientation(OrientationLock.PORTRAIT_UP);
  const driver = useDriverTasks(employee.id);
  const [tab, setTab] = useState<DriverTab>('antaran');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Kalau pesanan yang dibuka dialihkan ke driver lain / selesai, otomatis kembali ke daftar
  const openTask = driver.tasks.find((t) => t.transactionId === openTaskId) ?? null;

  return (
    <View style={styles.container}>
      {/* Header gelap → teks status bar putih */}
      <StatusBar style="light" />
      <DriverHeader
        driverName={employee.fullName}
        duty={driver.duty}
        readyCount={driver.tasks.filter((t) => t.status === 'siap_diantar').length}
        hasNotification={driver.hasNewTask}
        onPressNotification={() => {
          driver.clearNewTask();
          setTab('antaran');
        }}
      />

      <View style={styles.body}>
        {tab === 'antaran' ? (
          <DeliveryListScreen driver={driver} onOpenTask={setOpenTaskId} />
        ) : tab === 'histori' ? (
          <DeliveryHistoryScreen driverId={employee.id} />
        ) : (
          <DriverProfileScreen employee={employee} duty={driver.duty} onSwitchEmployee={onSwitchEmployee} />
        )}
      </View>

      {/* Detail antaran muncul sebagai pop-up dari bawah */}
      <DeliveryDetailSheet
        task={openTask}
        driverId={employee.id}
        onClose={() => setOpenTaskId(null)}
        onChanged={driver.reload}
      />

      <DriverBottomNav
        active={tab}
        onChange={(next) => {
          if (next === 'antaran') driver.clearNewTask();
          setTab(next);
        }}
      />
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
  },
});
