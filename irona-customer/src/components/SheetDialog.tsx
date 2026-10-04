import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pop-up dasar: <dialog> native (focus trap + Esc gratis). Mobile = bottom-sheet, md+ = modal.
 * Pasang hanya saat terbuka (`{open && <SheetDialog …/>}`) supaya isinya selalu mulai dari awal.
 * Esc, klik latar, dan tombol X memanggil onClose. `large` = versi lebih lega untuk form panjang.
 */
export default function SheetDialog({
  title,
  description,
  onClose,
  large = false,
  children,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  large?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cn(
        'm-0 mt-auto flex max-h-[90dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl border border-foreground bg-background p-0 text-foreground backdrop:bg-black/50 not-open:hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 md:m-auto md:rounded-[6px]',
        large ? 'md:max-w-[480px]' : 'md:max-w-[420px]'
      )}
    >
      <div
        className={cn(
          'flex items-start justify-between gap-3 border-b border-foreground',
          large ? 'px-5 py-4' : 'px-4 py-3'
        )}
      >
        <div>
          <h2 id={titleId} className={cn('font-semibold', large ? 'text-lg' : 'text-sm')}>
            {title}
          </h2>
          {description && (
            <p
              className={cn(
                'mt-0.5 text-muted-foreground',
                large ? 'text-sm leading-6' : 'text-xs leading-5'
              )}
            >
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full hover:bg-secondary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
          )}
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className={cn('overflow-y-auto', large ? 'px-5 py-5' : 'px-4 py-4')}>{children}</div>
    </dialog>
  );
}
