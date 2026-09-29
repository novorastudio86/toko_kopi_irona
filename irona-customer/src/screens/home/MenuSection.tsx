import { useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { fetchOnlineCategories } from '@/services/categories';
import { fetchOnlineProducts } from '@/services/products';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import CategoryTabs from './CategoryTabs';
import ClosedNotice from './ClosedNotice';
import { useMenuStatus } from './menuStatus';
import ProductCard from './ProductCard';
import { CAN_REVEAL, useCardReveal } from './useCardReveal';
import { useQuickCart } from './useQuickCart';
import './menu.css';

const PANEL_ID = 'menu-tabpanel';
/** Dipakai ulang halaman /menu supaya grid & skeleton card sama persis dengan Home */
export const menuGridClass =
  'grid grid-cols-2 content-start gap-x-3 gap-y-[18px] md:grid-cols-3 lg:grid-cols-4';
export const menuSkeletonClass = 'h-[197px] animate-pulse border border-foreground/20 bg-secondary';
/** Batch masuk terlama: delay maks 320ms + durasi 260ms (lihat menu.css) */
const ENTER_MS = 600;

export default function MenuSection() {
  const { quantityOf, setQuantity } = useQuickCart();
  const status = useMenuStatus();
  const [noticeAt, setNoticeAt] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Produk per kategori yang sudah dimuat; null = gagal dimuat */
  const [cache, setCache] = useState<Record<string, Product[] | null>>({});
  const requested = useRef(new Set<string>());
  /** Kategori yang card-nya sedang tampil; tertinggal dari activeId selama kategori baru dimuat */
  const [shownId, setShownId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** Tinggi grid sebelum ganti kategori; ditahan sampai animasi masuk selesai supaya halaman tidak loncat */
  const [holdHeight, setHoldHeight] = useState<number>();

  const activeId = selectedId ?? categories?.[0]?.id ?? null;
  if (activeId && activeId in cache && shownId !== activeId) setShownId(activeId);

  useEffect(() => {
    fetchOnlineCategories()
      .then(setCategories)
      .catch((err) => {
        console.error('Gagal memuat kategori', err);
        setCategoriesFailed(true);
      });
  }, []);

  // Tiap kategori di-fetch sekali; hasil yang datang telat tetap masuk cache tapi hanya
  // ditampilkan kalau masih kategori aktif, jadi klik cepat tidak menumpuk konten.
  useEffect(() => {
    if (!activeId || requested.current.has(activeId)) return;
    requested.current.add(activeId);
    fetchOnlineProducts(activeId)
      .then((products) => setCache((c) => ({ ...c, [activeId]: products })))
      .catch((err) => {
        console.error('Gagal memuat produk', err);
        setCache((c) => ({ ...c, [activeId]: null }));
      });
  }, [activeId]);

  useEffect(() => {
    const timer = setTimeout(() => setHoldHeight(undefined), ENTER_MS);
    return () => clearTimeout(timer);
  }, [shownId]);

  const selectCategory = (id: string) => {
    if (id === activeId) return;
    setHoldHeight(gridRef.current?.offsetHeight);
    setSelectedId(id);
  };

  // Skeleton hanya saat belum ada data sama sekali (muat pertama)
  const loading = !categoriesFailed && shownId === null;
  const shownProducts = shownId ? cache[shownId] : null;
  const failed = categoriesFailed || (!loading && shownProducts === null);

  // Ganti kategori = daftar card baru (key produk berbeda), jadi animasi mulai dari awal, tidak menumpuk.
  useCardReveal(gridRef, shownProducts);

  return (
    <MotionConfig reducedMotion="user">
      <section id="menu" className="scroll-mt-[60px] border-b border-foreground">
        <div className="mx-auto max-w-[1200px] px-4 pt-[18px] pb-7 md:px-[30px]">
          <h2 className="pl-0.5 font-display text-[26px] leading-tight md:text-[32px]">
            {status.title}
          </h2>
          <p className="mt-[5px] flex min-h-[19px] items-center gap-1.5 pl-0.5 text-sm leading-[19px] font-medium text-foreground">
            <span
              aria-hidden
              className={cn(
                'size-2 shrink-0 rounded-full border',
                status.isOpen ? 'border-foreground bg-foreground' : 'border-muted-foreground'
              )}
            />
            {status.subtitle}
          </p>

          <CategoryTabs
            categories={categories}
            activeId={activeId}
            onSelect={selectCategory}
            panelId={PANEL_ID}
          />

          <div
            ref={gridRef}
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={activeId ? `tab-${activeId}` : undefined}
            aria-busy={shownId !== activeId}
            style={{ minHeight: holdHeight }}
            className={cn('mt-3', menuGridClass, CAN_REVEAL && 'menu-reveal')}
          >
            {failed ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                Menu gagal dimuat. Coba muat ulang halaman.
              </p>
            ) : loading ? (
              Array.from({ length: 4 }, (_, i) => <div key={i} className={menuSkeletonClass} />)
            ) : shownProducts?.length ? (
              shownProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={quantityOf(product.id)}
                  orderingOpen={status.isOpen}
                  onQuantityChange={(qty) => setQuantity(product.id, qty)}
                  onClosedAttempt={() => setNoticeAt(Date.now())}
                />
              ))
            ) : (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                Belum ada menu di kategori ini.
              </p>
            )}
          </div>
        </div>
        <ClosedNotice message={status.closedNotice} shownAt={noticeAt} />
      </section>
    </MotionConfig>
  );
}
