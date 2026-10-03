import { useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { Link, useParams } from 'react-router';
import { categoryKind, fetchOnlineCategories } from '@/services/categories';
import { fetchAllOnlineProducts } from '@/services/products';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import { formatRupiah } from '@/utils/format';
import ClosedNotice from './home/ClosedNotice';
import MenuImage from './home/MenuImage';
import { menuGridClass } from './home/MenuSection';
import { useMenuStatus } from './home/menuStatus';
import ProductCard from './home/ProductCard';
import { MAX_QTY, useQuickCart } from './home/useQuickCart';
import './home/menu.css';

// Detail menu (Figma 659:264), gaya mengikuti halaman /menu.
// ponytail: opsi ukuran/suhu/gula masih statis dan keranjang hanya menyimpan qty per produk;
// pilihan opsi + catatan ikut tersimpan setelah keranjang asli (item + varian) dibangun.
const SIZES = [
  { label: 'Small', extra: 0 },
  { label: 'Medium', extra: 1000 },
  { label: 'Large', extra: 2000 },
];
const TEMPS = ['Hot', 'Ice'];
const SUGARS = ['Normal', 'Less', 'Tanpa gula'];
const RECOMMENDED_PAGE = 4;

const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';

interface Catalog {
  categories: Category[];
  products: Product[];
}

/** Grup pilihan radio: pill outline, terisi gelap saat dipilih */
function OptionGroup({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className="grid h-[23px] cursor-pointer place-items-center rounded-[6px] border border-foreground px-2.5 text-[11px] transition-colors hover:bg-secondary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground pointer-coarse:h-9"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** key = id: pindah menu (mis. dari Recommended) memasang ulang halaman, jadi pilihan kembali default */
export default function MenuDetailScreen() {
  const { id } = useParams();
  return <MenuDetail key={id} id={id} />;
}

function MenuDetail({ id }: { id: string | undefined }) {
  const status = useMenuStatus();
  const { quantityOf, setQuantity } = useQuickCart();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState<{ message: string; at: number } | null>(null);

  const [size, setSize] = useState(SIZES[0].label);
  const [temp, setTemp] = useState(TEMPS[0]);
  const [sugar, setSugar] = useState(SUGARS[0]);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);
  const [recommendedLimit, setRecommendedLimit] = useState(RECOMMENDED_PAGE);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchOnlineCategories(), fetchAllOnlineProducts()])
      .then(([categories, products]) => {
        if (!cancelled) setCatalog({ categories, products });
      })
      .catch((err) => {
        console.error('Gagal memuat detail menu', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const product = catalog?.products.find((p) => p.id === id);
  const category = catalog?.categories.find((c) => c.id === product?.categoryId);
  const isDrink = product ? categoryKind(product.categoryId) === 'minuman' : false;

  const recommended = useMemo(
    () => catalog?.products.filter((p) => p.isRecommended && p.id !== id) ?? [],
    [catalog, id]
  );

  const showToast = (message: string) => setToast({ message, at: Date.now() });

  if (failed || (catalog && !product)) {
    return (
      <section className="mx-auto grid min-h-[50vh] max-w-page place-content-center gap-3 px-4 py-16 text-center">
        <h1 className="font-display text-3xl">
          {failed ? 'Koneksinya lagi pelan' : 'Menu tidak ditemukan'}
        </h1>
        <Link to="/menu" className="text-sm font-medium underline underline-offset-4">
          Kembali ke menu
        </Link>
      </section>
    );
  }

  if (!product) {
    return (
      <div aria-busy className="mx-auto max-w-page px-4 py-6 md:px-[30px]">
        <div className="grid gap-5 md:grid-cols-[441px_1fr]">
          <div className="aspect-[441/340] animate-pulse bg-secondary motion-reduce:animate-none" />
          <div className="h-40 animate-pulse bg-secondary motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  const { name, sellingPrice, isSoldOut } = product;
  const extra = isDrink ? (SIZES.find((s) => s.label === size)?.extra ?? 0) : 0;
  const total = sellingPrice === null ? null : (sellingPrice + extra) * qty;
  const categoryName = category ? (category.onlineName ?? category.name) : null;
  const canOrder = !isSoldOut && sellingPrice !== null;

  const addToCart = () => {
    if (!status.isOpen) return showToast(status.closedNotice);
    setQuantity(product.id, Math.min(MAX_QTY, quantityOf(product.id) + qty));
    showToast(`${qty} ${name} ditambahkan ke keranjang`);
  };

  return (
    <MotionConfig reducedMotion="user">
      <title>{`${name} | Toko Kopi Irona`}</title>

      <nav aria-label="Breadcrumb" className="border-b border-foreground">
        <ol className="mx-auto flex max-w-page flex-wrap gap-1 px-4 py-2.5 text-[11px] text-muted-foreground md:px-[30px]">
          <li>
            <Link to="/menu" className="hover:underline">
              Menu
            </Link>{' '}
            ›
          </li>
          {categoryName && <li>{categoryName} ›</li>}
          <li aria-current="page" className="text-foreground">
            {name}
          </li>
        </ol>
      </nav>

      <section className="border-b border-foreground">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addToCart();
          }}
          className="mx-auto grid max-w-page gap-x-5 gap-y-4 px-4 py-4 md:grid-cols-[441px_1fr] md:px-[30px]"
        >
          <div className="menu-card-frame aspect-[441/340] overflow-hidden border border-foreground bg-card">
            <MenuImage src={product.photoUrl} alt={name} />
          </div>

          <div className="flex flex-col gap-3">
            {categoryName && (
              <span className="self-start border border-foreground bg-secondary px-2 py-1 font-display text-sm">
                {categoryName}
              </span>
            )}
            <div>
              <h1 className="text-2xl leading-tight font-medium md:text-[26px]">{name}</h1>
              <p className="mt-1 text-lg font-medium tabular-nums md:text-xl">
                {sellingPrice === null ? '-' : formatRupiah(sellingPrice)}
              </p>
            </div>
            {/* TODO(backend): tabel products belum punya kolom deskripsi */}
            <p className="max-w-[671px] text-sm leading-6">
              Deskripsi singkat menu akan tampil di sini: rasa, bahan utama, dan rekomendasi
              penyajian.
            </p>
            {isDrink && (
              <div className="grid gap-2.5">
                <OptionGroup
                  name="size"
                  label="Ukuran"
                  options={SIZES.map((s) => ({
                    value: s.label,
                    label: s.extra ? `${s.label} (+${s.extra})` : s.label,
                  }))}
                  value={size}
                  onChange={setSize}
                />
                <OptionGroup
                  name="temp"
                  label="Suhu"
                  options={TEMPS.map((t) => ({ value: t, label: t }))}
                  value={temp}
                  onChange={setTemp}
                />
                <OptionGroup
                  name="sugar"
                  label="Tingkat Gula"
                  options={SUGARS.map((s) => ({ value: s, label: s }))}
                  value={sugar}
                  onChange={setSugar}
                />
              </div>
            )}
          </div>

          <label className="grid gap-1.5 text-xs font-medium md:col-span-2">
            Catatan (Opsional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder="Contoh: tanpa es, susu oat…"
              className={cn(
                'h-[33px] rounded-[6px] border border-foreground bg-background px-3 text-[11px] font-normal placeholder:text-muted-foreground',
                focusClass
              )}
            />
          </label>

          <div className="flex gap-3 md:col-span-2">
            <div className="flex h-[38px] w-[92px] shrink-0 items-center rounded-[6px] border border-foreground text-sm">
              <button
                type="button"
                onClick={() => setQty((q) => q - 1)}
                disabled={qty <= 1}
                aria-label={`Kurangi jumlah ${name}`}
                className={cn('h-full flex-1 rounded-[6px] disabled:opacity-40', focusClass)}
              >
                −
              </button>
              <span aria-live="polite" className="min-w-5 text-center tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                disabled={qty >= MAX_QTY}
                aria-label={`Tambah jumlah ${name}`}
                className={cn('h-full flex-1 rounded-[6px] disabled:opacity-40', focusClass)}
              >
                +
              </button>
            </div>
            <button
              type="submit"
              disabled={!canOrder}
              aria-disabled={!status.isOpen || undefined}
              className={cn(
                'h-[38px] flex-1 rounded-[6px] text-sm font-medium transition-colors',
                focusClass,
                !canOrder
                  ? 'cursor-not-allowed border border-border text-muted-foreground'
                  : status.isOpen
                    ? 'bg-primary text-primary-foreground hover:bg-primary/85'
                    : 'cursor-not-allowed border border-dashed border-muted-foreground text-muted-foreground'
              )}
            >
              {isSoldOut
                ? 'Habis'
                : `Tambahkan Keranjang - ${total === null ? '-' : formatRupiah(total)}`}
            </button>
          </div>
        </form>
      </section>

      {recommended.length > 0 && (
        <section aria-labelledby="recommended-title">
          <div className="mx-auto flex max-w-page flex-col px-4 pt-4 pb-[26px] md:px-[30px]">
            <h2 id="recommended-title" className="text-xs font-medium">
              Recommended
            </h2>
            <div className={cn('mt-2', menuGridClass)}>
              {recommended.slice(0, recommendedLimit).map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  quantity={quantityOf(p.id)}
                  orderingOpen={status.isOpen}
                  onQuantityChange={(q) => setQuantity(p.id, q)}
                  onClosedAttempt={() => showToast(status.closedNotice)}
                />
              ))}
            </div>
            {recommended.length > recommendedLimit && (
              <button
                type="button"
                onClick={() => setRecommendedLimit((n) => n + RECOMMENDED_PAGE)}
                className={cn(
                  'mx-auto mt-[21px] grid h-[33px] w-40 place-items-center rounded-[6px] border border-foreground bg-background text-[11px] font-medium transition-colors hover:bg-secondary',
                  focusClass
                )}
              >
                Muat Lebih Banyak
              </button>
            )}
          </div>
        </section>
      )}

      <ClosedNotice message={toast?.message ?? ''} shownAt={toast?.at ?? null} />
    </MotionConfig>
  );
}
