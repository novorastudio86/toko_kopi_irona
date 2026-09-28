import recommendedIcon from '@/assets/home/recommended.webp';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types/product';
import { formatRupiah } from '@/utils/format';

export default function ProductCard({ product, onBuy }: { product: Product; onBuy: () => void }) {
  return (
    <article className="flex flex-col border border-foreground bg-card p-2 pb-[9px]">
      <div className="h-[118px] overflow-hidden border border-foreground">
        {product.photoUrl ? (
          <img src={product.photoUrl} alt={product.name} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-stripes text-[10px] font-semibold tracking-[0.4px] text-muted-foreground">
            FOTO
          </div>
        )}
      </div>

      <h3 className="mt-[7px] truncate text-[13px] leading-[15.6px] font-medium text-foreground">
        {product.name}
      </h3>
      <div className="flex h-[25px] items-center">
        {product.isRecommended && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary py-0.5 pr-1.5 pl-2 text-[10px] leading-[14px] font-normal text-primary-foreground">
            Recomended
            {/* Ikon koala dipakai sebagai mask supaya warnanya ikut teks badge */}
            <span
              aria-hidden
              className="h-[11px] w-[18px] bg-current mask-contain mask-center mask-no-repeat"
              style={{ maskImage: `url(${recommendedIcon})` }}
            />
          </span>
        )}
      </div>

      <div className="mt-[3px] flex items-center justify-between gap-2">
        <span className="text-xs leading-[14.4px] font-medium tracking-[1.08px] text-foreground uppercase">
          {product.sellingPrice === null ? '-' : formatRupiah(product.sellingPrice)}
        </span>
        <Button
          onClick={onBuy}
          aria-label={`Beli ${product.name}`}
          className="h-[27px] rounded-[6px] bg-primary px-[11px] text-[11px] text-primary-foreground"
        >
          Beli
        </Button>
      </div>
    </article>
  );
}
