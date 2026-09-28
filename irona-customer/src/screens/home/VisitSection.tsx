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
              <iframe
                src={profile.mapsEmbedUrl}
                title="Peta lokasi Toko Kopi Irona"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="size-full"
              />
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
