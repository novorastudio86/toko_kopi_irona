import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { shortOrderNumber } from '@/driver/utils/deliveryFormat';

/** Badge No. pesanan hijau bergaya monospace (Figma "Order ID badge") */
export default function OrderNumberBadge({ number, full = false }: { number: string; full?: boolean }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{full ? number : shortOrderNumber(number)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: colors.successBg,
  },
  text: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
  },
});
