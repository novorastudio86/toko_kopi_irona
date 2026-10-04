import { useEffect, useId, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LatLng } from '@/types/onlineOrder';

interface Suggestion {
  name: string;
  detail: string;
  point: LatLng;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

const MIN_CHARS = 3;
/** Sekitar toko (±0,15° ≈ 16 km, di atas jarak antar maks.) supaya nama jalan umum tidak nyasar kota lain */
const RADIUS_DEG = 0.15;

function toSuggestion({ geometry, properties: p }: PhotonFeature): Suggestion {
  const name = p.name ?? p.street ?? 'Tanpa nama';
  const street = p.street && [p.street, p.housenumber].filter(Boolean).join(' ');
  const detail = [street, p.locality ?? p.district, p.city, p.county]
    .filter((s, i, all): s is string => !!s && s !== name && all.indexOf(s) === i)
    .join(', ');
  const [lng, lat] = geometry.coordinates;
  return { name, detail, point: { lat, lng } };
}

/**
 * Saran alamat saat mengetik (jalan, tempat, dusun, desa, kecamatan) via Photon: gratis, tanpa API key,
 * data OpenStreetMap. Gang/jalan kecil yang belum ada di OSM tidak muncul, jadi pelanggan pilih daerah
 * terdekat lalu geser pin.
 * TODO(backend): photon.komoot.io itu layanan publik fair-use; host Photon sendiri sebelum go-live.
 */
export default function AddressSearch({
  near,
  onPick,
}: {
  /** Titik toko: bias & batas pencarian */
  near: LatLng;
  onPick: (point: LatLng) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ q: string; items: Suggestion[] | null } | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < MIN_CHARS) return;
    const ctrl = new AbortController();
    const box = [
      near.lng - RADIUS_DEG,
      near.lat - RADIUS_DEG,
      near.lng + RADIUS_DEG,
      near.lat + RADIUS_DEG,
    ];
    // Debounce: request baru setelah berhenti mengetik
    const timer = setTimeout(() => {
      fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${near.lat}&lon=${near.lng}&bbox=${box.join(',')}&limit=6`,
        { signal: ctrl.signal }
      )
        .then((r) => r.json())
        .then((d: { features: PhotonFeature[] }) =>
          setResult({ q, items: d.features.map(toSuggestion) })
        )
        .catch(() => !ctrl.signal.aborted && setResult({ q, items: null }));
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, near.lat, near.lng]);

  // Toko belum ada di OpenStreetMap: tampilkan manual
  const store: Suggestion[] = /irona/i.test(q)
    ? [{ name: 'Toko Kopi Irona', detail: 'Lokasi toko', point: near }]
    : [];
  const loading = q.length >= MIN_CHARS && result?.q !== q;
  const items = loading ? store : [...store, ...(result?.items ?? [])];
  const failed = !loading && result?.items === null;
  const showList = open && q.length >= MIN_CHARS;

  function pick(s: Suggestion) {
    setQuery(s.detail ? `${s.name}, ${s.detail}` : s.name);
    setOpen(false);
    onPick(s.point);
  }

  return (
    <div className="relative mt-2.5">
      <Search
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground',
          loading && 'animate-pulse'
        )}
      />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((i) => (items.length ? (i + step + items.length) % items.length : 0));
          } else if (e.key === 'Enter') {
            // Ada di dalam form checkout: Enter jangan sampai submit pesanan
            e.preventDefault();
            if (showList && items[active]) pick(items[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
        aria-label="Cari alamat antar"
        placeholder="Ketik jalan, tempat, desa, atau kecamatan"
        autoComplete="off"
        className="h-[36px] w-full rounded-[6px] border border-foreground bg-background pr-3 pl-8 text-xs placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Saran alamat"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-[6px] border border-foreground bg-background py-1 shadow-md"
        >
          {items.map((s, i) => (
            <li
              key={`${s.point.lat},${s.point.lng},${s.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown: input tidak blur (menutup daftar) sebelum klik terbaca
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('cursor-pointer px-3 py-2', i === active && 'bg-secondary')}
            >
              <p className="text-xs font-medium">{s.name}</p>
              {s.detail && <p className="text-[11px] text-muted-foreground">{s.detail}</p>}
            </li>
          ))}
          {!items.length && (
            <li role="presentation" className="px-3 py-2 text-[11px] text-muted-foreground">
              {loading
                ? 'Mencari…'
                : failed
                  ? 'Gagal mencari alamat. Coba lagi, atau geser peta ke titik antar.'
                  : 'Tidak ketemu. Ketik nama dusun/desa terdekat, lalu geser pin ke rumahmu.'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
