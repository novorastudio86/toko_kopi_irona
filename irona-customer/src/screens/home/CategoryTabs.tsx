import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/category';

const fadeClass =
  'pointer-events-none absolute inset-y-0 w-10 from-background to-transparent transition-opacity duration-200';

/** Tab kategori scroll horizontal; gradient fade di tepi menandakan masih ada tab di luar layar */
export default function CategoryTabs({
  categories,
  activeId,
  onSelect,
}: {
  categories: Category[] | null;
  activeId: string | null;
  onSelect: (id: string) => void;
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

  return (
    <div className="relative -mx-4 mt-3 md:mx-0">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Kategori menu"
        onScroll={updateFade}
        className="no-scrollbar flex h-[33px] overflow-x-auto px-4 md:px-0"
      >
        {categories?.map((category) => {
          const selected = category.id === activeId;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(category.id)}
              className={cn(
                '-ml-px h-[33px] min-w-[84px] shrink-0 border px-[9px] font-display text-[13px] whitespace-nowrap first:ml-0',
                selected
                  ? 'relative border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-secondary text-foreground hover:bg-stripe'
              )}
            >
              {category.onlineName ?? category.name}
            </button>
          );
        })}
      </div>
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
