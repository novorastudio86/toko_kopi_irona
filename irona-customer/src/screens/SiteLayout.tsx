import { Outlet } from 'react-router';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SplashScreen from '@/components/SplashScreen';

export default function SiteLayout() {
  return (
    <>
      <SplashScreen />
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
