import { useState } from 'react';
import koraHead from '@/assets/home/logo-koala.webp';

/** Foto menu 4:3; tanpa foto / gagal dimuat → kepala Kora di atas pola garis */
export default function MenuImage({ src, alt }: { src: string | null; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div className="grid size-full place-items-center bg-stripes">
        <img
          src={koraHead}
          alt=""
          width={97}
          height={60}
          className="menu-card-kora w-2/5 opacity-70"
        />
      </div>
    );
  }

  // TODO(foto): idealnya foto produk berlatar transparan atau seragam; multiply (menu.css)
  // hanya menyamarkan latar putih agar menyatu dengan warna card.
  return (
    <img
      src={src}
      alt={alt}
      width={400}
      height={300}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className="menu-card-media size-full object-cover"
    />
  );
}
