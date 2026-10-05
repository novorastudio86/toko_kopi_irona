import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import type { OnlineStatus } from '@/kasir/types/online';

export const ONLINE_STATUS_LABELS: Record<OnlineStatus, string> = {
  masuk: 'Pesanan Baru',
  dibuat: 'Sedang Dibuat',
  siap_diantar: 'Siap Diantar',
  diantar: 'Sedang Diantar',
  selesai: 'Selesai',
  dibatalkan: 'Ditolak',
};

const STATUS_COLORS: Record<OnlineStatus, { text: string; bg: string }> = {
  masuk: { text: colors.danger, bg: colors.dangerBg },
  dibuat: { text: colors.warning, bg: colors.warningBg },
  siap_diantar: { text: colors.info, bg: colors.infoBg },
  diantar: { text: colors.info, bg: colors.infoBg },
  selesai: { text: colors.success, bg: colors.successBg },
  dibatalkan: { text: colors.textMuted, bg: colors.surfaceMuted },
};

/** Label status pesanan online berwarna */
export default function OnlineStatusBadge({ status }: { status: OnlineStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{ONLINE_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
