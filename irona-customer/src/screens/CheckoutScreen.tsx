import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Check, MapPin, QrCode, TicketPercent, X } from 'lucide-react';
import { useMember } from '@/hooks/useMember';
import { cn } from '@/lib/utils';
import { fetchDeliverySettings, fetchOnlineVouchers, quoteDelivery } from '@/services/onlineOrder';
import { fetchAllOnlineProducts } from '@/services/products';
import type { Member } from '@/types/membership';
import type { DeliveryQuote, DeliverySettings, LatLng, Voucher } from '@/types/onlineOrder';
import type { Product } from '@/types/product';
import { formatRupiah } from '@/utils/format';
import { bestVoucher, checkVoucher, ITEM_NOTE_MAX } from './checkout/checkoutLogic';
import LocationPicker from './checkout/LocationPicker';
import MenuImage from './home/MenuImage';
import { MAX_QTY, useQuickCart } from './home/useQuickCart';

// Checkout online: hanya diantar (delivery) & bayar QRIS.
// ponytail: mockup — ongkir/voucher dari data mock, "Bayar" belum membuat order maupun QRIS Midtrans.

const panelClass = 'rounded-[4px] border border-foreground bg-card';
const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';
const fieldClass = cn(
  'h-[36px] w-full rounded-[6px] border border-foreground bg-background px-3 text-xs placeholder:text-muted-foreground',
  focusClass
);
/** 08xx / 628xx / +628xx, 10–14 digit */
const PHONE_PATTERN = /^(\+62|62|0)8\d{8,11}$/;

interface SavedCheckout {
  name: string;
  phone: string;
  location: LatLng | null;
}

// ponytail: data tersimpan per member di localStorage; pindah ke tabel customers (alamat) saat backend siap
const savedKey = (memberId: string) => `irona:checkout:${memberId}`;

function loadSaved(memberId: string): SavedCheckout | null {
  try {
    const raw = localStorage.getItem(savedKey(memberId));
    return raw ? (JSON.parse(raw) as SavedCheckout) : null;
  } catch {
    return null;
  }
}

function storeSaved(memberId: string, data: SavedCheckout | null) {
  try {
    if (data) localStorage.setItem(savedKey(memberId), JSON.stringify(data));
    else localStorage.removeItem(savedKey(memberId));
  } catch {
    // tidak tersimpan, pesanan tetap jalan
  }
}

/** Alamat perkiraan dari titik pin, hanya untuk konfirmasi pelanggan (driver memakai koordinat) */
// TODO(backend): Nominatim publik dibatasi 1 req/detik — ganti dengan geocoder sendiri/berbayar sebelum go-live.
function useAddressLabel(point: LatLng | null): string | null {
  const [result, setResult] = useState<{ key: string; text: string } | null>(null);
  const key = point ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}` : '';

  useEffect(() => {
    if (!key) return;
    const [lat, lng] = key.split(',');
    const ctrl = new AbortController();
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=id`,
      { signal: ctrl.signal }
    )
      .then((r) => r.json())
      .then((d: { display_name?: string }) =>
        setResult({
          key,
          text: d.display_name?.split(', ').slice(0, 4).join(', ') || 'Alamat tidak dikenali',
        })
      )
      .catch(() => !ctrl.signal.aborted && setResult({ key, text: 'Alamat tidak dikenali' }));
    return () => ctrl.abort();
  }, [key]);

  return result?.key === key ? result.text : null;
}

type QuoteState = { status: 'idle' | 'loading' | 'error' } | { status: 'ok'; quote: DeliveryQuote };

/**
 * Ongkir untuk titik yang sudah dikonfirmasi pelanggan (bukan tiap pin digeser) supaya hemat request rute.
 * attempt naik = hitung ulang titik yang sama (tombol "Coba lagi").
 */
function useDeliveryQuote(point: LatLng | null, attempt: number): QuoteState {
  const [result, setResult] = useState<{ key: string; quote: DeliveryQuote | null } | null>(null);
  const key = point ? `${point.lat.toFixed(6)},${point.lng.toFixed(6)},${attempt}` : '';

  useEffect(() => {
    if (!key) return;
    const [lat, lng] = key.split(',').map(Number);
    const ctrl = new AbortController();
    quoteDelivery({ lat, lng }, ctrl.signal)
      .then((quote) => setResult({ key, quote }))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error('Gagal menghitung ongkir', err);
        setResult({ key, quote: null });
      });
    return () => ctrl.abort();
  }, [key]);

  if (!key) return { status: 'idle' };
  if (result?.key !== key) return { status: 'loading' };
  return result.quote ? { status: 'ok', quote: result.quote } : { status: 'error' };
}

function Step({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: ReactNode;
  /** Info singkat sejajar judul */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn(panelClass, 'min-w-0 p-4')}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div aria-hidden>
          <p className="text-sm font-semibold">{title}</p>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </fieldset>
  );
}

/** key = member: login/logout memasang ulang form, jadi isian awal ikut berganti */
export default function CheckoutScreen() {
  const { member } = useMember();
  return (
    <>
      <title>Checkout | Toko Kopi Irona</title>
      <Checkout key={member?.id ?? 'guest'} member={member} />
    </>
  );
}

function Checkout({ member }: { member: Member | null }) {
  const { quantityOf, setQuantity } = useQuickCart();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [saved] = useState(() => (member ? loadSaved(member.id) : null));
  const [location, setLocation] = useState<LatLng | null>(saved?.location ?? null);
  /** Titik yang sudah dikonfirmasi; titik tersimpan member dianggap sudah dikonfirmasi */
  const [confirmed, setConfirmed] = useState<LatLng | null>(saved?.location ?? null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [name, setName] = useState(saved?.name ?? member?.name ?? '');
  const [phone, setPhone] = useState(saved?.phone ?? member?.phoneNumber ?? '');
  const [driverNote, setDriverNote] = useState('');
  const [saveForNext, setSaveForNext] = useState(true);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  /** undefined = otomatis potongan terbesar, null = tanpa voucher */
  const [voucherId, setVoucherId] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAllOnlineProducts(), fetchDeliverySettings(), fetchOnlineVouchers()])
      .then(([p, s, v]) => {
        if (cancelled) return;
        setProducts(p);
        setSettings(s);
        setVouchers(v);
      })
      .catch((err) => {
        console.error('Gagal memuat checkout', err);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () =>
      (products ?? [])
        .map((product) => ({ product, qty: quantityOf(product.id) }))
        .filter((i) => i.qty > 0),
    [products, quantityOf]
  );
  const subtotal = items.reduce(
    (sum, i) => (i.product.isSoldOut ? sum : sum + (i.product.sellingPrice ?? 0) * i.qty),
    0
  );
  const store = settings && { lat: settings.storeLat, lng: settings.storeLng };
  const quote = useDeliveryQuote(confirmed, quoteAttempt);
  const km = quote.status === 'ok' ? quote.quote.distanceKm : null;
  const shippingFee = quote.status === 'ok' ? quote.quote.fee : null;
  const outOfRange = quote.status === 'ok' && !quote.quote.deliverable;
  const address = useAddressLabel(location);

  const voucherCtx = { subtotal, shippingFee, km, isMember: member !== null };
  const voucher =
    voucherId === undefined
      ? bestVoucher(vouchers, voucherCtx)
      : (vouchers.find((v) => v.id === voucherId) ?? null);
  const voucherResult = voucher && checkVoucher(voucher, voucherCtx);
  const discount = voucherResult && 'discount' in voucherResult ? voucherResult.discount : 0;
  const serviceFee = settings?.serviceFee ?? 0;
  const total = subtotal + (shippingFee ?? 0) + serviceFee - discount;

  const cleanPhone = phone.replace(/[\s-]/g, '');
  const problem = !products
    ? 'Memuat pesanan…'
    : subtotal === 0
      ? 'Keranjang masih kosong'
      : !location
        ? 'Tentukan titik antar di peta'
        : !confirmed
          ? 'Konfirmasi titik antar dulu'
          : quote.status === 'loading'
            ? 'Menghitung ongkir…'
            : quote.status === 'error'
              ? 'Ongkir belum terhitung, geser pin lalu coba lagi'
              : outOfRange
                ? 'Titik antar di luar jangkauan'
                : !name.trim()
                  ? 'Isi nama pemesan'
                  : !PHONE_PATTERN.test(cleanPhone)
                    ? 'Nomor WhatsApp belum valid'
                    : null;

  function applyCode() {
    const found = vouchers.find((v) => v.code.toLowerCase() === code.trim().toLowerCase());
    if (!found) {
      setCodeError('Kode voucher tidak ditemukan');
      return;
    }
    const r = checkVoucher(found, voucherCtx);
    setCodeError('reason' in r ? `Belum bisa dipakai: ${r.reason}` : null);
    setVoucherId(found.id);
    setCode('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (problem) return;
    if (member)
      storeSaved(
        member.id,
        saveForNext ? { name: name.trim(), phone: cleanPhone, location } : null
      );
    // TODO(backend): buat order (items + catatan + koordinat + voucher), minta QRIS dinamis Midtrans,
    // lalu arahkan ke halaman pembayaran.
    setPlaced(true);
  }

  return (
    <div className="mx-auto max-w-page px-4 pt-3 pb-8 md:px-[30px]">
      <h1 className="text-3xl font-semibold">Checkout</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Pesanan online diantar ke alamatmu &amp; dibayar dengan QRIS.
      </p>

      {loadError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Gagal memuat checkout. Muat ulang halaman.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid items-start gap-4 md:grid-cols-[1fr_360px] md:gap-6"
      >
        <div className="grid min-w-0 gap-4">
          <Step
            title="1. Titik Antar"
            hint="Geser peta sampai pin tepat di lokasimu, lalu konfirmasi. Driver mengantar ke titik ini."
            aside={
              settings && (
                <span className="shrink-0 rounded-full border border-foreground px-2.5 py-0.5 text-[11px] font-medium">
                  Maks. {settings.maxDistanceKm.toLocaleString('id-ID')} km
                </span>
              )
            }
          >
            {settings && store ? (
              <LocationPicker
                value={location}
                fallback={store}
                onChange={(point) => {
                  // Pin bergeser = titik lama tidak berlaku, ongkir menunggu konfirmasi ulang
                  setLocation(point);
                  setConfirmed(null);
                }}
              />
            ) : (
              <div className="h-[200px] animate-pulse rounded-[6px] bg-muted md:h-[220px]" />
            )}

            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <p aria-live="polite" className="flex min-w-0 flex-1 items-start gap-1.5 text-xs">
                <MapPin aria-hidden className="mt-px size-3.5 shrink-0" />
                {!location ? 'Belum ada titik antar' : (address ?? 'Mencari alamat…')}
              </p>
              {confirmed ? (
                <p className="flex shrink-0 items-center gap-1 text-[11px] font-medium">
                  <Check aria-hidden className="size-3.5" />
                  Titik dikonfirmasi
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmed(location)}
                  disabled={!location}
                  className={cn(
                    'h-8 shrink-0 rounded-[6px] bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-40',
                    focusClass
                  )}
                >
                  Konfirmasi titik ini
                </button>
              )}
            </div>
            {(outOfRange || quote.status === 'error') && settings && (
              <p role="alert" className="mt-1.5 pl-5 text-[11px] text-destructive">
                {outOfRange ? (
                  `Titik ini di luar jangkauan antar (maks. ${settings.maxDistanceKm.toLocaleString('id-ID')} km dari Irona).`
                ) : (
                  <>
                    Gagal menghitung ongkir.{' '}
                    <button
                      type="button"
                      onClick={() => setQuoteAttempt((n) => n + 1)}
                      className={cn('font-medium underline', focusClass)}
                    >
                      Coba lagi
                    </button>
                  </>
                )}
              </p>
            )}
          </Step>

          <Step title="2. Data Pemesan" hint="Nomor WhatsApp dipakai driver untuk menghubungimu.">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="grid gap-1 text-[11px] font-medium">
                Nama
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama penerima"
                  autoComplete="name"
                  required
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-1 text-[11px] font-medium">
                Nomor WhatsApp
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-1 text-[11px] font-medium sm:col-span-2">
                Catatan untuk driver (opsional)
                <input
                  value={driverNote}
                  onChange={(e) => setDriverNote(e.target.value)}
                  placeholder="Mis. rumah pagar hijau, sebelah masjid"
                  maxLength={100}
                  className={fieldClass}
                />
              </label>
            </div>
            {member ? (
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={saveForNext}
                  onChange={(e) => setSaveForNext(e.target.checked)}
                  className="size-[15px] accent-foreground"
                />
                Simpan nama, nomor &amp; titik antar untuk pesanan berikutnya
              </label>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Member Irona? Data &amp; titik antar tersimpan otomatis.{' '}
                <Link
                  to="/membership"
                  className={cn('font-medium text-foreground underline', focusClass)}
                >
                  Masuk member
                </Link>
              </p>
            )}
          </Step>

          <Step
            title="3. Voucher & Promo"
            hint="1 voucher per pesanan. Otomatis dipilih potongan terbesar."
          >
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (code.trim()) applyCode();
                  }
                }}
                aria-label="Kode voucher"
                placeholder="Punya kode voucher?"
                className={cn(fieldClass, 'uppercase placeholder:normal-case')}
              />
              <button
                type="button"
                onClick={applyCode}
                disabled={!code.trim()}
                className={cn(
                  'h-[36px] shrink-0 rounded-[6px] border border-foreground px-4 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-40',
                  focusClass
                )}
              >
                Pakai
              </button>
            </div>
            {codeError && (
              <p role="alert" className="mt-1.5 text-[11px] text-destructive">
                {codeError}
              </p>
            )}

            <div role="radiogroup" aria-label="Pilih voucher" className="mt-3 grid gap-2">
              {vouchers.map((v) => {
                const r = checkVoucher(v, voucherCtx);
                const ok = 'discount' in r && r.discount > 0;
                const selected = voucher?.id === v.id;
                return (
                  <label
                    key={v.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-[6px] border border-foreground px-3 py-2.5 transition-colors',
                      selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary',
                      !ok && !selected && 'border-dashed border-border text-muted-foreground',
                      'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground'
                    )}
                  >
                    <input
                      type="radio"
                      name="voucher"
                      checked={selected}
                      onChange={() => {
                        setVoucherId(v.id);
                        setCodeError(null);
                      }}
                      className="sr-only"
                    />
                    <TicketPercent aria-hidden className="size-4 shrink-0" />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-xs font-medium">{v.name}</span>
                      <span className="text-[10px] opacity-75">
                        <span className="font-mono">{v.code}</span> ·{' '}
                        {'reason' in r ? r.reason : `Min. belanja ${formatRupiah(v.minPurchase)}`}
                      </span>
                    </span>
                    {ok && (
                      <span className="shrink-0 text-[11px] font-semibold">
                        −{formatRupiah(r.discount)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {voucher && (
              <button
                type="button"
                onClick={() => setVoucherId(null)}
                className={cn('mt-2 text-[11px] underline', focusClass)}
              >
                Jangan pakai voucher
              </button>
            )}
          </Step>

          <Step title="4. Pembayaran">
            <div className="flex items-center gap-3 rounded-[6px] bg-primary px-3 py-3 text-primary-foreground">
              <QrCode aria-hidden className="size-6 shrink-0" />
              <div className="grid gap-0.5">
                <p className="text-sm font-medium">QRIS</p>
                <p className="text-[11px] opacity-75">
                  Semua e-wallet &amp; m-banking. Kode QR muncul setelah pesanan dibuat.
                </p>
              </div>
            </div>
          </Step>
        </div>

        <aside aria-label="Ringkasan pesanan" className={cn(panelClass, 'p-4 md:sticky md:top-20')}>
          <h2 className="text-[11px] font-medium tracking-[0.12em] uppercase">Ringkasan pesanan</h2>

          {!products ? (
            <div className="mt-3 h-24 animate-pulse rounded-[4px] bg-muted" />
          ) : items.length === 0 ? (
            <div className="mt-3 grid justify-items-start gap-2 text-xs">
              <p>Keranjang masih kosong.</p>
              <Link
                to="/menu"
                className={cn(
                  'rounded-[6px] border border-foreground px-3 py-1.5 font-medium',
                  focusClass
                )}
              >
                Lihat menu
              </Link>
            </div>
          ) : (
            <ul className="mt-3 grid gap-4">
              {items.map(({ product, qty }) => {
                const note = itemNotes[product.id] ?? '';
                const price = product.sellingPrice ?? 0;
                return (
                  <li key={product.id} className="grid gap-2">
                    <div className="flex gap-2.5">
                      <div className="size-[54px] shrink-0 overflow-hidden border border-foreground">
                        <MenuImage src={product.photoUrl} alt={product.name} />
                      </div>
                      <div className="grid min-w-0 flex-1 content-start gap-1">
                        <p className="text-xs font-medium">{product.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {product.isSoldOut
                            ? 'Habis — tidak ikut dipesan'
                            : `${formatRupiah(price)} / pcs`}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex h-7 items-center rounded-[6px] border border-foreground text-xs">
                            <button
                              type="button"
                              onClick={() => setQuantity(product.id, qty - 1)}
                              aria-label={
                                qty === 1
                                  ? `Hapus ${product.name}`
                                  : `Kurangi jumlah ${product.name}`
                              }
                              className={cn('h-full w-7 rounded-[6px]', focusClass)}
                            >
                              {qty === 1 ? <X aria-hidden className="mx-auto size-3" /> : '−'}
                            </button>
                            <span className="min-w-5 text-center tabular-nums">{qty}</span>
                            <button
                              type="button"
                              onClick={() => setQuantity(product.id, qty + 1)}
                              disabled={qty >= MAX_QTY || product.isSoldOut}
                              aria-label={`Tambah jumlah ${product.name}`}
                              className={cn(
                                'h-full w-7 rounded-[6px] disabled:opacity-40',
                                focusClass
                              )}
                            >
                              +
                            </button>
                          </div>
                          <p
                            className={cn(
                              'text-[11px] font-semibold',
                              product.isSoldOut && 'line-through opacity-50'
                            )}
                          >
                            {formatRupiah(price * qty)}
                          </p>
                        </div>
                      </div>
                    </div>
                    {!product.isSoldOut && (
                      <div className="relative">
                        <input
                          value={note}
                          onChange={(e) =>
                            setItemNotes((prev) => ({ ...prev, [product.id]: e.target.value }))
                          }
                          maxLength={ITEM_NOTE_MAX}
                          aria-label={`Catatan untuk ${product.name}`}
                          placeholder="Catatan menu, mis. tanpa es / gula sedikit"
                          className={cn(fieldClass, 'h-[30px] pr-12 text-[11px]')}
                        />
                        {note && (
                          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">
                            {note.length}/{ITEM_NOTE_MAX}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <dl className="mt-4 grid gap-2.5 border-t border-foreground pt-3 text-xs">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatRupiah(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Ongkir</dt>
              <dd>
                {quote.status === 'loading'
                  ? 'Menghitung…'
                  : shippingFee === null
                    ? '—'
                    : formatRupiah(shippingFee)}
              </dd>
            </div>
            {discount > 0 && voucher && (
              <div className="flex justify-between gap-2">
                <dt>
                  {voucher.target === 'ongkir' ? 'Potongan ongkir' : 'Diskon'}{' '}
                  <span className="font-mono text-[10px]">{voucher.code}</span>
                </dt>
                <dd>−{formatRupiah(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Biaya layanan</dt>
              <dd>{formatRupiah(serviceFee)}</dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase">Total</dt>
              <dd className="text-lg font-bold">{formatRupiah(total)}</dd>
            </div>
          </dl>

          <button
            type="submit"
            disabled={problem !== null}
            className={cn(
              'mt-3 flex h-[44px] w-full items-center justify-center gap-2 rounded-[6px] bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-40',
              focusClass
            )}
          >
            <QrCode aria-hidden className="size-4" />
            Bayar dengan QRIS
          </button>
          <p aria-live="polite" className="mt-2 text-center text-[11px] text-muted-foreground">
            {placed
              ? '(Mockup) Lanjut ke halaman pembayaran QRIS — belum terhubung Midtrans.'
              : (problem ?? 'Pesanan dibuat setelah pembayaran QRIS berhasil.')}
          </p>
        </aside>
      </form>
    </div>
  );
}
