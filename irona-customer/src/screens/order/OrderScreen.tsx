import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Check, CircleCheck, Clock, MapPin, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchOnlineOrder, simulatePayment } from '@/services/onlineOrder';
import type { OnlineOrder } from '@/types/onlineOrder';
import { formatRupiah } from '@/utils/format';
import {
  formatCountdown,
  isActive,
  isPaid,
  STATUS_LABEL,
  TRACK_STEPS,
  trackIndex,
} from './orderLogic';

const panelClass = 'rounded-[4px] border border-foreground bg-card';
const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';
const btnBase = cn(
  'flex h-[44px] w-full items-center justify-center gap-2 rounded-[6px] text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
  focusClass
);
const btnSolid = cn(btnBase, 'bg-primary text-primary-foreground hover:bg-primary/85');
const btnOutline = cn(btnBase, 'border border-foreground bg-background hover:bg-secondary');

/** Menunggu bayar: cek tiap 5 detik. Sudah dibayar: cukup tiap 30 detik. */
const POLL_PAYMENT_MS = 5000;
const POLL_TRACK_MS = 30_000;

type OrderState = 'loading' | 'error' | { order: OnlineOrder | null };

/**
 * Pesanan + cek status berkala selama masih bisa berubah.
 * TODO(backend): boleh diganti Supabase Realtime pada baris transaksi supaya tidak polling.
 */
function useOrder(id: string) {
  const [state, setState] = useState<OrderState>('loading');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchOnlineOrder(id)
      .then((order) => !cancelled && setState({ order }))
      .catch((err) => {
        console.error('Gagal memuat pesanan', err);
        // Gagal saat cek ulang: tetap tampilkan data terakhir
        if (!cancelled) setState((prev) => (typeof prev === 'object' ? prev : 'error'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  const status = typeof state === 'object' ? state.order?.status : undefined;
  const pollMs =
    !status || !isActive(status)
      ? null
      : status === 'menunggu_pembayaran'
        ? POLL_PAYMENT_MS
        : POLL_TRACK_MS;

  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(refresh, pollMs);
    return () => clearInterval(timer);
  }, [pollMs, refresh]);

  return { state, refresh };
}

/** Sisa ms sampai `until`, diperbarui tiap detik */
function useCountdown(until: string): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Date.parse(until) - now;
}

export default function OrderScreen() {
  const { id = '' } = useParams();
  const { state, refresh } = useOrder(id);
  const order = typeof state === 'object' ? state.order : null;
  // Pernah terlihat menunggu bayar di halaman ini → begitu lunas tampilkan "Pembayaran berhasil!"
  const [sawWaiting, setSawWaiting] = useState(false);
  if (order?.status === 'menunggu_pembayaran' && !sawWaiting) setSawWaiting(true);

  return (
    <div className="mx-auto max-w-page px-4 pt-3 pb-8 md:px-[30px]">
      <title>
        {order ? `Pesanan ${order.code} | Toko Kopi Irona` : 'Pesanan | Toko Kopi Irona'}
      </title>
      <h1 className="text-3xl font-semibold">
        {order?.status === 'menunggu_pembayaran' ? 'Pembayaran' : 'Pesanan'}
      </h1>
      {order && (
        <p className="mt-1 text-xs text-muted-foreground">
          Kode pesanan <span className="font-semibold text-foreground">{order.code}</span> ·{' '}
          {new Date(order.createdAt).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}

      {state === 'loading' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="h-[420px] animate-pulse rounded-[4px] bg-muted" />
          <div className="h-[280px] animate-pulse rounded-[4px] bg-muted" />
        </div>
      ) : !order ? (
        <Notice
          title={state === 'error' ? 'Gagal memuat pesanan' : 'Pesanan tidak ditemukan'}
          text={
            state === 'error'
              ? 'Periksa koneksi lalu muat ulang halaman.'
              : 'Link pesanan salah atau sudah tidak berlaku.'
          }
        />
      ) : (
        <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          {order.status === 'menunggu_pembayaran' ? (
            <PaymentPanel order={order} onCheck={refresh} />
          ) : isPaid(order.status) ? (
            <TrackPanel order={order} justPaid={sawWaiting} />
          ) : (
            <section className={cn(panelClass, 'p-4')}>
              <p className="text-sm font-semibold">{STATUS_LABEL[order.status]}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.status === 'kedaluwarsa'
                  ? 'QRIS sudah tidak berlaku dan pesanan tidak diproses. Tidak ada dana yang terpotong.'
                  : 'Pesanan ini dibatalkan. Hubungi kami lewat WhatsApp bila ada pertanyaan.'}
              </p>
              <Link to="/menu" className={cn(btnSolid, 'mt-4 sm:w-auto sm:px-6')}>
                Pesan lagi
              </Link>
            </section>
          )}
          <OrderSummary order={order} />
        </div>
      )}
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <section className={cn(panelClass, 'mt-4 max-w-md p-4')}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
      <Link to="/" className={cn(btnOutline, 'mt-4 sm:w-auto sm:px-6')}>
        Kembali ke Beranda
      </Link>
    </section>
  );
}

// ponytail: QR placeholder — ganti dengan gambar QRIS dari Midtrans (qr_string / actions[generate-qr-code]).
function PaymentPanel({ order, onCheck }: { order: OnlineOrder; onCheck: () => void }) {
  const left = useCountdown(order.payExpiresAt);
  const [simulating, setSimulating] = useState(false);

  // Waktu habis: minta status ke server (server yang menandai kedaluwarsa)
  const expired = left <= 0;
  useEffect(() => {
    if (expired) onCheck();
  }, [expired, onCheck]);

  async function simulate() {
    setSimulating(true);
    try {
      await simulatePayment(order.id);
      onCheck();
    } finally {
      setSimulating(false);
    }
  }

  return (
    <section aria-labelledby="pay-title" className={cn(panelClass, 'min-w-0 p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="pay-title" className="text-sm font-semibold">
            Scan QRIS untuk bayar
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Bisa pakai semua e-wallet &amp; m-banking.
          </p>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border border-foreground px-2.5 py-0.5 text-[11px] font-semibold tabular-nums',
            left < 60_000 && 'border-destructive text-destructive'
          )}
        >
          <Clock aria-hidden className="size-3" />
          <span className="sr-only">Sisa waktu bayar </span>
          {formatCountdown(left)}
        </span>
      </div>

      <div className="mt-4 grid justify-items-center gap-3 text-center">
        <p className="text-[11px] font-medium tracking-[0.12em] uppercase">Total bayar</p>
        <p className="-mt-2 text-2xl font-bold tabular-nums">{formatRupiah(order.total)}</p>
        <div
          role="img"
          aria-label="Kode QRIS (contoh)"
          className="grid size-[220px] place-items-center rounded-[6px] border border-dashed border-foreground bg-background p-4"
        >
          <div className="grid justify-items-center gap-2 text-muted-foreground">
            <QrCode aria-hidden className="size-24" strokeWidth={1} />
            <span className="text-[11px]">QRIS muncul di sini</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          a.n. <span className="font-medium text-foreground">Toko Kopi Irona</span> · NMID
          ID10200000000
        </p>
      </div>

      <ol className="mt-4 grid list-inside list-decimal gap-1 rounded-[4px] bg-secondary p-3 text-xs">
        <li>Buka aplikasi e-wallet atau m-banking.</li>
        <li>Scan QR di atas (atau simpan gambar lalu unggah dari galeri).</li>
        <li>Pastikan nama merchant & nominal sesuai, lalu bayar.</li>
      </ol>

      <p role="status" className="mt-4 flex items-center justify-center gap-2 text-xs font-medium">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-foreground" />
        {expired ? 'Waktu habis, memeriksa status…' : 'Menunggu pembayaran — dicek otomatis'}
      </p>

      {/* MOCK ONLY: pengganti webhook Midtrans. Hapus saat payment gateway tersambung. */}
      <div className="mt-4 border-t border-dashed border-foreground pt-4">
        <button
          type="button"
          onClick={simulate}
          disabled={simulating || expired}
          className={btnOutline}
        >
          {simulating ? 'Memproses…' : 'Saya sudah bayar (simulasi)'}
        </button>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Mockup — nanti status berubah otomatis dari payment gateway.
        </p>
      </div>
    </section>
  );
}

function TrackPanel({ order, justPaid }: { order: OnlineOrder; justPaid: boolean }) {
  const current = trackIndex(order.status);
  const done = order.status === 'selesai';
  // Panel QRIS diganti panel ini: pindahkan fokus ke judul supaya pembaca layar tahu sudah lunas
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (justPaid) headingRef.current?.focus();
  }, [justPaid]);

  return (
    <section aria-labelledby="track-title" className={cn(panelClass, 'min-w-0 p-4')}>
      <div className="grid justify-items-center gap-2 py-3 text-center">
        <CircleCheck aria-hidden className="size-12" strokeWidth={1.5} />
        <h2
          id="track-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {done ? 'Pesanan selesai' : justPaid ? 'Pembayaran berhasil!' : 'Pesanan diproses'}
        </h2>
        <p className="max-w-sm text-xs text-muted-foreground">
          {done
            ? 'Terima kasih sudah memesan di Irona. Selamat menikmati!'
            : 'Pesananmu sudah kami terima. Status bisa dipantau dari menu Keranjang selama 24 jam.'}
        </p>
      </div>

      <ol aria-label="Status pesanan" className="mt-2 grid gap-0 border-t border-foreground pt-4">
        <Step state="done" label="Dibayar" hint="Pembayaran QRIS diterima" />
        {TRACK_STEPS.map((step, i) => (
          <Step
            key={step.status}
            state={i < current || done ? 'done' : i === current ? 'current' : 'todo'}
            label={step.label}
            hint={step.hint}
            last={i === TRACK_STEPS.length - 1}
          />
        ))}
      </ol>

      <Link to="/" className={cn(btnSolid, 'mt-4')}>
        Kembali ke Beranda
      </Link>
    </section>
  );
}

function Step({
  state,
  label,
  hint,
  last,
}: {
  state: 'done' | 'current' | 'todo';
  label: string;
  hint: ReactNode;
  last?: boolean;
}) {
  return (
    <li aria-current={state === 'current' ? 'step' : undefined} className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full border border-foreground',
            state === 'done' && 'bg-primary text-primary-foreground',
            state === 'current' && 'bg-secondary'
          )}
        >
          {state === 'done' && <Check aria-hidden className="size-3" />}
          {state === 'current' && (
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-foreground" />
          )}
        </span>
        {!last && <span aria-hidden className="w-px flex-1 bg-foreground/30" />}
      </div>
      <div className={cn('pb-4', state === 'todo' && 'text-muted-foreground')}>
        <p className="text-xs font-semibold">
          {label}
          {state === 'current' && <span className="sr-only"> (sekarang)</span>}
        </p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </li>
  );
}

function OrderSummary({ order }: { order: OnlineOrder }) {
  return (
    <section aria-labelledby="summary-title" className={cn(panelClass, 'min-w-0')}>
      <h2 id="summary-title" className="px-4 pt-4 text-sm font-semibold">
        Ringkasan pesanan
      </h2>
      <ul className="divide-y divide-border px-4">
        {order.items.map((item) => (
          <li key={item.productId} className="flex justify-between gap-3 py-2.5 text-xs">
            <span className="min-w-0">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground"> × {item.qty}</span>
            </span>
            <span className="shrink-0 tabular-nums">{formatRupiah(item.price * item.qty)}</span>
          </li>
        ))}
      </ul>

      <dl className="grid gap-2 border-t border-foreground p-4 text-xs">
        <Row label="Subtotal" value={formatRupiah(order.subtotal)} />
        <Row label="Ongkir" value={formatRupiah(order.shippingFee)} />
        {order.discount > 0 && <Row label="Voucher" value={`−${formatRupiah(order.discount)}`} />}
        <Row label="Biaya admin" value={formatRupiah(order.serviceFee)} />
        <div className="flex items-baseline justify-between border-t border-foreground pt-3">
          <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase">Total</dt>
          <dd className="text-lg font-bold tabular-nums">{formatRupiah(order.total)}</dd>
        </div>
      </dl>

      <div className="grid gap-1 border-t border-foreground p-4 text-xs">
        <p className="font-medium">
          {order.customerName} · {order.phone}
        </p>
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <MapPin aria-hidden className="mt-px size-3.5 shrink-0" />
          {order.address ?? 'Titik antar sesuai pin di peta'}
        </p>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
