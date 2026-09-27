import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { modalVariants, overlayVariants } from '../constants/motion';

type Props = {
  open: boolean;
  onBackdropClick?: () => void;
  /** Kelas untuk panel, mis. "max-w-3xl" */
  panelClassName?: string;
  labelledBy?: string;
  children: ReactNode;
};

export function ModalShell({ open, onBackdropClick, panelClassName = 'max-w-3xl', labelledBy, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onBackdropClick}
            className="absolute inset-0 bg-[#0f172a]/40"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`relative flex max-h-[92vh] w-full ${panelClassName} flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}