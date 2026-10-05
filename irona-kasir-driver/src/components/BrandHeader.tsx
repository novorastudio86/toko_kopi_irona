import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';

interface BrandHeaderProps {
  title: string;
  subtitle: string;
}

/** Panel foto gelap + logo di atas layar, sama seperti halaman login Web Admin */
export default function BrandHeader({ title, subtitle }: BrandHeaderProps) {
  return (
    <ImageBackground
      source={require('../../assets/images/hero.png')}
      style={styles.hero}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.brand}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>Toko Kopi Irona</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 10, 10, 0.7)', // gelapkan foto agar teks terbaca
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 40,
  },
  logo: {
    width: 64,
    height: 36, // logo berukuran 16:9
  },
  brandName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textOnDark,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSubtle,
  },
});