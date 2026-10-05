import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';

interface RoleCardProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}

/** Kartu besar yang bisa ditekan untuk memilih peran */
export default function RoleCard({ icon, title, description, onPress }: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.textBox}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    // Bayangan tipis seperti kartu di Web Admin
    shadowColor: colors.primary,
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardPressed: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    transform: [{ scale: 0.98 }],
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 26,
  },
  textBox: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  arrow: {
    fontSize: 28,
    color: colors.textSubtle,
  },
});