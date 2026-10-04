import { Link } from 'react-router';
import koraBerjalan from '@/assets/tentang/kora-berjalan.webp';
import { cn } from '@/lib/utils';
import { btnOutline, btnSolid, hardShadow } from './membership/styles';

export default function NotFoundScreen() {
  return (
    <section className="border-b border-foreground">
      <title>Halaman tidak ditemukan | Toko Kopi Irona</title>
      <meta name="robots" content="noindex" />
      <div className="mx-auto grid max-w-page items-center gap-8 px-4 py-12 md:grid-cols-[1fr_minmax(0,420px)] md:px-[30px] md:py-20">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <span className="inline-block rounded-full border border-foreground bg-secondary px-3 py-1 font-mono text-[12px]">
            Error 404
          </span>
          <h1 className="mt-4 font-display text-[34px] leading-[1.1] md:text-[48px]">
            Waduh, Kora nyasar.
          </h1>
          <p className="mt-4 max-w-[440px] text-sm leading-6">
            Halaman yang kamu cari nggak ada, atau mungkin sudah pindah. Yuk balik ke beranda,
            kopinya masih hangat.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/" className={cn(btnSolid, 'h-10 px-5 text-[13px]')}>
              Kembali ke beranda
            </Link>
            <Link to="/menu" className={cn(btnOutline, 'h-10 px-5 text-[13px]')}>
              Lihat menu
            </Link>
          </div>
        </div>

        {/* Papan "404" ala kartu retro, Kora berjalan keluar dari baliknya */}
        <div className="relative mx-auto w-full max-w-[360px] pt-6 pr-10 md:max-w-none">
          <div
            className={cn(
              'grid aspect-[4/3] rotate-[-3deg] place-items-center border border-foreground bg-secondary',
              hardShadow
            )}
          >
            <span aria-hidden className="font-display text-[88px] leading-none md:text-[120px]">
              404
            </span>
          </div>
          <img
            src={koraBerjalan}
            alt=""
            width={403}
            height={544}
            className="absolute right-0 -bottom-4 h-[62%] w-auto motion-safe:animate-in motion-safe:slide-in-from-left-6 motion-safe:fade-in motion-safe:duration-700"
          />
        </div>
      </div>
    </section>
  );
}
