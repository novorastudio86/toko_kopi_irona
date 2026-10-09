import { useWindowDimensions } from 'react-native';

/**
 * Ukuran layar untuk tata letak Kasir (mendatar).
 * Acuan desain: Galaxy Tab A8 ≈ 1280×800 dp. Di bawah 1200 dp (tablet 7–8", HP mendatar)
 * jarak dan panel samping dirampingkan supaya area menu tetap lega.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const compact = width < 1200;
  return {
    width,
    height,
    compact,
    /** Jarak tepi isi halaman */
    gutter: compact ? 16 : 24,
    /** Lebar panel kanan (Pesanan Aktif / detail pesanan): ±32% layar, 300–440 dp */
    sidePanelWidth: Math.round(Math.min(440, Math.max(300, width * 0.32))),
  };
}
