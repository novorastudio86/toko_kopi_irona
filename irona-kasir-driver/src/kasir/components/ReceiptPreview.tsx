import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { fetchReceiptConfig } from '@/kasir/services/receipt';
import type { OrderReceipt } from '@/kasir/types/order';
import type { ReceiptSettings, StoreProfile } from '@/kasir/types/receipt';
import { RECEIPT_CHARS, buildReceiptLines } from '@/kasir/utils/receiptLines';

/** Font dengan lebar huruf seragam, supaya kolom kiri–kanan struk sejajar seperti di printer */
const MONO_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });
const FONT_SIZE = 12;

/** Tampilan kertas struk, sesuai Pengaturan Struk & Data Toko di Web Admin */
export default function ReceiptPreview({ receipt }: { receipt: OrderReceipt }) {
  const [config, setConfig] = useState<{ settings: ReceiptSettings; store: StoreProfile } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReceiptConfig()
      .then(setConfig)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <Text style={styles.error}>Gagal memuat pengaturan struk: {error}</Text>;
  if (!config) return <ActivityIndicator color={colors.primary} />;

  const { settings, store } = config;
  const chars = RECEIPT_CHARS[settings.paperWidth];
  const lines = buildReceiptLines(settings, store, receipt);

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.paper}>
          {settings.showLogo ? (
            store.logoUrl ? (
              <Image
                source={{ uri: store.logoUrl }}
                style={settings.logoMode === 'penuh' ? styles.logoFull : styles.logo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>LOGO</Text>
              </View>
            )
          ) : null}
        <Text style={styles.text} allowFontScaling={false}>
            {lines.join('\n')}
        </Text>
        </View>
      </ScrollView>
      <Text style={styles.caption}>
        Kertas {settings.paperWidth} mm · {chars} karakter/baris
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  paper: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 2,
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  logo: {
    alignSelf: 'stretch', // selebar kertas...
    marginHorizontal: 32, // ...dikurangi jarak kiri–kanan (mode Normal)
    height: 56,
    marginBottom: 8,
  },
  logoFull: {
    alignSelf: 'stretch', // selebar kertas penuh (mode Penuh)
    height: 80,
    marginBottom: 8,
  },
  logoPlaceholder: {
    alignSelf: 'center',
    width: 96,
    height: 48,
    marginBottom: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontSize: 10,
    color: colors.textSubtle,
  },
  text: {
    fontFamily: MONO_FONT,
    fontSize: FONT_SIZE,
    lineHeight: FONT_SIZE * 1.35,
    color: colors.text,
  },
  caption: {
    fontSize: 11,
    color: colors.textSubtle,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});