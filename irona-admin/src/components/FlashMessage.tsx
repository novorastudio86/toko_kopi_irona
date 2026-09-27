import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';
import { bannerVariants } from '../constants/motion';

export function FlashMessage({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div variants={bannerVariants} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
          <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-xs font-medium text-[#0f172a]">
            <CheckCircle2 className="size-4 text-[#059669]" />
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ErrorMessage({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div variants={bannerVariants} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
            <span>{message}</span>
            <button onClick={onDismiss} aria-label="Tutup">
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}