import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Check, Copy, LogOut } from 'lucide-react';
import koraNgopi from '@/assets/tentang/kora-ngopi.webp';
import { useMember } from '@/hooks/useMember';
import { cn } from '@/lib/utils';
import {
  fetchActiveClaims,
  fetchActiveRewards,
  fetchMemberTransactions,
  fetchPointHistory,
  redeemReward,
} from '@/services/membership';
import type {
  Member,
  MemberTransaction,
  OrderType,
  Page,
  PointHistory,
  PointType,
  Reward,
  RewardClaim,
  TransactionStatus,
} from '@/types/membership';
import { formatRupiah } from '@/utils/format';
import { canClaim, maskPhone, nextTarget, sortRewards, timeLeftLabel } from './membershipLogic';
import RewardCard from './RewardCard';
import { btnOutline, btnSolid, hardShadow, headingClass, sectionClass } from './styles';

const FIRST_PAGE = 3;
const NEXT_PAGE = 10;

const STATUS_LABEL: Record<TransactionStatus, string> = {
  selesai: 'Selesai',
  refund_sebagian: 'Refund sebagian',
  refund_penuh: 'Refund',
  dibatalkan: 'Dibatalkan',
};

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  online: 'Online',
  dine_in: 'Dine in',
  take_away: 'Take away',
};

const POINT_LABEL: Record<PointType, string> = {
  earn: 'Dari transaksi',
  redeem: 'Tukar reward',
  redeem_cancel: 'Pembatalan tukar reward',
  adjust: 'Penyesuaian',
  refund_reversal: 'Ditarik karena refund',
};

/** 30 Sep 2026, 14.30 */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Halaman pertama 3 baris, "Lihat semua" memuat sisanya per 10. `refreshKey` berubah = muat ulang. */
function usePaged<T>(
  memberId: string,
  fetchPage: (memberId: string, offset: number, limit: number) => Promise<Page<T>>,
  refreshKey?: unknown
) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPage(memberId, 0, FIRST_PAGE)
      .then((p) => {
        if (cancelled) return;
        setItems(p.items);
        setHasMore(p.hasMore);
      })
      .catch((err) => console.error('Gagal memuat riwayat', err));
    return () => {
      cancelled = true;
    };
  }, [memberId, fetchPage, refreshKey]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const p = await fetchPage(memberId, items.length, NEXT_PAGE);
      setItems((prev) => [...prev, ...p.items]);
      setHasMore(p.hasMore);
    } catch (err) {
      console.error('Gagal memuat riwayat', err);
    } finally {
      setLoading(false);
    }
  };

  return { items, hasMore, loading, loadMore };
}

function PointCard({ member, rewards }: { member: Member; rewards: Reward[] }) {
  const target = nextTarget(rewards, member.pointsBalance);
  return (
    <div className={cn('overflow-hidden border border-foreground bg-secondary', hardShadow)}>
      <div className="flex items-center justify-between bg-primary px-4 py-2 text-primary-foreground">
        <span className="font-display text-lg leading-none">Kora Club</span>
        <span className="font-mono text-[10px] tracking-[0.2em]">MEMBER CARD</span>
      </div>
      <div className="relative px-4 pt-4 pb-5">
        <img
          src={koraNgopi}
          alt=""
          className="pointer-events-none absolute right-3 bottom-3 h-20 w-auto opacity-90 md:h-24"
        />
        <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Saldo poin</p>
        <p className="font-display text-[56px] leading-none md:text-[64px]">
          {member.pointsBalance}
          <span className="ml-2 font-sans text-sm">poin</span>
        </p>
        <div className="mt-4 max-w-[calc(100%-90px)]">
          {target ? (
            <>
              <div
                role="progressbar"
                aria-label={`Progres menuju ${target.reward.name}`}
                aria-valuemin={0}
                aria-valuemax={target.reward.pointsRequired}
                aria-valuenow={member.pointsBalance}
                className="h-4 border border-foreground bg-background p-0.5"
              >
                {/* Isi bergaris kotak-kotak ala bar pixel */}
                <div
                  className="h-full bg-[repeating-linear-gradient(90deg,var(--color-foreground)_0_8px,transparent_8px_10px)] transition-[width] duration-700"
                  style={{ width: `${target.progress * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[13px]">
                <strong>{target.missing} poin lagi</strong> → {target.reward.name}
              </p>
            </>
          ) : (
            <p className="text-[13px]">Poinmu cukup untuk semua reward. Saatnya tukar!</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-dashed border-foreground px-4 py-2.5 text-[11px]">
        <span className="font-medium">{member.name}</span>
        <span className="font-mono">{maskPhone(member.phoneNumber)}</span>
      </div>
    </div>
  );
}

function ClaimTicket({ claim, now }: { claim: RewardClaim; now: number }) {
  const [copied, setCopied] = useState(false);
  const left = timeLeftLabel(claim.expiresAt, now);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(claim.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard ditolak (mis. bukan HTTPS): kode tetap terlihat untuk dibacakan
    }
  };

  return (
    <li className="border border-foreground bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{claim.rewardName}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="font-mono text-2xl font-semibold tracking-[0.18em] md:text-[26px]">
          {claim.code}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Salin kode ${claim.code}`}
          className={cn(btnOutline, 'h-8 shrink-0 grid-flow-col gap-1.5 px-3')}
        >
          {copied ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
          {copied ? 'Tersalin' : 'Salin'}
        </button>
      </div>
      <p className="mt-1.5 text-[11px]">
        Berlaku <strong>{left}</strong> · Tunjukkan ke kasir
      </p>
    </li>
  );
}

function RedeemAction({
  reward,
  balance,
  onRedeem,
}: {
  reward: Reward;
  balance: number;
  onRedeem: (reward: Reward) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (reward.availableStock <= 0)
    return <p className="text-[11px] text-muted-foreground">Stok habis, cek lagi nanti</p>;
  if (!canClaim(reward, balance))
    return (
      <button type="button" disabled className={cn(btnOutline, 'h-8 w-full')}>
        Kurang {reward.pointsRequired - balance} poin
      </button>
    );

  const redeem = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRedeem(reward);
      setConfirming(false);
    } catch (err) {
      console.error('Gagal menukar reward', err);
      setError(err instanceof Error ? err.message : 'Gagal menukar, coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  if (!confirming)
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={cn(btnSolid, 'h-8 w-full')}
      >
        Tukar {reward.pointsRequired} poin
      </button>
    );

  return (
    <div role="group" aria-label="Konfirmasi tukar reward">
      <p className="text-[11px] leading-4">
        Poin terpotong sekarang. Kode berlaku 1 hari, lewat dari itu hangus.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className={cn(btnOutline, 'h-8')}
        >
          Batal
        </button>
        <button type="button" onClick={redeem} disabled={busy} className={cn(btnSolid, 'h-8')}>
          {busy ? 'Memproses…' : 'Ya, tukar'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function OrderRow({ trx }: { trx: MemberTransaction }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-mono text-[13px]">{trx.transactionNumber}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatDateTime(trx.transactionDate)} · {ORDER_TYPE_LABEL[trx.orderType]} ·{' '}
          {STATUS_LABEL[trx.status]}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">{formatRupiah(trx.totalAmount)}</p>
        <p className="text-[11px] text-muted-foreground">+{trx.pointsEarned} poin</p>
      </div>
    </li>
  );
}

function PointRow({ entry }: { entry: PointHistory }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{POINT_LABEL[entry.type]}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {formatDateTime(entry.date)}
          {(entry.transactionNumber ?? entry.notes) &&
            ` · ${entry.transactionNumber ?? entry.notes}`}
        </p>
      </div>
      <p
        className={cn(
          'shrink-0 font-mono text-sm font-semibold',
          entry.change < 0 && 'text-muted-foreground'
        )}
      >
        {entry.change > 0 ? '+' : ''}
        {entry.change}
      </p>
    </li>
  );
}

function HistoryList<T>({
  paged,
  render,
  empty,
}: {
  paged: ReturnType<typeof usePaged<T>>;
  render: (item: T) => ReactNode;
  empty: string;
}) {
  if (paged.items.length === 0)
    return <p className="py-6 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <>
      <ul className="divide-y divide-border">{paged.items.map(render)}</ul>
      {paged.hasMore && (
        <button
          type="button"
          onClick={paged.loadMore}
          disabled={paged.loading}
          className={cn(btnOutline, 'mt-3 h-9 w-full')}
        >
          {paged.loading ? 'Memuat…' : 'Lihat semua'}
        </button>
      )}
    </>
  );
}

export default function MemberView({ member }: { member: Member }) {
  const { logout, spendPoints } = useMember();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [tab, setTab] = useState<'pesanan' | 'poin'>('pesanan');
  // Jam untuk sisa waktu kode; diperbarui tiap menit
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchActiveRewards(), fetchActiveClaims(member.id)])
      .then(([r, c]) => {
        if (cancelled) return;
        setRewards(r);
        setClaims(c);
      })
      .catch((err) => console.error('Gagal memuat data membership', err));
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  const orders = usePaged(member.id, fetchMemberTransactions);
  // Saldo berubah (habis tukar reward) = ada baris riwayat poin baru
  const points = usePaged(member.id, fetchPointHistory, member.pointsBalance);

  const onRedeem = useCallback(
    async (reward: Reward) => {
      const claim = await redeemReward(member.id, reward);
      spendPoints(reward.pointsRequired);
      setClaims((prev) => [claim, ...prev]);
      // TODO(backend): ambil ulang reward_overview supaya available_stock ikut berkurang
      document.getElementById('kode-aktif')?.scrollIntoView({ block: 'center' });
    },
    [member.id, spendPoints]
  );

  const activeClaims = claims.filter((c) => timeLeftLabel(c.expiresAt, now));
  const firstName = member.name.split(' ')[0];

  return (
    <>
      {/* Sapaan + kartu poin + kode aktif */}
      <section className="border-b border-foreground">
        <div className={cn(sectionClass, 'md:py-10')}>
          <h1 className="font-display text-[30px] leading-tight md:text-[40px]">
            Halo, {firstName}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sebut nomor HP-mu ke kasir tiap belanja di toko supaya poinnya masuk.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
            {/* Kode aktif di atas pada mobile: dibuka saat sudah di depan kasir */}
            {activeClaims.length > 0 && (
              <div id="kode-aktif" className="scroll-mt-20 md:order-2">
                <h2 className="text-sm font-semibold">Kode reward aktif</h2>
                <ul className="mt-2 grid gap-2.5">
                  {activeClaims.map((c) => (
                    <ClaimTicket key={c.id} claim={c} now={now} />
                  ))}
                </ul>
              </div>
            )}
            <PointCard member={member} rewards={rewards} />
          </div>
        </div>
      </section>

      {/* Reward */}
      <section
        id="reward"
        aria-labelledby="reward-title"
        className="scroll-mt-16 border-b border-foreground"
      >
        <div className={sectionClass}>
          <h2 id="reward-title" className={headingClass}>
            Reward tersedia
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Tukar di sini, lalu tunjukkan kodenya ke kasir. Berlaku untuk dine in &amp; take away.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {sortRewards(rewards, member.pointsBalance).map((r) => (
              <RewardCard key={r.id} reward={r} dimmed={!canClaim(r, member.pointsBalance)}>
                <RedeemAction reward={r} balance={member.pointsBalance} onRedeem={onRedeem} />
              </RewardCard>
            ))}
          </ul>
        </div>
      </section>

      {/* Riwayat + akun */}
      <section>
        <div className={cn(sectionClass, 'grid gap-8 md:grid-cols-[minmax(0,1fr)_300px]')}>
          <section aria-labelledby="riwayat-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="riwayat-title" className={headingClass}>
                Riwayat
              </h2>
              <div className="flex rounded-[6px] border border-foreground p-0.5 text-xs">
                {(['pesanan', 'poin'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tab === t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'rounded-[4px] px-3 py-1.5 font-medium capitalize transition-colors',
                      tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 border-t border-foreground">
              {tab === 'pesanan' ? (
                <HistoryList
                  paged={orders}
                  render={(trx) => <OrderRow key={trx.id} trx={trx} />}
                  empty="Belum ada pesanan."
                />
              ) : (
                <HistoryList
                  paged={points}
                  render={(entry) => <PointRow key={entry.id} entry={entry} />}
                  empty="Belum ada riwayat poin."
                />
              )}
            </div>
          </section>

          <section aria-labelledby="akun-title" className="self-start border border-foreground p-4">
            <h2 id="akun-title" className="text-sm font-semibold">
              Akun
            </h2>
            <dl className="mt-3 grid gap-2 text-[13px]">
              <div>
                <dt className="text-[11px] text-muted-foreground">Nama</dt>
                <dd>{member.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">No HP</dt>
                <dd className="font-mono">{member.phoneNumber}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={logout}
              className={cn(btnOutline, 'mt-4 h-9 w-full grid-flow-col gap-2')}
            >
              <LogOut aria-hidden className="size-3.5" />
              Keluar
            </button>
          </section>
        </div>
      </section>
    </>
  );
}
