import type { ReactNode } from 'react';
import footerLogo from '@/assets/home/footer-logo.webp';
import { NAV_LINKS } from '@/constants/navigation';
import { useStoreHours } from '@/hooks/useStoreHours';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { formatClock, getOpeningSummary, HOURS_CHANNELS } from '@/utils/storeHours';
import NavItem from './NavItem';
import SocialLinks from './SocialLinks';

function FooterColumn({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <h2 className="font-display text-base leading-[18px]">{title}</h2>
      <div className="mt-1 flex flex-col text-[11px] leading-[17px]">{children}</div>
    </div>
  );
}

export default function Footer() {
  const profile = useStoreProfile();
  const hours = useStoreHours();

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-4 gap-y-6 px-4 py-8 md:flex md:items-start md:gap-0 md:py-[29px] md:pr-[51px] md:pl-8">
        <div className="col-span-2 sm:col-span-1 md:w-[327px]">
          <div className="flex items-end gap-3.5">
            <img src={footerLogo} alt="Toko Kopi Irona" className="h-[34px] w-auto" />
            {profile && <SocialLinks profile={profile} size={20} className="mb-1 gap-2.5" />}
          </div>
          <p className="mt-[7px] w-[189px] text-[11px] leading-[14px]">
            Coffeshop ter <em>update, timeless, humanity, nomor satu</em> di Jember
          </p>
          <p className="mt-2 font-display text-base leading-[18px]">#COFFEHUMANITY</p>
        </div>

        <FooterColumn title="Navigasi" className="md:w-[188px] md:pt-[3px]">
          {NAV_LINKS.filter((link) => link.label !== 'Lokasi').map((link) => (
            <NavItem key={link.href} link={link} className="w-fit hover:underline" />
          ))}
        </FooterColumn>

        <FooterColumn title="Bantuan" className="md:w-[212px] md:pt-[3px]">
          {profile && (
            <>
              <a
                href={`https://wa.me/${profile.whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                className="w-fit hover:underline"
              >
                Kontak Admin
              </a>
              <a
                href={profile.mapsLink}
                target="_blank"
                rel="noreferrer"
                className="w-fit hover:underline"
              >
                Lokasi Toko Kopi Irona
              </a>
            </>
          )}
        </FooterColumn>

        <FooterColumn title="Jam Buka" className="md:flex-1 md:pt-[3px]">
          {HOURS_CHANNELS.map(({ channel, label }) => {
            const opening = hours && getOpeningSummary(hours, channel);
            return (
              opening && (
                <div key={channel} className="mt-0.5 flex flex-col">
                  <span className="font-semibold">{label}</span>
                  <span className="flex gap-4">
                    <span>{opening.days}</span>
                    <span>
                      {formatClock(opening.openTime)} - {formatClock(opening.closeTime)}
                    </span>
                  </span>
                </div>
              )
            );
          })}
        </FooterColumn>

        <a
          href="/#menu"
          className="col-span-2 grid h-[33px] place-items-center rounded-[6px] border border-background bg-background text-[11px] font-medium text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-background/60 md:mt-[21px] md:w-[126px]"
        >
          Pesan Sekarang
        </a>
      </div>
    </footer>
  );
}
