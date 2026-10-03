import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import kora from '@/assets/home/kora.webp';
import koraHead from '@/assets/home/logo-koala.webp';
import { ALL_CATEGORY, categoryKind, fetchOnlineCategories } from '@/services/categories';
import { fetchAllOnlineProducts } from '@/services/products';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import CategoryTabs from './home/CategoryTabs';
import ClosedNotice from './home/ClosedNotice';
import { menuGridClass, menuSkeletonClass } from './home/MenuSection';
import { useMenuStatus } from './home/menuStatus';
import ProductCard from './home/ProductCard';
import { CAN_REVEAL, useCardReveal } from './home/useCardReveal';
import { useQuickCart } from './home/useQuickCart';
import MenuBanner from './menu/MenuBanner';
import MenuFilters from './menu/MenuFilters';
import { applyMenuFilters, EMPTY_FILTERS, type MenuFilters as Filters } from './menu/filterMenu';
import './home/menu.css';

const PANEL_ID = 'menu-tabpanel';
/** 2 baris × 4 kolom seperti desain; "Muat Lebih Banyak" menambah sebanyak ini */
const PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 250;

// Tombol outline & gelap = gaya tombol Home (VisitSection "Buka di Google Maps", Navbar "Login")
const buttonClass =
  'grid h-[33px] place-items-center rounded-[6px] border border-foreground px-4 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';
const outlineButtonClass = cn(buttonClass, 'bg-background hover:bg-secondary');
const solidButtonClass = cn(buttonClass, 'bg-primary text-primary-foreground hover:bg-primary/85');

interface Catalog {
  categories: Category[];
  products: Product[];
}

/** Dev saja: ?menu=error membuat muat pertama gagal, untuk menguji state error + tombol muat ulang */
const failFirstLoad = () =>
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('menu') === 'error';

/** Empty / error: Kora + judul + pesan + tombol (Figma 343:1148) */
function MenuState({
  image,
  title,
  children,
  actions,
}: {
  image: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <img src={image} alt="" className="h-24 w-auto" />
      <h2 className="mt-4 font-display text-xl leading-tight md:text-2xl">{title}</h2>
      <p className="mt-2 max-w-[300px] text-sm leading-5 text-muted-foreground">{children}</p>
      {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export default function MenuScreen() {
  const { quantityOf, setQuantity } = useQuickCart();
  const status = useMenuStatus();
  const [noticeAt, setNoticeAt] = useState<number | null>(null);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Isi kotak search (langsung) vs query yang dipakai filter (setelah debounce) */
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const gridRef = useRef<HTMLDivElement>(null);
  /** Index card pertama hasil "Muat Lebih Banyak", difokus setelah card tampil */
  const focusFrom = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchOnlineCategories(), fetchAllOnlineProducts()])
      .then(([categories, products]) => {
        if (attempt === 0 && failFirstLoad()) throw new Error('Simulasi gagal muat (?menu=error)');
        if (!cancelled) setCatalog({ categories, products });
      })
      .catch((err) => {
        console.error('Gagal memuat menu', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // Filter Minuman / Makanan juga menyaring tab; kategori terpilih yang tersaring → tab pertama (All Product)
  const categories = useMemo(
    () =>
      catalog && [
        ALL_CATEGORY,
        ...catalog.categories.filter((c) => !filters.kind || categoryKind(c.id) === filters.kind),
      ],
    [catalog, filters.kind]
  );
  const categoryId =
    categories?.find((c) => c.id === selectedId)?.id ?? categories?.[0]?.id ?? null;
  // Saat search: cari di semua menu, tab kategori tidak aktif
  const activeId = query ? null : categoryId;

  const results = useMemo(() => {
    if (!catalog) return [];
    const base =
      query || categoryId === ALL_CATEGORY.id
        ? catalog.products
        : catalog.products.filter((p) => p.categoryId === categoryId);
    return applyMenuFilters(base, filters, categoryKind, query);
  }, [catalog, query, categoryId, filters]);

  // Ganti search / tab / filter = tampilan baru: jumlah card kembali ke 1 halaman dan
  // key card berubah, jadi card masuk ulang dengan animasi seperti ganti kategori di Home.
  const viewKey = JSON.stringify([query, activeId, filters]);
  const [page, setPage] = useState({ viewKey, limit: PAGE_SIZE });
  const limit = page.viewKey === viewKey ? page.limit : PAGE_SIZE;
  const visible = useMemo(() => results.slice(0, limit), [results, limit]);

  useCardReveal(gridRef, visible);

  useEffect(() => {
    const from = focusFrom.current;
    if (from === null || !gridRef.current) return;
    focusFrom.current = null;
    // Card habis tidak punya elemen fokus, jadi ambil yang pertama di antara card baru
    [...gridRef.current.children]
      .slice(from)
      .map((card) => card.querySelector<HTMLElement>('a, button:not([disabled])'))
      .find(Boolean)
      ?.focus();
  }, [visible]);

  const loadMore = () => {
    focusFrom.current = limit;
    setPage({ viewKey, limit: limit + PAGE_SIZE });
  };

  const clearSearch = () => {
    setInput('');
    setQuery('');
  };
  const selectCategory = (id: string) => {
    clearSearch();
    setSelectedId(id);
  };
  const resetAll = () => {
    clearSearch();
    setFilters(EMPTY_FILTERS);
  };
  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  const loading = !catalog && !failed;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  let content: ReactNode;
  if (failed) {
    content = (
      <MenuState
        image={koraHead}
        title="Koneksinya lagi pelan"
        actions={
          <button type="button" onClick={retry} className={solidButtonClass}>
            Muat ulang
          </button>
        }
      >
        Kami gagal memuat menu. Coba lagi sebentar.
      </MenuState>
    );
  } else if (loading) {
    content = (
      <div aria-hidden className={cn('mt-3', menuGridClass)}>
        {Array.from({ length: PAGE_SIZE }, (_, i) => (
          <div key={i} className={cn(menuSkeletonClass, 'motion-reduce:animate-none')} />
        ))}
      </div>
    );
  } else if (!results.length && (query || filtersActive)) {
    content = (
      <MenuState
        image={kora}
        title="Nggak ada yang cocok"
        actions={
          <>
            {filtersActive && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className={outlineButtonClass}
              >
                Reset filter
              </button>
            )}
            <button type="button" onClick={resetAll} className={solidButtonClass}>
              Lihat semua
            </button>
          </>
        }
      >
        {query
          ? `Kora belum nemu menu “${query}”. Coba kata lain, atau lepas satu filter.`
          : 'Coba lepas satu filter, atau cari dengan kata lain.'}
      </MenuState>
    );
  } else if (!results.length) {
    content = (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Belum ada menu di kategori ini.
      </p>
    );
  } else {
    content = (
      <>
        <div ref={gridRef} className={cn('mt-3', menuGridClass, CAN_REVEAL && 'menu-reveal')}>
          {visible.map((product) => (
            <ProductCard
              key={`${viewKey}:${product.id}`}
              product={product}
              quantity={quantityOf(product.id)}
              orderingOpen={status.isOpen}
              onQuantityChange={(qty) => setQuantity(product.id, qty)}
              onClosedAttempt={() => setNoticeAt(Date.now())}
            />
          ))}
        </div>
        {results.length > limit && (
          <button
            type="button"
            onClick={loadMore}
            className={cn(outlineButtonClass, 'mx-auto mt-[21px] w-40')}
          >
            Muat Lebih Banyak
          </button>
        )}
      </>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <title>Menu | Toko Kopi Irona</title>
      <meta
        name="description"
        content="Menu lengkap Toko Kopi Irona di Balung, Jember: kopi, non-kopi, dan makanan. Cari, filter harga, lalu pesan online."
      />
      <h1 className="sr-only">Menu Toko Kopi Irona</h1>
      <MenuBanner />
      <MenuFilters
        query={input}
        onQueryChange={setInput}
        filters={filters}
        onFiltersChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
      />

      <section aria-label="Daftar menu">
        <div className="mx-auto max-w-page px-4 pb-[26px] md:px-[30px]">
          <CategoryTabs
            categories={categories}
            activeId={activeId}
            onSelect={selectCategory}
            panelId={PANEL_ID}
          />
          <div
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={activeId ? `tab-${activeId}` : undefined}
            aria-label={activeId ? undefined : 'Hasil pencarian'}
            aria-busy={loading}
            className="flex flex-col"
          >
            {query && !loading && !failed && results.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {results.length} menu untuk “{query}”
              </p>
            )}
            {content}
          </div>
          {/* Jumlah hasil diumumkan setelah search / filter berubah */}
          <p aria-live="polite" className="sr-only">
            {catalog && !failed ? `${results.length} menu ditampilkan` : ''}
          </p>
        </div>
      </section>
      <ClosedNotice message={status.closedNotice} shownAt={noticeAt} />
    </MotionConfig>
  );
}
