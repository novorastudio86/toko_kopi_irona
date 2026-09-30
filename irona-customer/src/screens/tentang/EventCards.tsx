import { Link } from 'react-router';
import { EVENTS } from './events';

/** Section "Event & Promo Terbaru" — dipakai di halaman Tentang dan detail event/promo */
export default function EventCards() {
  return (
    <section id="event" aria-labelledby="event-title" className="border-b border-foreground">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-8 md:px-[30px] md:pb-[34px]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="event-title" className="font-display text-2xl leading-[22px]">
            Event &amp; Promo Terbaru
          </h2>
          {/* TODO: arahkan ke halaman daftar event setelah halamannya ada */}
          <span className="shrink-0 text-[11px]">Semua event →</span>
        </div>
        <div className="mt-4 grid gap-3.5 md:grid-cols-3">
          {EVENTS.map((e) => (
            <article
              key={e.id}
              className="relative border border-foreground p-[9px] transition-colors hover:bg-secondary"
            >
              <img
                src={e.image}
                alt=""
                loading="lazy"
                className="aspect-[352/150] w-full border border-foreground object-cover"
              />
              <p className="mt-1.5 text-[10px] leading-[13px]">{e.date}</p>
              <h3 className="text-sm leading-[17px] font-semibold">{e.title}</h3>
              <p className="mt-2.5 text-[11px] leading-[15px] text-muted-foreground">
                {e.description}
              </p>
              {/* Stretched link: seluruh kartu bisa diklik */}
              <Link
                to={`/tentang/${e.id}`}
                aria-label={`Baca selengkapnya: ${e.title}`}
                className="mt-1 block text-[10px] leading-[13px] after:absolute after:inset-0 hover:underline"
              >
                Baca selengkapnya →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
