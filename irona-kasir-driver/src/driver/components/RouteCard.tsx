import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, MapPinOff, Navigation, Route, Store } from 'lucide-react-native';
import GoogleStaticRouteMap from '@/components/GoogleStaticRouteMap';
import StaticRouteMap from '@/components/StaticRouteMap';
import { colors } from '@/constants/colors';
import { estimateMinutes } from '@/driver/utils/deliveryFormat';
import { useStoreLocation } from '@/hooks/useStoreLocation';
import type { LatLng } from '@/types/store';
import { googleMapsDirectionsUrl, googleMapsUrl } from '@/utils/contactLinks';

interface RouteCardProps {
  address: string;
  distanceKm: number | null;
  /** Titik antar dari pin pelanggan; null untuk pesanan lama tanpa titik */
  destination: LatLng | null;
}

const ROUTE_COLOR = '#d97706';
const DEST_COLOR = colors.success;
// Opsional: isi di Doppler supaya peta memakai Google Maps (butuh billing Google Cloud).
// Kosong / gagal dimuat = peta gratis OpenStreetMap
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Kartu rute (Figma "map"): peta statis dengan titik toko & titik antar + garis lurus di antaranya.
 * Garis belum mengikuti jalan (butuh layanan rute); navigasi asli lewat tombol "Buka Maps".
 */
export default function RouteCard({ address, distanceKm, destination }: RouteCardProps) {
  const store = useStoreLocation();
  // Google gagal (mis. billing belum aktif) → pakai peta gratis OpenStreetMap
  const [googleFailed, setGoogleFailed] = useState(false);

  const openMaps = () =>
    Linking.openURL(
      destination ? googleMapsDirectionsUrl(destination.latitude, destination.longitude) : googleMapsUrl(address)
    );

  return (
    <View style={styles.card}>
      <View style={styles.map}>
        {store && destination && GOOGLE_MAPS_KEY && !googleFailed ? (
          <GoogleStaticRouteMap
            apiKey={GOOGLE_MAPS_KEY}
            from={store}
            to={destination}
            lineColor={ROUTE_COLOR}
            toColor={DEST_COLOR}
            onError={() => setGoogleFailed(true)}
          />
        ) : store && destination ? (
          <StaticRouteMap
            from={store}
            to={destination}
            lineColor={ROUTE_COLOR}
            paddingTop={36} // ruang untuk chip jarak & tombol Buka Maps
            fromMarker={
              <View style={[styles.pin, { borderColor: ROUTE_COLOR }]}>
                <Store size={14} color={ROUTE_COLOR} />
              </View>
            }
            toMarker={
              <View style={[styles.pin, styles.pinDest]}>
                <MapPin size={14} color={colors.textOnDark} />
              </View>
            }
          />
        ) : (
          <View style={styles.noMap}>
            <MapPinOff size={24} color={colors.textSubtle} />
            <Text style={styles.noMapText}>
              {destination ? 'Memuat peta…' : 'Pesanan ini belum punya titik lokasi.\nGunakan alamat & Buka Maps.'}
            </Text>
          </View>
        )}

        {distanceKm !== null ? (
          <View style={styles.chip}>
            <Route size={12} color={ROUTE_COLOR} />
            <Text style={styles.chipText}>
              {distanceKm.toLocaleString('id-ID')} km • Est. ±{estimateMinutes(distanceKm)} mnt
            </Text>
          </View>
        ) : null}

        <Pressable onPress={openMaps} style={({ pressed }) => [styles.mapsButton, pressed && styles.pressed]}>
          <Navigation size={14} color={DEST_COLOR} />
          <Text style={styles.mapsText}>Buka Maps</Text>
        </Pressable>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: ROUTE_COLOR }]} />
          <Text style={styles.legendText}>Irona Kopi</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={[styles.legendItem, styles.legendDest]}>
          <View style={[styles.dot, { backgroundColor: DEST_COLOR }]} />
          <Text style={[styles.legendText, styles.legendTextDest]} numberOfLines={1}>
            {address}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  map: {
    height: 200,
    backgroundColor: colors.surfaceMuted,
  },
  noMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 30,
  },
  noMapText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
  },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    shadowColor: '#0f172a',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pinDest: {
    borderColor: colors.surface,
    backgroundColor: DEST_COLOR,
  },
  chip: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  mapsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  mapsText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDest: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  legendTextDest: {
    flexShrink: 1,
    color: DEST_COLOR,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 12,
    color: colors.textSubtle,
  },
});
