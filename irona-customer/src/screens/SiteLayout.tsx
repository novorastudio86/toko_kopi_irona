import { Outlet } from 'react-router';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SplashScreen from '@/components/SplashScreen';

export default function SiteLayout() {
  return (
    // min-h-svh + main flex-1: halaman pendek (mis. hasil filter sedikit) tetap menaruh footer di dasar layar
    <div className="flex min-h-svh flex-col">
      <SplashScreen />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
