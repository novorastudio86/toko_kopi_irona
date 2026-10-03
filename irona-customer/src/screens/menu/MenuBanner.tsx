import banner from '@/assets/menu/menu-banner.webp';
import { useStoreHours } from '@/hooks/useStoreHours';
import { formatClock, getOpeningSummary } from '@/utils/storeHours';

/** Banner foto di atas katalog (Figma 658:2): tinggi 142px desktop, teks terang di atas foto gelap */
export default function MenuBanner() {
  const hours = useStoreHours();
  const online = hours && getOpeningSummary(hours, 'online');

  return (
    <div className="relative isolate overflow-hidden bg-primary text-primary-foreground">
      {/* Foto produk tetap berwarna. lg: posisi 51% = potongan desain; layar lebih sempit
          menampilkan foto lebih tinggi, jadi potongan digeser ke bawah agar tulisan di foto tidak bertabrakan */}
      <img
        src={banner}
        alt=""
        width={1536}
        height={1024}
        fetchPriority="high"
        className="absolute inset-0 -z-10 size-full object-cover object-[50%_85%] md:object-[50%_60%] lg:object-[50%_51%]"
      />
      {/* Gelap netral di sisi teks supaya tetap terbaca saat potongan foto berubah (mobile) */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-primary/50 md:bg-transparent md:bg-linear-to-r md:from-primary/45 md:via-primary/10 md:to-transparent"
      />
      <div className="mx-auto flex min-h-[142px] max-w-page flex-col justify-center px-4 py-5 md:px-[30px]">
        <p className="text-lg leading-7 font-medium md:text-[22px]">
          A Place to Pause,{' '}
          <span className="font-display text-xl font-normal md:text-2xl">Connect &amp; Enjoy</span>
        </p>
        <p className="mt-1 max-w-[651px] text-[13px] leading-6 md:text-sm">
          {online &&
            `Pemesanan tersedia di jam ${formatClock(online.openTime)}-${formatClock(online.closeTime)}, `}
          <em>
            connect with your friends <br className="max-md:hidden" />
            enjoy your coffee,
          </em>{' '}
          #CoffeeHumanity
        </p>
      </div>
    </div>
  );
}
