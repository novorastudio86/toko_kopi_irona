import { useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import koraNgopi from '@/assets/tentang/kora-ngopi.webp';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/utils/format';
import EventCards from './EventCards';
import {
  CHANNEL_LABELS,
  type EventItem,
  formatDate,
  formatDays,
  formatDiscountValue,
  formatHours,
  formatMinPurchase,
  isEventDone,
  countdownLabel,
  type PromoItem,
  promoTerms,
  todayIso,
  visibleItems,
} from './eventFormat';
import { FEED } from './events';

const buttonClass =
  'grid h-10 w-full place-items-center rounded-[6px] border border-foreground text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';
const solidButtonClass = cn(buttonClass, 'bg-primary text-primary-foreground hover:bg-primary/85');
const outlineButtonClass = cn(buttonClass, 'bg-background hover:bg-secondary');

const layoutClass =
  'mx-auto grid max-w-page items-start gap-6 px-4 pt-7 pb-8 md:grid-cols-[1fr_330px] md:gap-7 md:px-[30px]';
const titleClass = 'mt-3 text-3xl leading-tight font-medium md:text-[32px]';
const leadClass = 'mt-1 max-w-[640px] text-sm leading-6';
const h2Class = 'mt-8 text-lg font-medium';
// Kartu info sticky di bawah navbar (61px)
const asideClass = 'border border-foreground p-4 md:sticky md:top-[80px]';

function Chip({ solid, children }: { solid?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-full border border-foreground px-2.5 py-1 text-[11px] font-medium',
        solid && 'bg-primary text-primary-foreground'
      )}
    >
      {children}
    </span>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-[1px] uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px]">{children}</dd>
    </div>
  );
}

function ShareButton({ label, title }: { label: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = { title, url: window.location.href };
    // Web Share di HP; desktop yang tidak mendukung → salin link
    if (navigator.share) return navigator.share(data).catch(() => {});
    await navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" onClick={share} className={outlineButtonClass}>
      {copied ? 'Link disalin' : label}
    </button>
  );
}

function MapsButton({ href, children }: { href?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={solidButtonClass}>
      {children}
    </a>
  );
}

/** Promo = diskon aktif dari Promosi › Diskon (admin) */
function PromoDetail({ promo }: { promo: PromoItem }) {
  const profile = useStoreProfile();
  const isOnline = promo.channel === 'online';

  return (
    <div className={layoutClass}>
      <div>
        <div className="flex flex-wrap gap-2">
          <Chip solid>Sedang berlangsung</Chip>
          <Chip>{isOnline ? 'Online' : 'Offline'}</Chip>
          {promo.targetCustomer === 'member' && <Chip>Khusus member</Chip>}
        </div>
        <h1 className={titleClass}>{promo.name}</h1>
        <p className={leadClass}>{promo.description}</p>

        {/* Kupon: nilai potongan di kiri, garis sobek, ringkasan syarat di kanan */}
        <div className="mt-6 flex max-w-[560px] border border-foreground">
          <div className="flex shrink-0 flex-col justify-center bg-primary px-5 py-4 text-primary-foreground md:px-7">
            <span className="text-[10px] font-semibold tracking-[1px] uppercase">Potongan</span>
            <span className="mt-1 font-display text-4xl leading-none md:text-5xl">
              {formatDiscountValue(promo)}
            </span>
          </div>
          <div className="flex flex-col justify-center gap-0.5 border-l-2 border-dashed border-foreground px-4 py-3 text-[13px] md:px-5">
            <span className="font-semibold">
              untuk {promo.discountTarget === 'ongkir' ? 'ongkir' : 'harga produk'}
            </span>
            <span className="text-muted-foreground">
              {formatMinPurchase(promo)}
              {promo.isRepeatable && ' · berlaku kelipatan'}
            </span>
            <span className="text-muted-foreground">{formatDays(promo.validDays)}</span>
          </div>
        </div>

        <h2 className={h2Class}>Syarat &amp; ketentuan</h2>
        <ol className="mt-2 max-w-[640px] list-decimal pl-5 text-sm leading-6 marker:text-muted-foreground">
          {promoTerms(promo).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>

      <aside className={asideClass}>
        <dl className="flex flex-col gap-3">
          <Info label="Periode">
            {formatDate(promo.startDate)} – {formatDate(promo.endDate)}
          </Info>
          <Info label="Hari">{formatDays(promo.validDays)}</Info>
          <Info label="Jam">{formatHours(promo.validStartTime, promo.validEndTime)}</Info>
          <Info label="Berlaku di">{CHANNEL_LABELS[promo.channel]}</Info>
          <Info label="Untuk">
            {promo.targetCustomer === 'member' ? 'Member Kora Club' : 'Semua pelanggan'}
          </Info>
        </dl>
        <div className="mt-4 flex flex-col gap-3">
          {isOnline ? (
            <Link to="/menu" className={solidButtonClass}>
              Pesan sekarang
            </Link>
          ) : (
            <MapsButton href={profile?.mapsLink}>Lihat lokasi toko</MapsButton>
          )}
          <ShareButton label="Bagikan promo" title={promo.name} />
        </div>
      </aside>
    </div>
  );
}

/** Event mendatang: detail acara + kartu info (tanpa kuota), CTA ke Maps */
function UpcomingEvent({ event, today }: { event: EventItem; today: string }) {
  return (
    <div className={layoutClass}>
      <div>
        <div className="flex flex-wrap gap-2">
          <Chip solid>Akan datang · {countdownLabel(event.date, today)}</Chip>
          {event.tag && <Chip>{event.tag}</Chip>}
        </div>
        <h1 className={titleClass}>{event.title}</h1>
        <p className={leadClass}>{event.description}</p>

        {event.details && (
          <>
            <h2 className={h2Class}>Tentang acara</h2>
            {event.details.map((p) => (
              <p key={p} className="mt-2 max-w-[640px] text-sm leading-6">
                {p}
              </p>
            ))}
          </>
        )}

        {event.highlights && (
          <>
            <h2 className={h2Class}>Yang bakal ada</h2>
            <ul className="mt-3 grid max-w-[640px] gap-2 sm:grid-cols-2">
              {event.highlights.map((h) => (
                <li
                  key={h}
                  className="flex gap-2 border border-foreground px-3 py-2.5 text-[13px] leading-5"
                >
                  <span aria-hidden>✦</span>
                  {h}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <aside className={asideClass}>
        <dl className="flex flex-col gap-3">
          <Info label="Tanggal">{formatDate(event.date, 'long')}</Info>
          <Info label="Waktu">{event.time}</Info>
          <Info label="Lokasi">{event.location}</Info>
          <Info label="Biaya">
            <span className="text-xl font-semibold">
              {event.price ? formatRupiah(event.price) : 'Gratis'}
            </span>
          </Info>
        </dl>
        <div className="mt-4 flex flex-col gap-3">
          <MapsButton href={event.mapsUrl}>Buka lokasi di Maps</MapsButton>
          <ShareButton label="Bagikan event" title={event.title} />
        </div>
      </aside>
    </div>
  );
}

/** Event selesai: ringkasan singkat + dokumentasi selebar halaman */
function PastEvent({ event }: { event: EventItem }) {
  return (
    <div className="mx-auto max-w-page px-4 pt-7 pb-8 md:px-[30px]">
      <div className="flex flex-wrap gap-2">
        <Chip>Event selesai</Chip>
        {event.tag && <Chip>{event.tag}</Chip>}
      </div>
      <h1 className={titleClass}>{event.title}</h1>
      <p className={leadClass}>{event.description}</p>

      {/* Pengganti kartu info samping: tidak ada lagi pendaftaran/biaya */}
      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-y border-foreground py-3">
        <Info label="Tanggal">{formatDate(event.date, 'long')}</Info>
        <Info label="Waktu">{event.time}</Info>
        <Info label="Lokasi">{event.location}</Info>
      </dl>

      {event.photos?.length ? <Documentation title={event.title} photos={event.photos} /> : null}
    </div>
  );
}

const iconButtonClass =
  'grid size-8 place-items-center rounded-[6px] border border-foreground hover:bg-secondary';

// Tinggi foto bergantian supaya kolom masonry tidak rata/flat
const PHOTO_ASPECTS = ['aspect-[4/5]', 'aspect-[4/3]', 'aspect-square'];

function Documentation({
  title,
  photos,
}: {
  title: string;
  photos: NonNullable<EventItem['photos']>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  const step = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);
  const altOf = (i: number) => photos[i].caption ?? `Dokumentasi ${title} ${i + 1}`;

  return (
    <section aria-labelledby="dokumentasi-title" className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div className="pb-3">
          <h2 id="dokumentasi-title" className="font-display text-2xl leading-[22px]">
            Dokumentasi
          </h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {photos.length} momen dari acara ini — klik foto untuk memperbesar.
          </p>
        </div>
        {/* Kora "ngintip" dari atas galeri */}
        <img src={koraNgopi} alt="" aria-hidden className="relative z-10 -mb-3 h-20 md:h-24" />
      </div>

      <ul className="columns-2 gap-2 md:columns-3 md:gap-3.5">
        {photos.map((p, i) => (
          <li key={p.src} className="mb-2 break-inside-avoid md:mb-3.5">
            <button
              type="button"
              onClick={() => {
                setIndex(i);
                dialogRef.current?.showModal();
              }}
              className={cn(
                'group relative block w-full overflow-hidden border border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                PHOTO_ASPECTS[i % PHOTO_ASPECTS.length]
              )}
            >
              <img
                src={p.src}
                alt={altOf(i)}
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {p.caption && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-8 pb-2 text-left text-[11px] text-white md:text-xs">
                  {p.caption}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Lightbox: <dialog> native (Esc menutup, fokus terkunci) */}
      <dialog
        ref={dialogRef}
        aria-label={`Foto dokumentasi ${title}`}
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') step(-1);
          if (e.key === 'ArrowRight') step(1);
        }}
        className="m-auto w-[min(960px,92vw)] bg-transparent backdrop:bg-black/80"
      >
        <figure className="border border-foreground bg-background p-2">
          <img src={photo.src} alt={altOf(index)} className="max-h-[75vh] w-full object-contain" />
          <figcaption className="flex items-center justify-between gap-3 px-1 pt-2 text-[13px]">
            <span>{photo.caption}</span>
            {/* method="dialog": tombol submit menutup lightbox tanpa JS */}
            <form method="dialog" className="flex shrink-0 items-center gap-1">
              <span className="mr-1 text-muted-foreground">
                {index + 1} / {photos.length}
              </span>
              <button
                type="button"
                aria-label="Foto sebelumnya"
                onClick={() => step(-1)}
                className={iconButtonClass}
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Foto berikutnya"
                onClick={() => step(1)}
                className={iconButtonClass}
              >
                <ChevronRight className="size-4" />
              </button>
              <button aria-label="Tutup" className={iconButtonClass}>
                <X className="size-4" />
              </button>
            </form>
          </figcaption>
        </figure>
      </dialog>
    </section>
  );
}

/** Detail promo (diskon aktif), event mendatang, dan event selesai */
export default function EventDetailScreen() {
  const { id } = useParams();
  const today = todayIso();
  const item = visibleItems(FEED, today).find((e) => e.id === id);
  if (!item) return <Navigate to="/tentang" replace />;

  const isPromo = item.kind === 'promo';
  const title = isPromo ? item.name : item.title;

  return (
    <>
      <title>{`${title} | Toko Kopi Irona`}</title>

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
              {isPromo ? 'Promo' : 'Event'}
            </Link>{' '}
            ›
          </li>
          <li aria-current="page" className="text-foreground">
            {title}
          </li>
        </ol>
      </nav>

      <img
        src={item.image}
        alt=""
        fetchPriority="high"
        className="h-[200px] w-full border-b border-foreground object-cover md:h-[298px]"
      />

      {/* key: reset state (indeks lightbox, "Link disalin") saat pindah ke item lain */}
      <section key={item.id} className="border-b border-foreground">
        {isPromo ? (
          <PromoDetail promo={item} />
        ) : isEventDone(item, today) ? (
          <PastEvent event={item} />
        ) : (
          <UpcomingEvent event={item} today={today} />
        )}
      </section>

      <EventCards />
    </>
  );
}
