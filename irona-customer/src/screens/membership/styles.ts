import { cn } from '@/lib/utils';

export const headingClass = 'font-display text-2xl leading-tight md:text-[26px]';
export const sectionClass = 'mx-auto max-w-page px-4 py-7 md:px-[30px] md:py-9';

const btnClass =
  'inline-grid place-items-center rounded-[6px] border border-foreground text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40';
export const btnSolid = cn(btnClass, 'bg-primary text-primary-foreground hover:bg-primary/85');
export const btnOutline = cn(btnClass, 'bg-background hover:bg-secondary');

/** Bayangan keras ala kartu retro, sama dengan Galeri di halaman Tentang */
export const hardShadow = 'shadow-[4px_4px_0_0_var(--color-foreground)]';
