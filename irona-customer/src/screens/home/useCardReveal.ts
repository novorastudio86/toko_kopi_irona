import { useEffect, type RefObject } from 'react';

/** Tanpa IntersectionObserver card langsung tampil (tidak disembunyikan menunggu reveal) */
export const CAN_REVEAL = typeof IntersectionObserver !== 'undefined';

/**
 * Card `.menu-card` di dalam grid muncul sekali saat pertama terlihat (animasi di menu.css).
 * Batch pertama setelah grid terisi = "switch" (ganti kategori / muat awal), berikutnya "scroll".
 * --i = urutan dalam batch untuk stagger. Card yang sudah tampil tidak dianimasikan ulang,
 * jadi card baru (key berbeda) saja yang masuk. `items` = daftar yang dirender; efek jalan ulang
 * tiap daftar berubah; `items` falsy = tahan dulu (card tetap tersembunyi). Grid perlu class
 * `menu-reveal` (kalau CAN_REVEAL) supaya card tersembunyi dulu.
 */
export function useCardReveal(gridRef: RefObject<HTMLElement | null>, items: unknown) {
  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('.menu-card:not([data-shown])');
    if (!CAN_REVEAL || !items || !cards?.length) return;
    let firstBatch = true;
    const observer = new IntersectionObserver((entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry, i) => {
          const card = entry.target as HTMLElement;
          card.style.setProperty('--i', String(i));
          card.dataset.shown = firstBatch ? 'switch' : 'scroll';
          observer.unobserve(card);
        });
      firstBatch = false;
    });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [gridRef, items]);
}
