import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bike, Check, Flag, MapPin, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/constants/colors';

const STEPS: { label: string; icon: LucideIcon }[] = [
  { label: 'Terima', icon: Check },
  { label: 'Menuju Lokasi', icon: Bike },
  { label: 'Tiba', icon: MapPin },
  { label: 'Selesai', icon: Flag },
];

const ACTIVE = '#d97706';

/**
 * Tahapan antar di bawah pop-up detail (Figma): Terima → Menuju Lokasi → Tiba → Selesai.
 * current = tahap yang sedang dikerjakan (0–3); 4 = semua selesai.
 */
export default function DeliveryStepper({ current }: { current: number }) {
  return (
    <View style={styles.row}>
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = done ? Check : step.icon;
        return (
          <Fragment key={step.label}>
            {i > 0 ? <View style={[styles.line, i <= current && styles.lineDone]} /> : null}
            <View style={styles.step}>
              <View style={[styles.circle, done && styles.circleDone, active && styles.circleActive]}>
                {done || active ? (
                  <Icon size={14} color={colors.textOnDark} strokeWidth={2.5} />
                ) : (
                  <Text style={styles.number}>{i + 1}</Text>
                )}
              </View>
              <Text
                style={[styles.label, done && styles.labelDone, active && styles.labelActive]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
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
    width: 76,
    alignItems: 'center',
    gap: 4,
  },
  line: {
    flex: 1,
    height: 3,
    marginTop: 13,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  lineDone: {
    backgroundColor: colors.success,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  circleDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  circleActive: {
    borderColor: ACTIVE,
    backgroundColor: ACTIVE,
  },
  number: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSubtle,
  },
  label: {
    fontSize: 11,
    color: colors.textSubtle,
  },
  labelDone: {
    color: colors.success,
    fontWeight: '600',
  },
  labelActive: {
    color: ACTIVE,
    fontWeight: '700',
  },
});
