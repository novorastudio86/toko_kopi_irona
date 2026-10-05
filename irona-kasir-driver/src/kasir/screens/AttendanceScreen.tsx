import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { RefreshCw, ScanLine } from 'lucide-react-native';
import PrimaryButton from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import ScanFeedback, { type ScanFeedbackState } from '@/kasir/components/ScanFeedback';
import { recordAttendanceScan } from '@/kasir/services/attendance';

const COOLDOWN_MS = 15000; // QR yang sama diabaikan selama 15 detik
const FEEDBACK_MS = 3500; // lama tampilan hijau/merah

interface RecentScan {
  id: number;
  name: string;
  action: 'masuk' | 'pulang';
  time: string;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/** Menu Absensi di Kasir: karyawan menunjukkan kartu QR ke kamera tablet */
export default function AttendanceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [now, setNow] = useState(() => new Date());
  const [feedback, setFeedback] = useState<ScanFeedbackState | null>(null);
  const [recent, setRecent] = useState<RecentScan[]>([]);

  // useRef: nilai yang diingat tanpa membuat layar digambar ulang
  const processingRef = useRef(false);
  const lastScanRef = useRef(new Map<string, number>());

  // Jam berjalan
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleScan(result: BarcodeScanningResult) {
    const text = result.data;
    // Kamera mengirim hasil berkali-kali per detik: abaikan selama masih memproses
    if (processingRef.current) return;
    const lastAt = lastScanRef.current.get(text);
    if (lastAt && Date.now() - lastAt < COOLDOWN_MS) return;

    processingRef.current = true;
    lastScanRef.current.set(text, Date.now());
    try {
      const scan = await recordAttendanceScan(text);
      const time = formatClock(new Date());
      let note: string | undefined;
      if (scan.action === 'masuk' && scan.lateMinutes > 0) {
        note = `Telat ${scan.lateMinutes} menit`;
      } else if (scan.action === 'pulang' && scan.overtimeMinutes > 0) {
        note =
          scan.overtimePendingMinutes > 0
            ? `Lembur ${scan.overtimeMinutes} menit (lembur malam menunggu persetujuan admin)`
            : `Lembur ${scan.overtimeMinutes} menit`;
      }
      setFeedback({ type: 'success', name: scan.employeeName, action: scan.action, time, note });
      setRecent((list) =>
        [{ id: Date.now(), name: scan.employeeName, action: scan.action, time }, ...list].slice(0, 6)
      );
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal memproses scan.',
      });
    } finally {
      setTimeout(() => {
        setFeedback(null);
        processingRef.current = false;
      }, FEEDBACK_MS);
    }
  }

  return (
    <View style={styles.container}>
      {/* Kiri: kamera */}
      <View style={styles.cameraColumn}>
        <View style={styles.cameraBox}>
          {!permission ? null : !permission.granted ? (
            <View style={styles.permission}>
              <Text style={styles.permissionText}>
                Aplikasi butuh izin kamera untuk membaca kartu QR karyawan.
              </Text>
              <PrimaryButton title="Izinkan Kamera" onPress={requestPermission} />
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing={facing}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={feedback ? undefined : handleScan}
              />
              {!feedback ? <View style={styles.frame} /> : null}
              {feedback ? <ScanFeedback feedback={feedback} /> : null}
            </>
          )}
        </View>

        <Pressable
          onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
          style={({ pressed }) => [styles.flip, pressed && styles.flipPressed]}
        >
          <RefreshCw size={16} color={colors.textSecondary} />
          <Text style={styles.flipText}>
            Pakai kamera {facing === 'front' ? 'belakang' : 'depan'}
          </Text>
        </Pressable>
      </View>

      {/* Kanan: jam, petunjuk, absen terakhir */}
      <View style={styles.infoColumn}>
        <Text style={styles.clock}>
          {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>
        <Text style={styles.date}>
          {now.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>

        <View style={styles.hint}>
          <ScanLine size={18} color={colors.textMuted} />
          <Text style={styles.hintText}>
            Tunjukkan kartu QR ke kamera untuk absen masuk atau pulang. Scan pertama hari itu =
            masuk, scan berikutnya = pulang.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Absen terakhir di perangkat ini</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>Belum ada yang absen.</Text>
        ) : (
          recent.map((r) => (
            <View key={r.id} style={styles.recentRow}>
              <Text style={styles.recentName}>{r.name}</Text>
              <Text style={[styles.recentAction, r.action === 'pulang' && styles.recentPulang]}>
                {r.action === 'masuk' ? 'Masuk' : 'Pulang'} · {r.time}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    gap: 32,
  },
  cameraColumn: {
    alignItems: 'center',
    gap: 12,
  },
  cameraBox: {
    width: 420,
    height: 420,
    borderRadius: 24,
    overflow: 'hidden', // kamera ikut sudut membulat
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.border,
  },
  frame: {
    position: 'absolute',
    top: 60,
    left: 60,
    right: 60,
    bottom: 60,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  permission: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 15,
    color: colors.textOnDark,
  },
  flip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  flipPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  flipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  infoColumn: {
    flex: 1,
  },
  clock: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'], // angka tidak "goyang" saat detik berganti
  },
  date: {
    fontSize: 16,
    color: colors.textMuted,
  },
  hint: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  empty: {
    fontSize: 14,
    color: colors.textSubtle,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  recentAction: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  recentPulang: {
    color: colors.textSecondary,
  },
});