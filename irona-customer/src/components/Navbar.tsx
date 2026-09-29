import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, ShoppingCart, X } from 'lucide-react';
import logoKoala from '@/assets/home/logo-koala.webp';
import wordmark from '@/assets/home/wordmark.webp';
import { NAV_LINKS } from '@/constants/navigation';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/lib/utils';
import NavItem from './NavItem';

export default function Navbar() {
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Desktop di Home: navbar menyatu dengan Hero sampai halaman di-scroll
  const overHero = useLocation().pathname === '/' && !scrolled;

  return (
    <header
      className={cn(
        'sticky top-0 isolate z-50 border-b border-foreground transition-colors duration-300',
        overHero && 'md:border-transparent'
      )}
    >
      {/* Dua lapisan latar supaya perpindahannya bisa di-fade (gradient tidak bisa di-transition) */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 -z-10 bg-background transition-opacity duration-300',
          overHero && 'md:opacity-0'
        )}
      />
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 -z-10 hidden bg-linear-to-b from-background/90 to-transparent transition-opacity duration-300 md:block',
          overHero ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div className="mx-auto grid h-[60px] max-w-[1200px] grid-cols-[1fr_auto_1fr] items-center px-4 md:pr-8 md:pl-[23px]">
        <button
          type="button"
          className="grid size-9 place-items-center justify-self-start rounded-[6px] border border-foreground md:hidden"
          aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <Link to="/" className="hidden justify-self-start md:block" onClick={closeMenu}>
          <img src={logoKoala} alt="Toko Kopi Irona" className="h-[30px] w-auto" />
        </Link>
        <Link to="/" className="md:hidden" onClick={closeMenu}>
          <img src={wordmark} alt="Toko Kopi Irona" className="h-9 w-auto" />
        </Link>

        <nav aria-label="Navigasi utama" className="hidden gap-[26px] md:flex">
          {NAV_LINKS.map((link) => (
            <NavItem key={link.href} link={link} className="text-xs font-medium hover:underline" />
          ))}
        </nav>

        <div className="flex items-center gap-2.5 justify-self-end">
          <Link
            to="/keranjang"
            aria-label={`Keranjang, ${itemCount} item`}
            className="relative flex h-[29px] w-11 items-center rounded-[6px] border border-foreground bg-background hover:bg-secondary md:w-auto md:gap-1.5 md:px-2.5"
          >
            <span className="hidden text-[11px] md:inline">Keranjang</span>
            <ShoppingCart
              aria-hidden
              className="mx-auto size-[17px] md:mx-0"
              strokeWidth={1.75}
            />
            {itemCount > 0 && (
              <span className="absolute -top-[3px] right-1 grid size-[14px] place-items-center rounded-full bg-border font-mono text-[8px] leading-none">
                {itemCount}
              </span>
            )}
          </Link>
          <Link
            to="/login"
            className="hidden h-[33px] w-[67px] place-items-center rounded-[6px] bg-primary text-[11px] font-medium text-primary-foreground hover:bg-primary/85 md:grid"
          >
            Login
          </Link>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Navigasi utama"
          className="flex flex-col gap-1 border-t border-foreground px-4 py-3 md:hidden"
        >
          {NAV_LINKS.map((link) => (
            <NavItem
              key={link.href}
              link={link}
              className="py-2 text-sm font-medium"
              onClick={closeMenu}
            />
          ))}
          <Link
            to="/login"
            onClick={closeMenu}
            className="mt-1 grid h-[33px] place-items-center rounded-[6px] bg-primary text-xs font-medium text-primary-foreground"
          >
            Login
          </Link>
        </nav>
      )}
    </header>
  );
}
