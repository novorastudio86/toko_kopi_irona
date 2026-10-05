import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bluetooth, CheckCircle2, Info, Printer } from 'lucide-react-native';
import PrimaryButton from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import {
  findPairedPrinters,
  getSavedPrinter,
  isPrinterSupported,
  savePrinter,
  sendToPrinter,
} from '@/kasir/services/printer';
import type { SavedPrinter } from '@/kasir/types/printer';
import { buildReceiptBytes } from '@/kasir/utils/receiptBytes';

/** Baris tes cetak: garis penuh 32 karakter untuk cek lebar kertas 58 mm */
const TEST_LINES = [
  '================================',
  '        TES PRINTER IRONA       ',
  '================================',
  'Jika garis di atas pas 1 baris,',
  'printer siap dipakai (58 mm).',
  '--------------------------------',
];

/** Menu Printer: pilih printer Bluetooth yang sudah di-pairing + tes cetak */
export default function PrinterSettingsScreen() {
  const supported = isPrinterSupported();
  const [saved, setSaved] = useState<SavedPrinter | null>(null);
  const [devices, setDevices] = useState<SavedPrinter[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getSavedPrinter().then(setSaved);
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan.' });
    } finally {
      setBusy(false);
    }
  }

  async function choose(device: SavedPrinter) {
    await savePrinter(device);
    setSaved(device);
    setMessage({ type: 'success', text: `${device.name} dipilih sebagai printer struk.` });
  }

  if (!supported) {
    return (
      <View style={styles.notice}>
        <Info size={20} color={colors.textSecondary} />
        <View style={styles.noticeText}>
          <Text style={styles.noticeTitle}>Printer belum bisa dipakai di Expo Go</Text>
          <Text style={styles.noticeBody}>
            Mencetak ke printer Bluetooth butuh aplikasi Irona Kasir (development build) yang
            dipasang di tablet kasir. Semua pengaturannya sudah disiapkan; tinggal di-build saat
            tablet & printernya sudah ada.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.current}>
        <Printer size={22} color={colors.textSecondary} />
        <View style={styles.currentText}>
          <Text style={styles.label}>Printer struk</Text>
          <Text style={styles.currentName}>{saved ? saved.name : 'Belum dipilih'}</Text>
          {saved ? <Text style={styles.address}>{saved.address}</Text> : null}
        </View>
        {saved ? (
          <Pressable
            onPress={() => run(() => sendToPrinter(buildReceiptBytes(TEST_LINES)))}
            disabled={busy}
            style={({ pressed }) => [styles.testButton, pressed && styles.pressed]}
          >
            <Text style={styles.testText}>Tes Cetak</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.hint}>
        Pairing printer dulu di Pengaturan tablet → Koneksi → Bluetooth, lalu tekan tombol di
        bawah untuk memilihnya.
      </Text>
      <PrimaryButton
        title="Cari printer yang sudah di-pairing"
        loading={busy}
        onPress={() => run(async () => setDevices(await findPairedPrinters()))}
      />

      {devices.map((d) => (
        <Pressable
          key={d.address}
          onPress={() => choose(d)}
          style={({ pressed }) => [styles.device, pressed && styles.pressed]}
        >
          <Bluetooth size={18} color={colors.textSecondary} />
          <View style={styles.deviceText}>
            <Text style={styles.deviceName}>{d.name}</Text>
            <Text style={styles.address}>{d.address}</Text>
          </View>
          {saved?.address === d.address ? <CheckCircle2 size={18} color={colors.success} /> : null}
        </Pressable>
      ))}

      {busy ? <ActivityIndicator color={colors.primary} /> : null}
      {message ? (
        <Text style={message.type === 'error' ? styles.error : styles.success}>{message.text}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 560,
    gap: 14,
  },
  notice: {
    maxWidth: 560,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  noticeText: {
    flex: 1,
    gap: 4,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  currentText: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  currentName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  address: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  testButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  testText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  deviceText: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  success: {
    fontSize: 13,
    color: colors.success,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});