import { useState } from 'react';
import logoKoala from '@/assets/home/logo-koala.webp';

/** Tampil sekali tiap halaman dibuka/refresh; durasi & animasi diatur di index.css (.splash*) */
export default function SplashScreen() {
  const [done, setDone] = useState(false);
  if (done) return null;

  return (
    <div
      aria-hidden
      className="splash fixed inset-0 z-[100] grid place-items-center bg-background"
      onAnimationEnd={(e) => e.animationName === 'splash-out' && setDone(true)}
    >
      <div className="flex flex-col items-center gap-5">
        <img src={logoKoala} alt="" className="splash-kora h-16 w-auto" />
        <div className="h-[3px] w-24 overflow-hidden rounded-full bg-border">
          <div className="splash-bar h-full bg-foreground" />
        </div>
      </div>
    </div>
  );
}
