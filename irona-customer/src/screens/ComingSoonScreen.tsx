import { Link } from 'react-router';

export default function ComingSoonScreen() {
  return (
    <section className="mx-auto grid min-h-[50vh] max-w-[1200px] place-content-center gap-3 px-4 py-16 text-center">
      <h1 className="font-display text-3xl">Segera hadir</h1>
      <p className="text-sm text-foreground">Halaman ini sedang kami siapkan.</p>
      <Link to="/" className="text-sm font-medium underline underline-offset-4">
        Kembali ke beranda
      </Link>
    </section>
  );
}
