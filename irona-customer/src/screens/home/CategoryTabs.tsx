import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/category';

const fadeClass =
  'pointer-events-none absolute inset-y-0 w-10 from-background to-transparent transition-opacity duration-200';
/** Lebar fade; tab aktif digeser sejauh ini dari tepi supaya tidak tertutup gradient */
const FADE_PX = 40;

/** "BASIC COFFEE" → "Basic Coffee" (hanya tampilan, data sumber tidak diubah) */
function toTitleCase(text: string) {
  return text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/**
 * Tab kategori scroll horizontal; gradient fade di tepi menandakan masih ada tab di luar layar.
 * Tab id = `tab-<categoryId>`, dipakai MenuSection untuk aria-labelledby tabpanel.
 */
export default function CategoryTabs({
  categories,
  activeId,
  onSelect,
  panelId,
}: {
  categories: Category[] | null;
  activeId: string | null;
  onSelect: (id: string) => void;
  panelId: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ left: false, right: false });

  const updateFade = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setFade({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  // ResizeObserver langsung memanggil callback saat observe → cek awal + tiap ukuran berubah.
  // Dibuat ulang saat kategori datang karena lebar isi list ikut berubah.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateFade);
    observer.observe(el);
    return () => observer.disconnect();
  }, [categories, updateFade]);

  // Geser list secara horizontal saja (bukan scrollIntoView) supaya halaman tidak ikut loncat
  useEffect(() => {
    const list = listRef.current;
    const tab = activeId ? document.getElementById(`tab-${activeId}`) : null;
    if (!list || !tab) return;
    const left = tab.offsetLeft - FADE_PX;
    const right = tab.offsetLeft + tab.offsetWidth + FADE_PX - list.clientWidth;
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (left < list.scrollLeft) list.scrollTo({ left, behavior });
    else if (right > list.scrollLeft) list.scrollTo({ left: right, behavior });
  }, [activeId, categories]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!categories?.length) return;
    const last = categories.length - 1;
    const index = categories.findIndex((c) => c.id === activeId);
    const next = (
      {
        ArrowRight: index === last ? 0 : index + 1,
        ArrowLeft: index <= 0 ? last : index - 1,
        Home: 0,
        End: last,
      } as Record<string, number>
    )[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = categories[next];
    onSelect(target.id);
    document.getElementById(`tab-${target.id}`)?.focus({ preventScroll: true });
  };

  return (
    <div className="sticky top-[61px] z-20 -mx-4 mt-3 bg-background py-2 md:-mx-[30px]">
      {/* layoutScroll: posisi indikator dihitung ikut scrollLeft list.
          min-h = tinggi tab, jadi selagi kategori dimuat baris ini tidak kosong lalu mendorong halaman */}
      <motion.div
        layoutScroll
        ref={listRef}
        role="tablist"
        aria-label="Kategori menu"
        onScroll={updateFade}
        onKeyDown={onKeyDown}
        className="no-scrollbar relative flex min-h-9 overflow-x-auto px-4 md:px-[30px] pointer-coarse:min-h-10"
      >
        {categories?.map((category, i) => {
          const selected = category.id === activeId;
          return (
            <button
              key={category.id}
              id={`tab-${category.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              // Tanpa tab aktif (mis. saat search di /menu) tab pertama tetap bisa difokus
              tabIndex={selected || (!activeId && i === 0) ? 0 : -1}
              onClick={() => onSelect(category.id)}
              className={cn(
                'relative -ml-px h-9 min-w-[84px] shrink-0 border px-3 font-display text-[13px] menu-tab pointer-coarse:h-10 whitespace-nowrap first:ml-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current active:scale-[0.97]',
                selected
                  ? 'border-primary bg-secondary text-primary-foreground'
                  : 'border-border bg-secondary text-foreground hover:bg-card'
              )}
            >
              {/* Latar gelap tab aktif = satu elemen bersama yang meluncur antar tab (motion layoutId).
                  Tombol tanpa z-index → indikator (z-1) di atas border tetangga, semua label (z-2) di atasnya.
                  Warna label bertransisi dengan durasi & easing yang sama dengan indikator. */}
              {selected && (
                <motion.span
                  layoutId="menu-tab-indicator"
                  aria-hidden
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute -inset-px z-[1] bg-primary"
                />
              )}
              <span className="relative z-[2]">
                {toTitleCase(category.name)}
              </span>
            </button>
          );
        })}
      </motion.div>
      <div
        aria-hidden
        className={cn(fadeClass, 'left-0 bg-linear-to-r', fade.left ? 'opacity-100' : 'opacity-0')}
      />
      <div
        aria-hidden
        className={cn(
          fadeClass,
          'right-0 bg-linear-to-l',
          fade.right ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}
