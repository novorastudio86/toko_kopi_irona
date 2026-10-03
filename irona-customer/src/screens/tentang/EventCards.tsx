import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import {
  type FeedItem,
  formatDate,
  formatDiscountValue,
  formatMinPurchase,
  isEventDone,
  todayIso,
  visibleItems,
} from './eventFormat';
import { FEED } from './events';

function cardText(item: FeedItem, today: string) {
  if (item.kind === 'promo') {
    return {
      badge: 'Promo',
      date: `Berlaku s.d. ${formatDate(item.endDate)}`,
      title: item.name,
      description: `Potongan ${formatDiscountValue(item)} · ${formatMinPurchase(item)} · ${item.channel === 'online' ? 'Online' : 'Offline'}`,
    };
  }
  return {
    badge: isEventDone(item, today) ? 'Selesai' : 'Akan datang',
    date: `${formatDate(item.date)} · ${item.time}`,
    title: item.title,
    description: item.description,
  };
}

/** Section "Event & Promo Terbaru" — dipakai di halaman Tentang dan detail event/promo */
export default function EventCards() {
  const today = todayIso();

  return (
    <section id="event" aria-labelledby="event-title" className="border-b border-foreground">
      <div className="mx-auto max-w-page px-4 pt-6 pb-8 md:px-[30px] md:pb-[34px]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="event-title" className="font-display text-2xl leading-[22px]">
            Event &amp; Promo Terbaru
          </h2>
          {/* TODO: arahkan ke halaman daftar event setelah halamannya ada */}
          <span className="shrink-0 text-[11px]">Semua event →</span>
        </div>
        <div className="mt-4 grid gap-3.5 md:grid-cols-3">
          {visibleItems(FEED, today).map((item) => {
            const t = cardText(item, today);
            return (
              <article
                key={item.id}
                className="relative border border-foreground p-[9px] transition-colors hover:bg-secondary"
              >
                <div className="relative">
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="aspect-[352/150] w-full border border-foreground object-cover"
                  />
                  <span
                    className={cn(
                      'absolute top-2 left-2 rounded-full border border-foreground px-2 py-0.5 text-[10px] font-medium',
                      t.badge === 'Selesai'
                        ? 'bg-background text-muted-foreground'
                        : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {t.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] leading-[13px]">{t.date}</p>
                <h3 className="text-sm leading-[17px] font-semibold">{t.title}</h3>
                <p className="mt-2.5 text-[11px] leading-[15px] text-muted-foreground">
                  {t.description}
                </p>
                {/* Stretched link: seluruh kartu bisa diklik */}
                <Link
                  to={`/tentang/${item.id}`}
                  aria-label={`Baca selengkapnya: ${t.title}`}
                  className="mt-1 block text-[10px] leading-[13px] after:absolute after:inset-0 hover:underline"
                >
                  Baca selengkapnya →
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
