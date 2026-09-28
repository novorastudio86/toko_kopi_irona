import { useEffect, useState } from 'react';
import { fetchOnlineCategories } from '@/services/categories';
import { fetchOnlineProducts } from '@/services/products';
import { useCart } from '@/hooks/useCart';
import { useStoreHours } from '@/hooks/useStoreHours';
import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import { getOpeningSummary, isStoreOpen } from '@/utils/storeHours';
import CategoryTabs from './CategoryTabs';
import ProductCard from './ProductCard';

/** Hasil fetch per kategori; products null = gagal dimuat */
interface ProductsResult {
  categoryId: string;
  products: Product[] | null;
}

export default function MenuSection() {
  const { addItem } = useCart();
  const hours = useStoreHours();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<ProductsResult | null>(null);

  const activeId = selectedId ?? categories?.[0]?.id ?? null;
  const ordering = hours && getOpeningSummary(hours, 'online');
  const orderingOpen = hours ? isStoreOpen(hours, 'online') : true;

  useEffect(() => {
    fetchOnlineCategories()
      .then(setCategories)
      .catch((err) => {
        console.error('Gagal memuat kategori', err);
        setCategoriesFailed(true);
      });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    fetchOnlineProducts(activeId)
      .then((products) => !cancelled && setResult({ categoryId: activeId, products }))
      .catch((err) => {
        console.error('Gagal memuat produk', err);
        if (!cancelled) setResult({ categoryId: activeId, products: null });
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const loading = !categoriesFailed && (!result || result.categoryId !== activeId);
  const failed = categoriesFailed || (!loading && result?.products === null);

  return (
    <section id="menu" className="scroll-mt-[60px] border-b border-dashed border-foreground">
      <div className="mx-auto max-w-[1200px] px-4 pt-[18px] pb-7 md:px-[30px]">
        <h2 className="pl-0.5 font-display text-2xl leading-[22px]">Yuk Nongkrong</h2>
        <p className="mt-[5px] min-h-[19px] pl-0.5 text-sm leading-[19px] font-medium text-foreground">
          {ordering && (
            <>
              Pemesanan {ordering.openTime} - {ordering.closeTime}
              {!orderingOpen && <span className="text-muted-foreground"> · Sedang tutup</span>}
            </>
          )}
        </p>

        <CategoryTabs categories={categories} activeId={activeId} onSelect={setSelectedId} />

        <div className="mt-[19px] grid grid-cols-2 gap-x-3 gap-y-[18px] md:grid-cols-3 lg:grid-cols-4">
          {failed ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Menu gagal dimuat. Coba muat ulang halaman.
            </p>
          ) : loading ? (
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-[214px] animate-pulse border border-foreground/20 bg-secondary"
              />
            ))
          ) : result?.products?.length ? (
            result.products.map((product) => (
              <ProductCard key={product.id} product={product} onBuy={addItem} />
            ))
          ) : (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Belum ada menu di kategori ini.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
