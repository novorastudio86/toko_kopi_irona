import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import {
  fetchActiveDeliveries,
  fetchDutyStatus,
  subscribeDeliveryEvents,
} from '@/driver/services/deliveries';
import type { DeliveryTask, DutyStatus } from '@/driver/types/delivery';

/**
 * Tugas antar milik driver + status bertugas, selalu terbarui secara real-time.
 * HP bergetar & titik notifikasi menyala kalau kasir menugaskan pesanan baru.
 */
export function useDriverTasks(driverId: string) {
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [duty, setDuty] = useState<DutyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNewTask, setHasNewTask] = useState(false);
  // null = belum pernah dimuat (muatan pertama tidak dianggap tugas baru)
  const knownIds = useRef<Set<string> | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [list, status] = await Promise.all([
        fetchActiveDeliveries(driverId),
        fetchDutyStatus(driverId),
      ]);
      if (knownIds.current && list.some((t) => !knownIds.current!.has(t.transactionId))) {
        Vibration.vibrate([0, 400, 200, 400]);
        setHasNewTask(true);
      }
      knownIds.current = new Set(list.map((t) => t.transactionId));
      setTasks(list);
      setDuty(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat tugas antar.');
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    reload();
    return subscribeDeliveryEvents(reload);
  }, [reload]);

  return {
    tasks,
    duty,
    loading,
    error,
    reload,
    hasNewTask,
    clearNewTask: () => setHasNewTask(false),
  };
}

export type DriverTasksApi = ReturnType<typeof useDriverTasks>;
