import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import type { OnlineStatus } from '@/kasir/types/online';

const STEPS: { status: OnlineStatus; label: string }[] = [
  { status: 'masuk', label: 'Masuk' },
  { status: 'dibuat', label: 'Dibuat' },
  { status: 'siap_diantar', label: 'Siap' },
  { status: 'diantar', label: 'Diantar' },
  { status: 'selesai', label: 'Selesai' },
];

/** Tahapan pesanan: Masuk → Dibuat → Siap → Diantar → Selesai */
export default function OnlineStatusStepper({ status }: { status: OnlineStatus }) {
  const current = STEPS.findIndex((s) => s.status === status);

  return (
    <View style={styles.row}>
      {STEPS.map((step, i) => {
        const done = i < current || status === 'selesai';
        const active = i === current && status !== 'selesai';
        return (
          <Fragment key={step.status}>
            {i > 0 ? <View style={[styles.line, i <= current && styles.lineDone]} /> : null}
            <View style={styles.step}>
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                {done ? (
                  <Check size={14} color={colors.textOnDark} strokeWidth={3} />
                ) : (
                  <Text style={[styles.dotText, active && styles.dotTextActive]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.label, (done || active) && styles.labelActive]}>{step.label}</Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    alignItems: 'center',
    gap: 4,
    width: 52,
  },
  line: {
    flex: 1,
    height: 2,
    marginTop: 13,
    backgroundColor: colors.border,
  },
  lineDone: {
    backgroundColor: colors.success,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  dotActive: {
    borderColor: colors.primary,
  },
  dotText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSubtle,
  },
  dotTextActive: {
    color: colors.primary,
  },
  label: {
    fontSize: 11,
    color: colors.textSubtle,
  },
  labelActive: {
    fontWeight: '700',
    color: colors.text,
  },
});
