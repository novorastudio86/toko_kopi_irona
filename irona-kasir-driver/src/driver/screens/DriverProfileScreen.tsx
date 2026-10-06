import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import PrimaryButton from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import type { DutyStatus } from '@/driver/types/delivery';
import type { ActiveEmployee } from '@/types/employee';

interface DriverProfileScreenProps {
  employee: ActiveEmployee;
  duty: DutyStatus | null;
  onSwitchEmployee: () => void;
}

const formatTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

/** Tab Profil: identitas driver, absensi hari ini, ganti karyawan */
export default function DriverProfileScreen({ employee, duty, onSwitchEmployee }: DriverProfileScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{employee.fullName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{employee.fullName}</Text>
        <Text style={styles.role}>Driver</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Clock size={16} color={colors.textMuted} />
          <Text style={styles.sectionTitle}>Absensi Hari Ini</Text>
        </View>
        <View style={styles.attendance}>
          <View style={styles.attItem}>
            <Text style={styles.attLabel}>Masuk</Text>
            <Text style={styles.attValue}>{formatTime(duty?.checkIn ?? null)}</Text>
          </View>
          <View style={styles.attItem}>
            <Text style={styles.attLabel}>Pulang</Text>
            <Text style={styles.attValue}>{formatTime(duty?.checkOut ?? null)}</Text>
          </View>
        </View>
        <Text style={styles.hint}>Absen masuk & pulang dengan scan QR di tablet kasir.</Text>
      </View>

      <PrimaryButton title="Ganti Karyawan" onPress={onSwitchEmployee} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
    padding: 20,
  },
  card: {
    alignItems: 'center',
    gap: 6,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  role: {
    fontSize: 13,
    color: colors.textMuted,
  },
  titleRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  attendance: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 4,
  },
  attItem: {
    flex: 1,
    gap: 2,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  attLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  attValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    alignSelf: 'flex-start',
    fontSize: 12,
    color: colors.textMuted,
  },
});
