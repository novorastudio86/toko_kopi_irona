import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Reward } from '@/types/membership';

/** Kartu reward; `children` = area aksi (kosong untuk tampilan read-only pengunjung umum) */
export default function RewardCard({
  reward,
  dimmed,
  children,
}: {
  reward: Reward;
  /** Poin kurang / stok habis: foto dibuat pucat */
  dimmed?: boolean;
  children?: ReactNode;
}) {
  const soldOut = reward.availableStock <= 0;
  return (
    <li className="flex flex-col border border-foreground bg-card p-2">
      <div className={cn('relative', dimmed && 'opacity-55 grayscale')}>
        {reward.photoUrl ? (
          <img
            src={reward.photoUrl}
            alt={reward.productName}
            loading="lazy"
            className="aspect-[16/9] w-full border border-foreground object-cover"
          />
        ) : (
          <div className="grid aspect-[16/9] place-items-center border border-foreground bg-stripes text-[10px] font-semibold tracking-[0.04em]">
            Foto Reward
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-full border border-foreground bg-background px-2 py-0.5 text-[10px] font-semibold">
          {reward.pointsRequired} poin
        </span>
        {soldOut && (
          <span className="absolute top-2 right-2 rounded-full border border-foreground bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
            Stok habis
          </span>
        )}
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground">Gratis produk · tukar di toko</p>
      <h3 className="text-sm font-semibold">{reward.name}</h3>
      {children && <div className="mt-auto pt-3">{children}</div>}
    </li>
  );
}
