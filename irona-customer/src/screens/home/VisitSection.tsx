import { Coffee } from 'lucide-react';
import SocialLinks from '@/components/SocialLinks';
import { useStoreHours } from '@/hooks/useStoreHours';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { formatClock, getOpeningSummary } from '@/utils/storeHours';

export default function VisitSection() {
  const profile = useStoreProfile();
  const hours = useStoreHours();
  const opening = hours && getOpeningSummary(hours, 'offline');

  return (
    <section id="lokasi" className="scroll-mt-[60px] border-b border-dashed border-border">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-10 md:px-[30px] md:pb-[77px]">
        <h2 className="pl-0.5 font-display text-2xl leading-[22px]">Kunjungi Kami</h2>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-[791fr_333fr] md:gap-4">
          <div className="min-h-[230px] border border-foreground">
            {profile?.mapsEmbedUrl ? (
              // Peta dibuat statis (pointer-events-none) supaya pin custom selalu tepat di titik toko;
              // klik peta membuka Google Maps.
              <a
                href={profile.mapsLink}
                target="_blank"
                rel="noreferrer"
                aria-label="Buka lokasi Toko Kopi Irona di Google Maps"
                className="group relative block size-full overflow-hidden"
              >
                <iframe
                  src={profile.mapsEmbedUrl}
                  title="Peta lokasi Toko Kopi Irona"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  tabIndex={-1}
                  className="pointer-events-none absolute inset-0 size-full scale-105 grayscale sepia-[.35] transition-[filter,scale] duration-700 group-hover:scale-100 group-hover:grayscale-0 group-hover:sepia-0"
                />
                {/* Vinyet hangat di tepi peta */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(43_39_36/0.35))] transition-opacity duration-700 group-hover:opacity-0" />

                {/* Titik lokasi + denyut, tepat di tengah peta (menutupi ujung marker bawaan Google) */}
                <span className="pointer-events-none absolute top-1/2 left-1/2 size-10 -translate-1/2 animate-ping rounded-full bg-accent-brown/40" />
                <span className="pointer-events-none absolute top-1/2 left-1/2 size-4 -translate-1/2 rounded-full bg-accent-brown ring-3 ring-background shadow-md" />

                {/* Pin toko melayang di atas titik lokasi */}
                <div className="map-pin pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-[calc(100%+14px)] flex-col items-center">
                  <span className="mb-1.5 rounded-full bg-foreground px-2.5 py-1 font-display text-[10px] whitespace-nowrap text-background shadow-md">
                    Toko Kopi Irona
                  </span>
                  <span className="relative grid size-11 place-items-center rounded-full rounded-br-none bg-accent-brown text-accent-brown-foreground shadow-lg ring-2 ring-background rotate-45">
                    <Coffee className="size-5 -rotate-45" strokeWidth={2.25} />
                  </span>
                </div>
              </a>
            ) : (
              <div className="grid size-full place-items-center bg-stripes px-2 text-center text-[10px] font-semibold tracking-[0.4px] text-muted-foreground">
                EMBED GOOGLE MAPS
              </div>
            )}
          </div>

          <div className="pt-[13px] text-[10px] leading-[18px]">
            <h3 className="font-display text-[13px] leading-[18px]">Alamat</h3>
            <p>{profile?.address}</p>

            <h3 className="mt-2 font-display text-[13px] leading-[18px]">Jam Buka</h3>
            {opening && (
              <p className="flex flex-wrap justify-between gap-x-2 md:pr-3">
                <span>{opening.days}</span>
                <span>
                  {formatClock(opening.openTime)} - {formatClock(opening.closeTime)}
                </span>
              </p>
            )}

            {profile && (
              <>
                <SocialLinks profile={profile} size={22} className="mt-4" />
                <a
                  href={profile.mapsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-[25px] grid h-[33px] w-full max-w-[165px] place-items-center rounded-[6px] border border-foreground bg-background text-[11px] font-medium hover:bg-secondary"
                >
                  Buka di Google Maps
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
