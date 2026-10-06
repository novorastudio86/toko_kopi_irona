import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/colors';
import type { LatLng } from '@/types/store';

interface StaticRouteMapProps {
  from: LatLng;
  to: LatLng;
  lineColor: string;
  /** Penanda titik awal & tujuan (digambar di tengah titiknya) */
  fromMarker: ReactNode;
  toMarker: ReactNode;
  /** Ruang kosong di atas peta (mis. untuk chip & tombol yang menumpuk) */
  paddingTop?: number;
}

const TILE = 256;
// Kepingan diambil 1 tingkat lebih detail lalu ditampilkan setengah ukuran → tajam di layar HP
const TILE_SHOWN = TILE / 2;
const MAX_ZOOM = 17;
const PADDING_X = 36;
const PADDING_Y = 24; // ruang untuk lengkungan garis & penanda

// Peta OpenStreetMap standar: gratis tanpa API key. Kebijakan OSM mewajibkan aplikasi menyebut
// identitasnya (User-Agent), menyimpan cache, dan mencantumkan atribusi di pojok peta.
// Pakai expo-image: Image bawaan React Native di Android tidak mengirim header ini, sehingga
// OSM membalas gambar "Access blocked 403".
const tileSource = (z: number, x: number, y: number) => ({
  uri: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  headers: { 'User-Agent': 'IronaKopiApp/1.0 (Kasir & Driver Irona Kopi)' },
});

/** Koordinat → piksel "dunia" Web Mercator pada zoom tertentu */
function project(p: LatLng, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((p.latitude * Math.PI) / 180);
  return {
    x: ((p.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/**
 * Peta pratinjau statis: kepingan peta asli disusun sebagai gambar + penanda & garis di atasnya.
 * Tidak memakai modul peta native, jadi tampil sama di Expo Go maupun build (tanpa API key).
 */
export default function StaticRouteMap({
  from,
  to,
  lineColor,
  fromMarker,
  toMarker,
  paddingTop = 0,
}: StaticRouteMapProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  }

  let content: ReactNode = null;
  if (size) {
    const usableW = size.width - PADDING_X * 2;
    const usableH = size.height - PADDING_Y * 2 - paddingTop;

    // Zoom terbesar yang masih memuat kedua titik
    let zoom = MAX_ZOOM;
    while (zoom > 1) {
      const a = project(from, zoom);
      const b = project(to, zoom);
      if (Math.abs(a.x - b.x) <= usableW && Math.abs(a.y - b.y) <= usableH) break;
      zoom -= 1;
    }

    const a = project(from, zoom);
    const b = project(to, zoom);
    const left = (a.x + b.x) / 2 - size.width / 2;
    const top = (a.y + b.y) / 2 - (size.height + paddingTop) / 2;

    // Kepingan di zoom+1: tiap keping menutupi TILE_SHOWN piksel layar
    const tileZoom = zoom + 1;
    const maxTile = 2 ** tileZoom;
    const tiles: { key: string; x: number; y: number; z: number; tx: number; ty: number }[] = [];
    for (let tx = Math.floor(left / TILE_SHOWN); tx <= Math.floor((left + size.width) / TILE_SHOWN); tx++) {
      for (let ty = Math.floor(top / TILE_SHOWN); ty <= Math.floor((top + size.height) / TILE_SHOWN); ty++) {
        if (ty < 0 || ty >= maxTile) continue;
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        tiles.push({ key: `${tx}-${ty}`, x: tx * TILE_SHOWN - left, y: ty * TILE_SHOWN - top, z: tileZoom, tx: wrappedX, ty });
      }
    }

    const p1 = { x: a.x - left, y: a.y - top };
    const p2 = { x: b.x - left, y: b.y - top };

    // Garis rute melengkung (seperti desain Figma): titik kendali digeser tegak lurus 20% panjang
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const ctrl = { x: (p1.x + p2.x) / 2 - dy * 0.2, y: (p1.y + p2.y) / 2 + dx * 0.2 };
    const curve = `M${p1.x} ${p1.y} Q${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`;

    content = (
      <>
        {tiles.map((t) => (
          <Image
            key={t.key}
            source={tileSource(t.z, t.tx, t.ty)}
            cachePolicy="memory-disk"
            transition={150}
            style={[styles.tile, { left: t.x, top: t.y }]}
          />
        ))}
        <Svg style={StyleSheet.absoluteFill}>
          {/* Garis putih di bawah supaya rute tetap terbaca di atas jalan berwarna */}
          <Path d={curve} stroke="#ffffff" strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.9} />
          <Path
            d={curve}
            stroke={lineColor}
            strokeWidth={4}
            strokeDasharray="10 7"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        <View style={[styles.marker, { left: p1.x, top: p1.y }]}>{fromMarker}</View>
        <View style={[styles.marker, { left: p2.x, top: p2.y }]}>{toMarker}</View>
      </>
    );
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {content}
      <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
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
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  tile: {
    position: 'absolute',
    width: TILE_SHOWN,
    height: TILE_SHOWN,
  },
  // Kotak 0×0 di titik koordinat; isinya digeser ke tengah
  marker: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  attribution: {
    position: 'absolute',
    right: 4,
    bottom: 2,
    paddingHorizontal: 4,
    fontSize: 9,
    color: colors.textMuted,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});
