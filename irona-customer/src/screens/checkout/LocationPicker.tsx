import { useEffect, useEffectEvent, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LatLng } from '@/types/onlineOrder';
import AddressSearch from './AddressSearch';

/**
 * Pin tetap di tengah, peta yang digeser (seperti Shopee/Gojek). Titik = tengah peta setelah berhenti digeser.
 * Saat pertama dibuka tanpa titik tersimpan, langsung minta lokasi perangkat. Bisa juga ketik alamat.
 * locked = titik sudah dikonfirmasi: peta tidak bisa digeser (zoom tetap boleh, pin di tengah tidak
 * berpindah), jadi titik & ongkir tidak gugur karena tergeser tanpa sengaja.
 */
export default function LocationPicker({
  value,
  fallback,
  locked = false,
  onChange,
}: {
  /** null = belum ada titik (peta mulai dari fallback) */
  value: LatLng | null;
  /** Posisi awal kalau lokasi perangkat tidak didapat (titik toko) */
  fallback: LatLng;
  locked?: boolean;
  onChange: (point: LatLng) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  /** false = belum digeser pelanggan; moveend karena resize/posisi awal (toko atau titik tersimpan) diabaikan */
  const armedRef = useRef(false);
  /** Dibaca callback geolokasi yang bisa datang setelah peta dikunci */
  const lockedRef = useRef(locked);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function locate(map: L.Map) {
    if (!navigator.geolocation) {
      setGeoError('Browser tidak mendukung lokasi. Geser peta ke titik antar.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        if (mapRef.current !== map || lockedRef.current) return;
        armedRef.current = true;
        map.setView([pos.coords.latitude, pos.coords.longitude], 17);
      },
      () => {
        setLocating(false);
        setGeoError(
          'Lokasi tidak bisa diambil. Izinkan akses lokasi, atau geser peta ke titik antar.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /** Alamat dipilih dari saran -> peta pindah ke sana; pin tetap perlu dikonfirmasi seperti hasil geser */
  function goTo(point: LatLng) {
    const map = mapRef.current;
    if (!map || lockedRef.current) return;
    setGeoError(null);
    armedRef.current = true;
    map.setView(point, 17);
  }

  const emit = useEffectEvent(() => {
    const c = mapRef.current?.getCenter();
    if (!c || !armedRef.current || locked) return;
    // Zoom di tengah bisa memicu moveend dengan titik yang sama: jangan dianggap pindah
    const same = (a: number, b: number) => a.toFixed(6) === b.toFixed(6);
    if (value && same(c.lat, value.lat) && same(c.lng, value.lng)) return;
    onChange({ lat: c.lat, lng: c.lng });
  });

  const setup = useEffectEvent((map: L.Map) => {
    map.setView(value ?? fallback, 17);
    // Titik toko (posisi awal) tidak boleh terkirim sebagai titik antar: tunggu digeser/keyboard/lokasi saya
    const arm = () => (armedRef.current = true);
    map.on('dragstart', arm);
    map.getContainer().addEventListener('keydown', arm);
    map.on('movestart', () => setMoving(true));
    map.on('moveend', () => {
      setMoving(false);
      emit();
    });
    if (!value) locate(map);
  });

  useEffect(() => {
    const map = L.map(containerRef.current!, {
      zoomControl: false,
      // Zoom tetap di tengah supaya pin tidak bergeser dari titik yang dipilih
      scrollWheelZoom: 'center',
      doubleClickZoom: 'center',
      touchZoom: 'center',
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // Tile Google Maps (tanpa API key) supaya tampilan sama dengan peta di Home/Tentang.
    // TODO(go-live): akses tile langsung tidak resmi menurut ketentuan Google; ganti ke
    // Maps JavaScript API (pakai API key, ada kuota gratis bulanan) sebelum rilis.
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=id&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: '0123',
      attribution: 'Data peta &copy; Google',
    }).addTo(map);
    mapRef.current = map;
    setup(map);
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    lockedRef.current = locked;
    const map = mapRef.current;
    if (!map) return;
    if (locked) {
      map.dragging.disable();
      map.keyboard.disable();
    } else {
      map.dragging.enable();
      map.keyboard.enable();
    }
  }, [locked]);

  return (
    <div>
      {/* isolate: z-index pane Leaflet (400–1000) tidak menimpa navbar */}
      <div className="relative isolate h-[200px] overflow-hidden rounded-[6px] border border-foreground md:h-[320px]">
        <div
          ref={containerRef}
          role="application"
          aria-label={
            locked
              ? 'Peta titik antar, terkunci. Tekan Ubah titik untuk memindahkan.'
              : 'Peta titik antar. Geser peta sampai pin tepat di lokasimu.'
          }
          // plus-lighter: tepi tile yang anti-alias saling menjumlah, jadi tidak ada garis putih
          // antar-tile di layar berskala non-100% (fix yang sama dipakai Leaflet 2)
          className="size-full [&_.leaflet-tile]:mix-blend-plus-lighter"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-full"
        >
          <MapPin
            className={cn(
              'size-9 fill-primary text-primary-foreground transition-transform duration-150',
              moving && '-translate-y-2'
            )}
            strokeWidth={1.5}
          />
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] size-1.5 -translate-1/2 rounded-full bg-primary/50"
        />
        {!locked && (
          <button
            type="button"
            onClick={() => mapRef.current && locate(mapRef.current)}
            disabled={locating}
            className="absolute top-2.5 right-2.5 z-[1000] flex h-8 items-center gap-1.5 rounded-[6px] border border-foreground bg-background px-2.5 text-[11px] font-medium shadow-sm transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-60"
          >
            <LocateFixed className={cn('size-3.5', locating && 'animate-pulse')} />
            {locating ? 'Mencari lokasi…' : 'Lokasi saya'}
          </button>
        )}
      </div>
      {!locked && <AddressSearch near={fallback} onPick={goTo} />}
      {geoError && (
        <p role="status" className="mt-2 text-[11px] text-destructive">
          {geoError}
        </p>
      )}
    </div>
  );
}
