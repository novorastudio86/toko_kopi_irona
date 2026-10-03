import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import heroPhoto from '@/assets/membership/membership-hero.webp';
import { useMember } from '@/hooks/useMember';
import { cn } from '@/lib/utils';
import {
  fetchActiveRewards,
  fetchMemberTransactions,
  fetchPointTiers,
  redeemReward,
} from '@/services/membership';
import type {
  MemberTransaction,
  OrderType,
  PointTier,
  Reward,
  RewardClaim,
  TransactionStatus,
} from '@/types/membership';
import { formatRupiah } from '@/utils/format';

// Figma 715:614 (pengunjung umum) & 771:903 (member). Data dari services/membership.ts (masih dummy).

const PAGE_SIZE = 3;

const headingClass = 'font-display text-2xl leading-tight md:text-[26px]';
const btnClass =
  'grid place-items-center rounded-[6px] border border-foreground text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40';
const btnSolid = cn(btnClass, 'bg-primary text-primary-foreground hover:bg-primary/85');
const btnOutline = cn(btnClass, 'bg-background hover:bg-secondary');

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

/** 30 September 2026, 14.30 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

/** Contoh kartu transaksi (buram) untuk pengunjung umum */
const SAMPLE_TRANSACTION: MemberTransaction = {
  id: 'sample',
  transactionNumber: 'IRN-00000000000',
  transactionDate: new Date(2026, 0, 1, 0, 0).toISOString(),
  orderType: 'online',
  status: 'selesai',
  totalAmount: 0,
  pointsEarned: 0,
};

function RewardCard({
  reward,
  onLogin,
}: {
  reward: Reward;
  /** Ada = pengunjung umum; tombol jadi "Login untuk Menukar" */
  onLogin?: () => void;
}) {
  const { member, spendPoints } = useMember();
  const [claim, setClaim] = useState<RewardClaim | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const notEnough = !!member && member.pointsBalance < reward.pointsRequired;

  const handleRedeem = async () => {
    if (!member) return;
    setRedeeming(true);
    try {
      setClaim(await redeemReward(member.id, reward.id));
      spendPoints(reward.pointsRequired);
    } catch (err) {
      console.error('Gagal menukar reward', err);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <li className="flex flex-col border border-foreground bg-card p-2">
      {reward.photoUrl ? (
        <img
          src={reward.photoUrl}
          alt={reward.name}
          loading="lazy"
          className="h-[150px] w-full border border-foreground object-cover"
        />
      ) : (
        <div className="grid h-[150px] place-items-center border border-foreground bg-stripes text-[10px] font-semibold tracking-[0.04em]">
          Foto Reward
        </div>
      )}
      <p className="mt-1.5 text-[10.5px]">{reward.category}</p>
      <h3 className="text-sm font-medium">{reward.name}</h3>
      <div className="mt-auto flex items-end justify-between gap-3 pt-2">
        <p className="pb-0.5 text-sm font-medium">{reward.pointsRequired} Poin</p>
        {claim ? (
          <p className="text-right text-[10.5px]" role="status">
            Tunjukkan ke kasir:
            <br />
            <span className="font-mono text-xs font-semibold">{claim.code}</span>
          </p>
        ) : onLogin ? (
          <button type="button" onClick={onLogin} className={cn(btnSolid, 'h-[27px] px-2.5')}>
            Login untuk Menukar
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRedeem}
            disabled={notEnough || redeeming}
            title={notEnough ? 'Poin belum cukup' : undefined}
            className={cn(btnSolid, 'h-[27px] min-w-[42px] px-2.5')}
          >
            {redeeming ? 'Memproses…' : notEnough ? 'Poin kurang' : 'Tukar'}
          </button>
        )}
      </div>
    </li>
  );
}

function TransactionCard({ trx }: { trx: MemberTransaction }) {
  return (
    <li className="flex flex-col gap-4 border border-foreground bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
      <div>
        <p className="text-sm leading-6">{trx.transactionNumber}</p>
        <p className="text-sm leading-6">{formatDateTime(trx.transactionDate)}</p>
        <div className="mt-2.5 flex gap-2">
          {[STATUS_LABEL[trx.status], ORDER_TYPE_LABEL[trx.orderType]].map((label) => (
            <span
              key={label}
              className="rounded-[6px] bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 sm:gap-10">
        <div className="min-w-[110px] text-sm">
          <p>Total</p>
          <p className="text-xl leading-6 font-bold">{formatRupiah(trx.totalAmount)}</p>
          <p className="mt-2">+{trx.pointsEarned} poin</p>
        </div>
        {/* TODO(integrasi): halaman detail transaksi & isi ulang keranjang dari item transaksi */}
        <div className="grid w-[134px] gap-3">
          <button type="button" className={cn(btnSolid, 'h-[41px] font-semibold')}>
            Lihat Detail
          </button>
          <button type="button" className={cn(btnOutline, 'h-[33px] font-semibold')}>
            Beli Ulang
          </button>
        </div>
      </div>
    </li>
  );
}

export default function MembershipScreen() {
  const { member, login } = useMember();
  const memberId = member?.id ?? null;
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [tiers, setTiers] = useState<PointTier[]>([]);
  const [transactions, setTransactions] = useState<MemberTransaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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

  // Halaman pertama riwayat transaksi setiap kali member berganti (login)
  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    fetchMemberTransactions(memberId, 0, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setTransactions(page.items);
        setHasMore(page.hasMore);
      })
      .catch((err) => console.error('Gagal memuat transaksi', err));
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const loadMore = async () => {
    if (!memberId) return;
    setLoadingMore(true);
    try {
      const page = await fetchMemberTransactions(memberId, transactions.length, PAGE_SIZE);
      setTransactions((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
    } catch (err) {
      console.error('Gagal memuat transaksi', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const onLogin = member ? undefined : () => void login();

  return (
    <>
      <title>Membership | Toko Kopi Irona</title>
      <meta
        name="description"
        content="Kora Club Toko Kopi Irona: kumpulkan poin dari setiap pembelian dan tukar dengan reward yang tersedia."
      />

      {/* Hero */}
      <section className="border-b border-foreground">
        <div
          className={cn(
            'mx-auto grid max-w-page md:min-h-[298px]',
            member && 'md:grid-cols-[1fr_minmax(0,530px)]'
          )}
        >
          <div className="px-4 py-10 md:self-center md:px-[30px] md:py-12">
            <h1 className="font-display text-[26px] leading-tight md:text-[32px]">
              {member ? 'Selamat datang!! Kora Club' : 'Login Sekarang dan Kumpulkan Poin Mu'}
            </h1>
            <p className="mt-3 max-w-[481px] text-sm leading-6">
              Kumpulkan poinmu melalui pembelian apapun, tukar poinmu dengan reward yang tersedia.
              Makin sering makin besar keuntungan yang didapat!
            </p>
            <div className="mt-2 flex gap-3">
              {onLogin && (
                <button
                  type="button"
                  onClick={onLogin}
                  className={cn(btnSolid, 'h-[33px] w-[125px]')}
                >
                  Login Sekarang
                </button>
              )}
              <a href="#reward" className={cn(btnOutline, 'h-[33px] w-[128px]')}>
                Reward Tersedia
              </a>
            </div>
          </div>
          {member && (
            <img
              src={heroPhoto}
              alt="Kora memegang es kopi Irona di dalam toko"
              width={1194}
              height={671}
              className="aspect-[530/298] w-full object-cover md:h-full"
            />
          )}
        </div>
      </section>

      {/* Reward tersedia */}
      <section
        id="reward"
        aria-labelledby="reward-title"
        className="scroll-mt-16 border-b border-foreground"
      >
        <div className="mx-auto max-w-page px-4 pt-6 pb-6 md:px-[30px] md:pb-[26px]">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="reward-title" className="font-display text-2xl">
              Reward Tersedia
            </h2>
            <Link to="/membership/reward" className="text-[10.5px] hover:underline">
              Semua Reward →
            </Link>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {rewards.map((r) => (
              <RewardCard key={r.id} reward={r} onLogin={onLogin} />
            ))}
          </ul>
        </div>
      </section>

      {/* Cara & skema dapat poin */}
      <section className="border-b border-foreground">
        <div className="mx-auto grid max-w-page md:grid-cols-2">
          <div className="px-4 py-6 md:px-[30px]">
            <h2 className={headingClass}>Cara Dapat Poin?</h2>
            <ol className="mt-2 list-decimal pl-5 text-sm leading-6">
              <li>Daftar/Login akun</li>
              <li>Belanja online/offline - poin masuk setelah pesanan sudah dibayar</li>
              <li>Tukar poin dengan reward yang tersedia!</li>
            </ol>
          </div>
          <div className="border-t border-foreground px-4 py-6 md:border-t-0 md:border-l md:px-[30px]">
            <h2 className={headingClass}>Skema dapat poin?</h2>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              <table className="border-collapse text-sm leading-[18px]">
                <thead>
                  <tr>
                    <th className="border border-foreground px-1.5 text-left font-normal">
                      Kelipatan Belanja
                    </th>
                    <th className="border border-foreground px-1.5 font-normal">
                      Poin yang didapat
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => (
                    <tr key={t.minAmount}>
                      <td className="border border-foreground px-1.5">
                        {formatRupiah(t.minAmount)}
                      </td>
                      <td className="border border-foreground px-1.5 text-center">+{t.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="list-disc pl-5 text-sm leading-6 sm:max-w-[226px]">
                <li>Poin hanya dari transaksi yang sudah dibayar</li>
                <li>Refund = poin ditarik</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Detail transaksi */}
      <section aria-labelledby="transaksi-title">
        <div className="mx-auto max-w-page px-4 pt-6 pb-10 md:px-[30px] md:pb-12">
          <h2 id="transaksi-title" className={headingClass}>
            Detail Transaksi
          </h2>
          {member ? (
            <>
              <ul className="mt-4 grid gap-3">
                {transactions.map((trx) => (
                  <TransactionCard key={trx.id} trx={trx} />
                ))}
              </ul>
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className={cn(btnOutline, 'mx-auto mt-5 h-[50px] px-6 text-lg md:text-xl')}
                >
                  {loadingMore ? 'Memuat…' : 'Muat Lebih Banyak'}
                </button>
              )}
            </>
          ) : (
            <>
              <ul aria-hidden inert className="mt-4 opacity-50 blur-[1.5px] select-none">
                <TransactionCard trx={SAMPLE_TRANSACTION} />
              </ul>
              <button
                type="button"
                onClick={onLogin}
                className={cn(btnOutline, 'mx-auto mt-5 h-[50px] px-6 text-lg md:text-xl')}
              >
                Login untuk lihat detail transaksi
              </button>
            </>
          )}
        </div>
      </section>
    </>
  );
}
