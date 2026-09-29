import footerLogo from '@/assets/home/footer-logo.webp';
import logoKoala from '@/assets/home/logo-koala.webp';
import SocialLinks from '@/components/SocialLinks';
import { useStoreHours } from '@/hooks/useStoreHours';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { formatClock, getOpeningSummary, HOURS_CHANNELS } from '@/utils/storeHours';

export default function VisitSection() {
  const profile = useStoreProfile();
  const hours = useStoreHours();

  return (
    <section id="lokasi" className="scroll-mt-[60px] border-b border-dashed border-border">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-10 md:px-[30px] md:pb-[77px]">
        <h2 className="pl-0.5 font-display text-2xl leading-[22px]">Kunjungi Kami</h2>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-[3fr_2fr] md:gap-4 lg:grid-cols-[1fr_auto] lg:gap-6">
          <div className="min-h-[230px] border border-foreground md:min-h-[320px]">
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
                  className="pointer-events-none absolute inset-0 size-full scale-105 grayscale contrast-[1.15] transition-[filter,scale] duration-700 group-hover:scale-100 group-hover:grayscale-0 group-hover:contrast-100"
                />
                {/* Vinyet abu-abu di tepi peta */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgb(0_0_0/0.3))] transition-opacity duration-700 group-hover:opacity-0" />

                {/* Pin Kora diam; ujung ekornya tepat di titik toko (menutupi marker bawaan Google) */}
                <span className="pointer-events-none absolute top-1/2 left-1/2 h-1.5 w-6 -translate-1/2 rounded-full bg-black/35 blur-[2px]" />
                <div className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center drop-shadow-[0_4px_6px_rgb(0_0_0/0.3)]">
                  <span className="grid size-12 place-items-center rounded-full border-2 border-foreground bg-white">
                    <img src={logoKoala} alt="" className="w-8" />
                  </span>
                  <span className="-mt-px size-0 border-x-[7px] border-t-[10px] border-x-transparent border-t-foreground" />
                </div>
                {/* Logo nama toko di kanan lingkaran pin; logo putih dibuat hitam + halo putih agar terbaca di atas peta */}
                <img
                  src={footerLogo}
                  alt=""
                  className="pointer-events-none absolute top-[calc(50%-34px)] left-[calc(50%+32px)] h-7 w-auto -translate-y-1/2 [filter:brightness(0)_drop-shadow(0_0_1.5px_#fff)_drop-shadow(0_0_1.5px_#fff)]"
                />
              </a>
            ) : (
              <div className="grid size-full place-items-center bg-stripes px-2 text-center text-[10px] font-semibold tracking-[0.4px] text-muted-foreground">
                EMBED GOOGLE MAPS
              </div>
            )}
          </div>

          <div className="pt-[13px] text-[10px] leading-[18px]">
            <h3 className="font-display text-[13px] leading-[18px]">Alamat</h3>
            <p className="lg:whitespace-nowrap">{profile?.address}</p>

            <h3 className="mt-2 font-display text-[13px] leading-[18px]">Jam Buka</h3>
            {HOURS_CHANNELS.map(({ channel, label }) => {
              const opening = hours && getOpeningSummary(hours, channel);
              return (
                opening && (
                  <div key={channel} className="mt-0.5">
                    <p className="font-semibold">{label}</p>
                    <p className="flex flex-wrap justify-between gap-x-2 md:pr-3">
                      <span>{opening.days}</span>
                      <span>
                        {formatClock(opening.openTime)} - {formatClock(opening.closeTime)}
                      </span>
                    </p>
                  </div>
                )
              );
            })}

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
