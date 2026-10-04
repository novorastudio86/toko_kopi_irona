import { useEffect, useState } from 'react';
import { ArrowRight, BadgePercent, Coins, Gift, ShoppingBag, Store, Ticket } from 'lucide-react';
import heroPhoto from '@/assets/membership/membership-hero.webp';
import koraNgopi from '@/assets/tentang/kora-ngopi.webp';
import { useMember } from '@/hooks/useMember';
import { cn } from '@/lib/utils';
import { fetchActiveRewards, fetchPointTiers } from '@/services/membership';
import type { PointTier, Reward } from '@/types/membership';
import { formatRupiah } from '@/utils/format';
import RewardCard from './RewardCard';
import { btnOutline, btnSolid, hardShadow, headingClass, sectionClass } from './styles';

const BENEFITS = [
  {
    icon: Coins,
    title: 'Poin dari setiap belanja',
    text: 'Pesan online atau ngopi langsung di toko, poinnya tetap masuk ke akunmu.',
  },
  {
    icon: Gift,
    title: 'Tukar jadi menu gratis',
    text: 'Kopi, camilan, sampai paket hemat, tinggal pilih reward yang kamu mau.',
  },
  {
    icon: BadgePercent,
    title: 'Promo khusus member',
    text: 'Ada promo yang cuma berlaku buat teman-teman Kora Club.',
  },
];

const STEPS = [
  {
    icon: ShoppingBag,
    title: 'Belanja',
    text: 'Pesan online di web ini, atau sebut nomor HP-mu ke kasir saat beli di toko.',
  },
  {
    icon: Coins,
    title: 'Poin terkumpul',
    text: 'Poin masuk otomatis begitu pesanan dibayar. Pantau saldonya di halaman ini.',
  },
  {
    icon: Store,
    title: 'Tukar reward, pakai di toko',
    text: 'Pilih reward, dapat kode unik, lalu tunjukkan ke kasir dalam 1 hari.',
  },
];

const RULES = [
  'Poin masuk setelah pesanan dibayar.',
  'Dihitung dari harga produk setelah diskon, tidak termasuk ongkir.',
  'Pesanan yang direfund, poinnya ditarik kembali.',
  'Kode reward berlaku 1 hari. Lewat dari itu hangus dan poin tidak kembali.',
];

export default function GuestView() {
  const { openLogin } = useMember();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [tiers, setTiers] = useState<PointTier[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchActiveRewards(), fetchPointTiers()])
      .then(([r, t]) => {
        if (cancelled) return;
        setRewards(r);
        setTiers(t);
      })
      .catch((err) => console.error('Gagal memuat data membership', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Berhasil login = GuestView diganti MemberView; mulai dari atas walau tombolnya di bawah halaman
  useEffect(() => () => window.scrollTo(0, 0), []);

  // Satu skema saja untuk tamu: tingkat terkecil
  const baseTier = tiers[0];

  const cta = (label: string, className?: string) => (
    <button
      type="button"
      onClick={() => openLogin('register')}
      className={cn(btnSolid, 'h-10 px-5 text-[13px]', className)}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Hero */}
      <section className="border-b border-foreground">
        <div className="mx-auto grid max-w-page items-center gap-8 px-4 py-10 md:grid-cols-[1fr_minmax(0,500px)] md:px-[30px] md:py-14">
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
            <span className="inline-block rounded-full border border-foreground bg-secondary px-3 py-1 text-[11px] font-medium">
              Kora Club · Gratis daftar
            </span>
            <h1 className="mt-4 font-display text-[30px] leading-[1.1] md:text-[44px]">
              Ngopi makin untung,
              <br />
              jadi teman Kora.
            </h1>
            <p className="mt-4 max-w-[460px] text-sm leading-6">
              Kumpulkan poin dari setiap belanja online maupun di toko, lalu tukar dengan kopi dan
              camilan gratis. Makin sering mampir, makin banyak yang bisa kamu bawa pulang.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {cta('Daftar Gratis')}
              <button
                type="button"
                onClick={() => openLogin()}
                className={cn(btnOutline, 'h-10 px-5 text-[13px]')}
              >
                Sudah member? Login
              </button>
            </div>
          </div>
          <div className="relative mx-2 md:mx-0">
            <img
              src={heroPhoto}
              alt="Kora memegang es kopi Irona di dalam toko"
              width={1194}
              height={671}
              className={cn(
                'aspect-[530/330] w-full border border-foreground object-cover',
                hardShadow
              )}
            />
            {baseTier && (
              <div
                className={cn(
                  'absolute -bottom-5 -left-2 rotate-[-4deg] border border-foreground bg-background px-3 py-2 md:-left-6',
                  hardShadow
                )}
              >
                <p className="font-display text-xl leading-none">+{baseTier.points} poin</p>
                <p className="mt-1 text-[10.5px]">
                  tiap belanja {formatRupiah(baseTier.minAmount)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Keuntungan */}
      <section aria-labelledby="untung-title" className="border-b border-foreground">
        <div className={sectionClass}>
          <h2 id="untung-title" className={headingClass}>
            Kenapa gabung Kora Club?
          </h2>
          <ul className="mt-5 grid gap-3.5 md:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="flex gap-3 border border-foreground bg-card p-4 transition-colors hover:bg-secondary"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-foreground bg-secondary">
                  <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Cara kerja */}
      <section aria-labelledby="cara-title" className="border-b border-foreground bg-secondary">
        <div className={sectionClass}>
          <h2 id="cara-title" className={headingClass}>
            Cara kerjanya
          </h2>
          <ol className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="contents">
                {i > 0 && (
                  <ArrowRight
                    aria-hidden
                    className="mx-auto size-5 rotate-90 self-center md:rotate-0"
                    strokeWidth={1.75}
                  />
                )}
                <div className="relative border border-foreground bg-background p-4 pt-5">
                  <span className="absolute -top-3 left-4 grid size-6 place-items-center rounded-full border border-foreground bg-primary font-mono text-[11px] text-primary-foreground">
                    {i + 1}
                  </span>
                  <Icon aria-hidden className="size-6" strokeWidth={1.5} />
                  <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Cara dapat poin */}
      {baseTier && (
        <section aria-labelledby="poin-title" className="border-b border-foreground">
          <div className={cn(sectionClass, 'grid gap-6 md:grid-cols-2 md:items-center')}>
            <div>
              <h2 id="poin-title" className={headingClass}>
                Cara dapat poin
              </h2>
              <div
                className={cn(
                  'mt-4 flex items-center gap-4 border border-foreground bg-card p-4 md:p-5',
                  hardShadow
                )}
              >
                <Ticket aria-hidden className="size-9 shrink-0" strokeWidth={1.25} />
                <p className="text-sm leading-6">
                  Setiap belanja kelipatan
                  <br />
                  <span className="font-display text-2xl md:text-[28px]">
                    {formatRupiah(baseTier.minAmount)} = {baseTier.points} poin
                  </span>
                </p>
              </div>
              {tiers.length > 1 && (
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Belanja lebih banyak sekaligus? Ada bonus poin tambahan.
                </p>
              )}
            </div>
            <ul className="grid gap-2 text-[13px] leading-5">
              {RULES.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-[7px] size-1.5 shrink-0 rounded-full bg-foreground"
                  />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Contoh reward (read-only) */}
      <section aria-labelledby="reward-title" className="border-b border-foreground">
        <div className={sectionClass}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="reward-title" className={headingClass}>
              Reward yang bisa kamu dapat
            </h2>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              Berganti sewaktu-waktu
            </span>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {rewards.map((r) => (
              <RewardCard key={r.id} reward={r} dimmed={r.availableStock <= 0} />
            ))}
          </ul>
        </div>
      </section>

      {/* Ajakan penutup */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-page flex-col items-center gap-5 px-4 py-10 text-center md:flex-row md:justify-between md:px-[30px] md:text-left">
          <div className="flex items-center gap-4">
            <img src={koraNgopi} alt="" className="hidden h-24 w-auto sm:block" />
            <div>
              <h2 className="font-display text-[26px] leading-tight md:text-[30px]">
                Siap jadi teman Kora?
              </h2>
              <p className="mt-1 text-sm opacity-80">Daftar gratis, cukup pakai email &amp; nomor HP.</p>
            </div>
          </div>
          {cta(
            'Daftar Sekarang',
            'border-primary-foreground bg-primary-foreground text-primary hover:bg-primary-foreground/85'
          )}
        </div>
      </section>
    </>
  );
}
