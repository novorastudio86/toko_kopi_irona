import { useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react';
import { useLocation, useOutlet } from 'react-router';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SplashScreen from '@/components/SplashScreen';
import {
  COVER_EASE,
  PAGE_CONTENT_DELAY,
  PAGE_COVER,
  PAGE_REVEAL,
  REVEAL_EASE,
} from '@/constants/motion';
import type { PageContext } from '@/hooks/usePageSettled';

/** Tirai: covered (menutup) → revealed (tergulung ke atas); keluar halaman = covering (memudar masuk) */
const curtain: Variants = {
  covered: { scaleY: 1, opacity: 1 },
  revealed: { scaleY: 0, opacity: 1, transition: { duration: PAGE_REVEAL, ease: REVEAL_EASE } },
  covering: {
    scaleY: 1,
    opacity: [0, 1],
    transition: { scaleY: { duration: 0 }, opacity: { duration: PAGE_COVER, ease: COVER_EASE } },
  },
};

export default function SiteLayout() {
  const { pathname } = useLocation();
  /** covered: animasi CSS konten baru ditahan (index.css) → opening: boleh jalan → settled: tirai sudah habis */
  const [phase, setPhase] = useState<'covered' | 'opening' | 'settled'>('settled');
  const openingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const outlet = useOutlet({ settled: phase === 'settled' } satisfies PageContext);

  // Halaman lama sudah tertutup tirai: scroll ke atas tanpa terlihat, lalu halaman baru masuk
  const onCovered = () => {
    // Link "/tentang#event": TentangScreen sendiri yang scroll ke anchor
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
    clearTimeout(openingTimer.current);
    setPhase('covered');
    openingTimer.current = setTimeout(
      () => setPhase((p) => (p === 'covered' ? 'opening' : p)),
      PAGE_CONTENT_DELAY * 1000
    );
  };

  return (
    // min-h-svh + main flex-1: halaman pendek (mis. hasil filter sedikit) tetap menaruh footer di dasar layar
    <div className="flex min-h-svh flex-col">
      <SplashScreen />
      <Navbar />
      <main data-page-entering={phase === 'covered' || undefined} className="flex-1">
        <MotionConfig reducedMotion="user">
          {/* mode wait: halaman baru baru dipasang setelah tirai halaman lama selesai menutup */}
          <AnimatePresence mode="wait" initial={false} onExitComplete={onCovered}>
            <motion.div key={pathname} initial="covered" animate="revealed" exit="covering">
              {outlet}
              <motion.div
                aria-hidden
                variants={curtain}
                onAnimationComplete={(name) => name === 'revealed' && setPhase('settled')}
                className="fixed inset-0 z-[90] origin-top bg-background will-change-transform"
              />
            </motion.div>
          </AnimatePresence>
        </MotionConfig>
      </main>
      <Footer />
    </div>
  );
}
