import PromoPopup from '@/components/PromoPopup';
import HeroSection from './home/HeroSection';
import KoraSection from './home/KoraSection';
import MenuSection from './home/MenuSection';
import VisitSection from './home/VisitSection';

export default function HomeScreen() {
  return (
    <>
      <HeroSection />
      <MenuSection />
      <KoraSection />
      <VisitSection />
      <PromoPopup />
    </>
  );
}
