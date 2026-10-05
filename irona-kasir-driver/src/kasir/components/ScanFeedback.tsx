import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { colors } from '@/constants/colors';

export type ScanFeedbackState =
  | { type: 'success'; name: string; action: 'masuk' | 'pulang'; time: string; note?: string }
  | { type: 'error'; message: string };

/** Tampilan besar hijau (berhasil) / merah (gagal) di atas kamera setelah scan */
export default function ScanFeedback({ feedback }: { feedback: ScanFeedbackState }) {
  const success = feedback.type === 'success';
  const Icon = success ? CheckCircle2 : XCircle;

  return (
    <View style={[styles.overlay, success ? styles.success : styles.error]}>
      <Icon size={64} color={colors.textOnDark} />
      {feedback.type === 'success' ? (
        <>
          <Text style={styles.title}>
            {feedback.action === 'masuk' ? 'Selamat datang' : 'Sampai jumpa'}, {feedback.name}
          </Text>
          <Text style={styles.subtitle}>
            {feedback.action === 'masuk' ? 'Absen Masuk' : 'Absen Pulang'} · {feedback.time}
          </Text>
          {feedback.note ? <Text style={styles.note}>{feedback.note}</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.title}>Absen gagal</Text>
          <Text style={styles.subtitle}>{feedback.message}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  success: {
    backgroundColor: 'rgba(4, 120, 87, 0.95)', // hijau (colors.success)
  },
  error: {
    backgroundColor: 'rgba(190, 18, 60, 0.95)', // merah
  },
  title: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.textOnDark,
  },
  note: {
    textAlign: 'center',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
  },
});