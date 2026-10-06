import { useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { colors } from '@/constants/colors';
import type { LatLng } from '@/types/store';

interface GoogleStaticRouteMapProps {
  apiKey: string;
  from: LatLng;
  to: LatLng;
  /** Warna garis & penanda awal, format "#rrggbb" */
  lineColor: string;
  toColor: string;
  /** Gambar gagal dimuat (key salah, billing/API belum aktif, offline) */
  onError?: () => void;
}

// Static Maps menerima ukuran maks 640×640 (scale 2 → gambar tajam di layar HP)
const MAX_SIZE = 640;

const point = (p: LatLng) => `${p.latitude},${p.longitude}`;
const hex = (color: string) => `0x${color.replace('#', '')}`;

/**
 * Peta Google asli sebagai gambar (Google Maps Static API): penanda toko (T) & titik antar (A)
 * + garis di antaranya. Tanpa modul native, jadi jalan di Expo Go; zoom otomatis dari Google.
 */
export default function GoogleStaticRouteMap({
  apiKey,
  from,
  to,
  lineColor,
  toColor,
  onError,
}: GoogleStaticRouteMapProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  function handleLayout(e: LayoutChangeEvent) {
    const width = Math.round(e.nativeEvent.layout.width);
    const height = Math.round(e.nativeEvent.layout.height);
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  }

  const params = size
    ? [
        `size=${Math.min(size.width, MAX_SIZE)}x${Math.min(size.height, MAX_SIZE)}`,
        'scale=2',
        'maptype=roadmap',
        // Sembunyikan ikon tempat (POI) supaya peta bersih seperti pratinjau rute
        'style=feature:poi|visibility:off',
        `path=color:${hex(lineColor)}ff|weight:5|${point(from)}|${point(to)}`,
        `markers=color:${hex(lineColor)}|label:T|${point(from)}`,
        `markers=color:${hex(toColor)}|label:A|${point(to)}`,
        `key=${apiKey}`,
      ].join('&')
    : null;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {params ? (
        <Image
          source={{ uri: `https://maps.googleapis.com/maps/api/staticmap?${encodeURI(params)}` }}
          style={styles.image}
          resizeMode="cover"
          onError={onError}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surfaceMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
