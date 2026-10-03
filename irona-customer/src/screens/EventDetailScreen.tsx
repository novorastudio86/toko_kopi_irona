import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/utils/format';
import EventCards from './tentang/EventCards';
import { EVENTS } from './tentang/events';

const buttonClass =
  'grid h-10 w-full place-items-center rounded-[6px] border border-foreground text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';
const solidButtonClass = cn(buttonClass, 'bg-primary text-primary-foreground hover:bg-primary/85');
const outlineButtonClass = cn(buttonClass, 'bg-background hover:bg-secondary');
const mutedButtonClass = cn(
  buttonClass,
  'cursor-not-allowed border-dashed border-muted-foreground text-muted-foreground'
);

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-[1px] uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px]">{children}</dd>
    </div>
  );
}

/** Detail event & promo (Figma 710:332 event, 715:513 promo) */
export default function EventDetailScreen() {
  const { id } = useParams();
  const [copied, setCopied] = useState(false);
  // Pindah dari kartu lain (di bawah halaman) → mulai dari atas
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);
  const item = EVENTS.find((e) => e.id === id);
  if (!item) return <Navigate to="/tentang" replace />;

  const isEvent = item.kind === 'event';
  const kindLabel = isEvent ? 'Event' : 'Promo';
  const soldOut = item.quota.left <= 0;
  const quotaRatio = item.quota.left / item.quota.total;

  const share = async () => {
    const data = { title: item.title, url: window.location.href };
    // Web Share di HP; desktop yang tidak mendukung → salin link
    if (navigator.share) return navigator.share(data).catch(() => {});
    await navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <title>{`${item.title} | Toko Kopi Irona`}</title>

      <nav aria-label="Breadcrumb" className="border-b border-foreground">
        <ol className="mx-auto flex max-w-page flex-wrap gap-1 px-4 py-2.5 text-[11px] text-muted-foreground md:px-[30px]">
          <li>
            <Link to="/tentang" className="hover:underline">
              Tentang
            </Link>{' '}
            ›
          </li>
          <li>
            <Link to="/tentang#event" className="hover:underline">
              {kindLabel}
            </Link>{' '}
            ›
          </li>
          <li aria-current="page" className="text-foreground">
            {item.title}
          </li>
        </ol>
      </nav>

      <img
        src={item.image}
        alt=""
        fetchPriority="high"
        className="h-[200px] w-full border-b border-foreground object-cover md:h-[298px]"
      />

      <section className="border-b border-foreground">
        <div className="mx-auto grid max-w-page items-start gap-6 px-4 pt-7 pb-8 md:grid-cols-[1fr_330px] md:gap-7 md:px-[30px]">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                {item.status}
              </span>
              {item.tag && (
                <span className="rounded-full border border-foreground px-2.5 py-1 text-[11px] font-medium">
                  {item.tag}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl leading-tight font-medium md:text-[32px]">{item.title}</h1>
            <p className="mt-1 max-w-[640px] text-sm leading-6">{item.description}</p>

            {isEvent ? (
              <>
                <h2 className="mt-10 text-lg font-medium">Rundown</h2>
                <ol className="mt-2 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-sm">
                  {item.rundown?.map((r) => (
                    <li key={r.time} className="contents">
                      <span className="font-mono text-[13px] leading-6">{r.time}</span>
                      <span className="leading-6">{r.text}</span>
                    </li>
                  ))}
                </ol>

                <h2 className="mt-5 text-lg font-medium">Dokumentasi</h2>
                <div className="mt-2 grid grid-cols-3 gap-2 md:gap-3.5">
                  {item.photos?.map((src) => (
                    <img
                      key={src}
                      src={src}
                      alt={`Dokumentasi ${item.title}`}
                      loading="lazy"
                      className="aspect-[250/120] w-full border border-foreground object-cover"
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-10 text-lg font-medium md:mt-24">Jadwal Promo</h2>
                <p className="mt-1 text-sm leading-6">{item.period}</p>
              </>
            )}
          </div>

          {/* Kartu info sticky di bawah navbar (61px) */}
          <aside className="border border-foreground p-4 md:sticky md:top-[80px]">
            <dl className="flex flex-col gap-3">
              {isEvent && <Info label="Tanggal">{item.fullDate}</Info>}
              {isEvent && <Info label="Waktu">{item.time}</Info>}
              <Info label="Lokasi">{item.location}</Info>
              <Info label={isEvent ? 'Kuota' : 'Kuota promo'}>
                {soldOut
                  ? 'Kuota habis'
                  : `${item.quota.left} dari ${item.quota.total} ${isEvent ? 'kursi ' : ''}tersisa`}
                <span
                  aria-hidden
                  className="mt-1.5 block h-[7px] overflow-hidden rounded-full border border-foreground"
                >
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${(1 - quotaRatio) * 100}%` }}
                  />
                </span>
              </Info>
              {isEvent && item.price !== undefined && (
                <Info label="Biaya">
                  <span className="text-xl font-semibold">
                    {item.price ? formatRupiah(item.price) : 'Gratis'}
                  </span>
                </Info>
              )}
            </dl>

            <div className="mt-4 flex flex-col gap-3">
              {isEvent ? (
                // TODO(backend): alur pendaftaran / waiting list
                <button type="button" className={solidButtonClass}>
                  {soldOut ? 'Daftar waiting list' : 'Daftar sekarang'}
                </button>
              ) : soldOut ? (
                <span aria-disabled className={mutedButtonClass}>
                  Kuota habis
                </span>
              ) : (
                <Link to="/menu" className={solidButtonClass}>
                  Pesan Sekarang
                </Link>
              )}
              <button type="button" onClick={share} className={outlineButtonClass}>
                {copied ? 'Link disalin' : `Bagikan ${kindLabel.toLowerCase()}`}
              </button>
            </div>
          </aside>
        </div>
      </section>

      <EventCards />
    </>
  );
}
