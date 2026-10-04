import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Check,
  ChevronRight,
  MapPin,
  Pencil,
  QrCode,
  TicketPercent,
  UserRound,
  X,
} from 'lucide-react';
import { useMember } from '@/hooks/useMember';
import { cn } from '@/lib/utils';
import {
  createOnlineOrder,
  fetchDeliverySettings,
  fetchOnlineVouchers,
  quoteDelivery,
} from '@/services/onlineOrder';
import { fetchAllOnlineProducts } from '@/services/products';
import type { Member } from '@/types/membership';
import type { DeliveryQuote, DeliverySettings, LatLng, Voucher } from '@/types/onlineOrder';
import type { Product } from '@/types/product';
import { cleanPhone, formatRupiah, PHONE_PATTERN } from '@/utils/format';
import {
  bestVoucher,
  checkVoucher,
  ORDER_NOTE_MAX,
  TARGET_TONE,
  type VoucherTarget,
} from './checkout/checkoutLogic';
import LocationPicker from './checkout/LocationPicker';
import VoucherDialog from './checkout/VoucherDialog';
import MenuImage from './home/MenuImage';
import type { RecentOrder } from './order/orderLogic';
import RecentOrders from './order/RecentOrders';
import { loadRecentOrders, rememberOrder } from './order/orderHistory';
import { MAX_QTY, useQuickCart } from './home/useQuickCart';

// Checkout online: hanya diantar (delivery) & bayar QRIS.
// ponytail: mockup — ongkir/voucher/pesanan dari data mock, QRIS Midtrans belum tersambung.

const panelClass = 'rounded-[4px] border border-foreground bg-card';
const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';
const fieldClass = cn(
  'h-[36px] w-full rounded-[6px] border border-foreground bg-background px-3 text-xs placeholder:text-muted-foreground',
  focusClass
);

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

export default function CheckoutScreen() {
  const { member, openLogin } = useMember();
  const { itemCount } = useQuickCart();
  const [recent] = useState(loadRecentOrders);

  // Keranjang kosong + ada pesanan barusan: tampilkan status pesanan, bukan form checkout kosong
  if (itemCount === 0 && recent.length > 0)
    return (
      <div className="mx-auto max-w-page px-4 pt-3 pb-8 md:px-[30px]">
        <title>Pesanan | Toko Kopi Irona</title>
        <h1 className="text-3xl font-semibold">Keranjang</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Keranjang kosong. Pantau status pesananmu di sini.
        </p>
        <div className="mt-4 grid max-w-xl justify-items-start gap-4">
          <div className="w-full">
            <RecentOrders recent={recent} />
          </div>
          <Link
            to="/menu"
            className={cn(
              'rounded-[6px] border border-foreground px-4 py-2 text-xs font-medium hover:bg-secondary',
              focusClass
            )}
          >
            Pesan lagi
          </Link>
        </div>
      </div>
    );

  return (
    <>
      <title>Checkout | Toko Kopi Irona</title>
      <Checkout member={member} openLogin={openLogin} recent={recent} />
    </>
  );
}

function Checkout({
  member,
  openLogin,
  recent,
}: {
  member: Member | null;
  openLogin: () => void;
  recent: RecentOrder[];
}) {
  const navigate = useNavigate();
  const { quantityOf, setQuantity, clear: clearCart } = useQuickCart();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [saved] = useState(() => (member ? loadSaved(member.id) : null));
  const [location, setLocation] = useState<LatLng | null>(saved?.location ?? null);
  /** Titik yang sudah dikonfirmasi; titik tersimpan member dianggap sudah dikonfirmasi */
  const [confirmed, setConfirmed] = useState<LatLng | null>(saved?.location ?? null);
  /** "Ubah titik": peta dibuka lagi, tapi titik & ongkir lama baru gugur kalau pin benar-benar digeser */
  const [editingPoint, setEditingPoint] = useState(false);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [name, setName] = useState(saved?.name ?? member?.name ?? '');
  const [phone, setPhone] = useState(saved?.phone ?? member?.phoneNumber ?? '');
  const [driverNote, setDriverNote] = useState('');
  const [saveForNext, setSaveForNext] = useState(true);
  const [orderNote, setOrderNote] = useState('');

  // Login lewat pop-up tanpa memasang ulang form: yang sudah diketik tetap, yang kosong diisi data member
  const [filledFor, setFilledFor] = useState(member?.id);
  if (member && member.id !== filledFor) {
    setFilledFor(member.id);
    const s = loadSaved(member.id);
    if (!name.trim()) setName(s?.name ?? member.name);
    if (!phone.trim()) setPhone(s?.phone ?? member.phoneNumber);
    if (!location && s?.location) {
      setLocation(s.location);
      setConfirmed(s.location);
    }
  }
  /** Per sasaran: undefined = otomatis (promo otomatis potongan terbesar), null = tanpa voucher */
  const [voucherPicks, setVoucherPicks] = useState<
    Record<VoucherTarget, string | null | undefined>
  >({ produk: undefined, ongkir: undefined });
  const voucherDialog = useRef<HTMLDialogElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const placed = useRef(false);

  // Keranjang dikosongkan setelah halaman ini lepas (tirai transisi sudah menutup),
  // supaya daftar pesanan tidak sempat terlihat kosong sebelum pindah ke halaman bayar
  useEffect(
    () => () => {
      if (placed.current) clearCart();
    },
    [clearCart]
  );

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
  const itemCount = items.reduce((sum, i) => (i.product.isSoldOut ? sum : sum + i.qty), 0);
  const store = settings && { lat: settings.storeLat, lng: settings.storeLng };
  const quote = useDeliveryQuote(confirmed, quoteAttempt);
  const km = quote.status === 'ok' ? quote.quote.distanceKm : null;
  const shippingFee = quote.status === 'ok' ? quote.quote.fee : null;
  const outOfRange = quote.status === 'ok' && !quote.quote.deliverable;
  const address = useAddressLabel(location);

  const voucherCtx = { subtotal, shippingFee, km, isMember: member !== null };
  /** Maks. 1 voucher menu + 1 voucher ongkir */
  function slot(target: VoucherTarget) {
    const id = voucherPicks[target];
    const voucher =
      id === undefined
        ? bestVoucher(vouchers, voucherCtx, target)
        : (vouchers.find((v) => v.id === id) ?? null);
    const result = voucher && checkVoucher(voucher, voucherCtx);
    return {
      voucher,
      discount: result && 'discount' in result ? result.discount : 0,
      reason: result && 'reason' in result ? result.reason : null,
    };
  }
  const menuSlot = slot('produk');
  // Potongan ongkir tampil di baris ongkir (harga dicoret); potongan menu di baris voucher sendiri
  const shipSlot = slot('ongkir');
  const adminFee = settings?.serviceFee ?? 0;
  const total = subtotal + (shippingFee ?? 0) + adminFee - menuSlot.discount - shipSlot.discount;

  const phoneNumber = cleanPhone(phone);
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
                  : !PHONE_PATTERN.test(phoneNumber)
                    ? 'Nomor WhatsApp belum valid'
                    : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (problem || submitting || !confirmed) return;
    if (member)
      storeSaved(
        member.id,
        saveForNext ? { name: name.trim(), phone: phoneNumber, location } : null
      );
    setSubmitting(true);
    setSubmitError(false);
    try {
      const order = await createOnlineOrder({
        customerName: name.trim(),
        phone: phoneNumber,
        location: confirmed,
        address,
        driverNote: driverNote.trim(),
        orderNote: orderNote.trim(),
        voucherIds: [menuSlot, shipSlot].flatMap((s) =>
          s.voucher && s.discount > 0 ? [s.voucher.id] : []
        ),
        items: items
          .filter((i) => !i.product.isSoldOut)
          .map(({ product, qty }) => ({
            productId: product.id,
            name: product.name,
            qty,
            price: product.sellingPrice ?? 0,
          })),
        subtotal,
        shippingFee: shippingFee ?? 0,
        discount: menuSlot.discount + shipSlot.discount,
        serviceFee: adminFee,
      });
      rememberOrder({ id: order.id, createdAt: order.createdAt });
      placed.current = true;
      navigate(`/pesanan/${order.id}`);
    } catch (err) {
      console.error('Gagal membuat pesanan', err);
      setSubmitError(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-page px-4 pt-3 pb-8 md:px-[30px]">
      <h1 className="text-3xl font-semibold">Checkout</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Pesanan online diantar ke alamatmu &amp; dibayar dengan QRIS.
      </p>

      {recent.length > 0 && (
        <div className="mt-4">
          <RecentOrders recent={recent} />
        </div>
      )}

      {loadError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Gagal memuat checkout. Muat ulang halaman.
        </p>
      )}

      {/* Mobile: member, antar & data dulu, lalu pesanan. md+: peta & data di kiri, pesanan di kanan */}
      <form
        onSubmit={handleSubmit}
        className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:gap-6 lg:grid-cols-[minmax(0,1fr)_400px]"
      >
        <div className="grid min-w-0 gap-4">
          {/* Paling atas: member yang lupa login tidak perlu isi titik & data dulu */}
          {!member && (
            <div
              className={cn(
                panelClass,
                'flex flex-col gap-3 bg-secondary p-4 sm:flex-row sm:items-center'
              )}
            >
              <UserRound aria-hidden className="hidden size-5 shrink-0 sm:block" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Member Irona?</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Masuk dulu biar nama, nomor &amp; titik antar terisi otomatis, plus bisa pakai
                  voucher khusus member.
                </p>
              </div>
              <button
                type="button"
                onClick={openLogin}
                aria-haspopup="dialog"
                className={cn(
                  'h-9 shrink-0 rounded-[6px] bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60',
                  focusClass
                )}
              >
                Masuk / Daftar
              </button>
            </div>
          )}

          <Step
            title="Titik Antar"
            hint="Geser peta sampai pin tepat di lokasimu, lalu konfirmasi. Setelah dikonfirmasi, peta terkunci."
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
                locked={confirmed !== null && !editingPoint}
                onChange={(point) => {
                  // Pin bergeser = titik lama tidak berlaku, ongkir menunggu konfirmasi ulang
                  setLocation(point);
                  setConfirmed(null);
                }}
              />
            ) : (
              <div className="h-[200px] animate-pulse rounded-[6px] bg-muted md:h-[320px]" />
            )}

            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <p aria-live="polite" className="flex min-w-0 flex-1 items-start gap-1.5 text-xs">
                <MapPin aria-hidden className="mt-px size-3.5 shrink-0" />
                {!location ? 'Belum ada titik antar' : (address ?? 'Mencari alamat…')}
              </p>
              {confirmed && !editingPoint ? (
                <div className="flex shrink-0 items-center gap-2.5">
                  <p className="flex items-center gap-1 text-[11px] font-medium">
                    <Check aria-hidden className="size-3.5" />
                    Titik dikonfirmasi
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingPoint(true)}
                    className={cn(
                      'flex h-8 items-center gap-1.5 rounded-[6px] border border-foreground px-3 text-[11px] font-semibold transition-colors hover:bg-secondary',
                      focusClass
                    )}
                  >
                    <Pencil aria-hidden className="size-3" />
                    Ubah titik
                  </button>
                </div>
              ) : confirmed ? (
                // Mode ubah, pin belum digeser: titik lama masih berlaku
                <div className="flex shrink-0 items-center gap-2.5">
                  <p className="text-[11px] text-muted-foreground">Geser peta ke titik baru</p>
                  <button
                    type="button"
                    onClick={() => setEditingPoint(false)}
                    className={cn(
                      'h-8 rounded-[6px] border border-foreground px-3 text-[11px] font-semibold transition-colors hover:bg-secondary',
                      focusClass
                    )}
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmed(location);
                    setEditingPoint(false);
                  }}
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

          <Step title="Data Pemesan" hint="Nomor WhatsApp dipakai driver untuk menghubungimu.">
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
            {member && (
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={saveForNext}
                  onChange={(e) => setSaveForNext(e.target.checked)}
                  className="size-[15px] accent-foreground"
                />
                Simpan nama, nomor &amp; titik antar untuk pesanan berikutnya
              </label>
            )}
          </Step>
        </div>

        <section aria-labelledby="order-title" className={cn(panelClass, 'min-w-0')}>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
            <h2 id="order-title" className="text-sm font-semibold">
              Pesananmu
              {itemCount > 0 && (
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  ({itemCount} item)
                </span>
              )}
            </h2>
            {items.length > 0 && (
              <Link to="/menu" className={cn('text-[11px] font-medium underline', focusClass)}>
                Tambah menu
              </Link>
            )}
          </div>

          {!products ? (
            <div className="mx-4 mt-3 h-24 animate-pulse rounded-[4px] bg-muted" />
          ) : items.length === 0 ? (
            <div className="grid justify-items-start gap-2 px-4 pt-3 text-xs">
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
            <ul className="divide-y divide-border px-4">
              {items.map(({ product, qty }) => {
                const price = product.sellingPrice ?? 0;
                return (
                  <li key={product.id} className="flex gap-3 py-3">
                    <div className="size-[72px] shrink-0 overflow-hidden rounded-[4px] border border-foreground">
                      <MenuImage src={product.photoUrl} alt={product.name} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                      <div>
                        <p className="line-clamp-2 text-xs leading-snug font-medium">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {product.isSoldOut
                            ? 'Habis — tidak ikut dipesan'
                            : `${formatRupiah(price)} / pcs`}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex h-7 items-center rounded-[6px] border border-foreground text-xs">
                          <button
                            type="button"
                            onClick={() => setQuantity(product.id, qty - 1)}
                            aria-label={
                              qty === 1 ? `Hapus ${product.name}` : `Kurangi jumlah ${product.name}`
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
                            'text-xs font-semibold tabular-nums',
                            product.isSoldOut && 'line-through opacity-50'
                          )}
                        >
                          {formatRupiah(price * qty)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid gap-3 border-t border-foreground p-4">
            <label className="grid gap-1 text-[11px] font-medium">
              Catatan untuk kasir (opsional)
              <span className="relative">
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  maxLength={ORDER_NOTE_MAX}
                  rows={1}
                  placeholder="Mis. kopi susu tanpa es, sendok plastik 2"
                  className={cn(
                    // field-sizing: kosong 1 baris, tumbuh otomatis saat isinya panjang
                    'block min-h-[36px] w-full resize-none rounded-[6px] border border-foreground bg-background py-[9px] pr-14 pl-3 text-xs leading-4 font-normal [field-sizing:content] placeholder:text-muted-foreground',
                    focusClass
                  )}
                />
                {orderNote && (
                  <span className="pointer-events-none absolute right-2.5 bottom-[11px] text-[10px] font-normal text-muted-foreground tabular-nums">
                    {orderNote.length}/{ORDER_NOTE_MAX}
                  </span>
                )}
              </span>
            </label>

            <div>
              <button
                type="button"
                onClick={() => voucherDialog.current?.showModal()}
                aria-haspopup="dialog"
                className={cn(
                  'flex h-[44px] w-full items-center gap-2.5 rounded-[6px] border border-foreground px-3 text-left transition-colors hover:bg-secondary',
                  focusClass
                )}
              >
                <TicketPercent aria-hidden className="size-4 shrink-0" />
                <span className="flex-1 text-xs font-medium">Voucher</span>
                {menuSlot.discount > 0 || shipSlot.discount > 0 ? (
                  <span className="flex gap-1.5">
                    {[
                      { target: 'produk' as const, label: 'Diskon menu', s: menuSlot },
                      { target: 'ongkir' as const, label: 'Diskon ongkir', s: shipSlot },
                    ].map(
                      ({ target, label, s }) =>
                        s.discount > 0 && (
                          <span
                            key={target}
                            title={label}
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap tabular-nums',
                              TARGET_TONE[target]
                            )}
                          >
                            <span className="sr-only">{label} </span>−{formatRupiah(s.discount)}
                          </span>
                        )
                    )}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Pilih voucher</span>
                )}
                <ChevronRight aria-hidden className="size-4 shrink-0" />
              </button>
              {[menuSlot, shipSlot].map(
                ({ voucher, reason }) =>
                  voucher &&
                  reason && (
                    <p
                      key={voucher.id}
                      role="status"
                      className="mt-1.5 text-[11px] text-destructive"
                    >
                      {voucher.name} belum bisa dipakai: {reason}
                    </p>
                  )
              )}
            </div>
          </div>

          <div className="border-t border-foreground p-4">
            <h3 className="text-[11px] font-medium tracking-[0.12em] uppercase">
              Rincian pembayaran
            </h3>
            <dl className="mt-3 grid gap-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatRupiah(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Ongkir</dt>
                <dd className="text-right tabular-nums">
                  {quote.status === 'loading' ? (
                    'Menghitung…'
                  ) : shippingFee === null ? (
                    <span className="text-muted-foreground">Pilih titik antar</span>
                  ) : shipSlot.discount > 0 ? (
                    <>
                      <s className="mr-1.5 text-muted-foreground">{formatRupiah(shippingFee)}</s>
                      <span className="font-semibold">
                        {shippingFee - shipSlot.discount === 0
                          ? 'Gratis'
                          : formatRupiah(shippingFee - shipSlot.discount)}
                      </span>
                    </>
                  ) : (
                    formatRupiah(shippingFee)
                  )}
                </dd>
              </div>
              {menuSlot.discount > 0 && (
                <div className="flex justify-between gap-2">
                  <dt>Voucher diskon</dt>
                  <dd className="tabular-nums">−{formatRupiah(menuSlot.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt>Biaya admin</dt>
                <dd className="tabular-nums">{settings ? formatRupiah(adminFee) : '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-foreground pt-3">
                <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase">Total</dt>
                <dd className="text-lg font-bold tabular-nums">{formatRupiah(total)}</dd>
              </div>
            </dl>

            <button
              type="submit"
              disabled={problem !== null || submitting}
              className={cn(
                'mt-3 flex h-[44px] w-full items-center justify-center gap-2 rounded-[6px] bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-40',
                focusClass
              )}
            >
              <QrCode aria-hidden className="size-4" />
              {submitting ? 'Membuat pesanan…' : 'Bayar dengan QRIS'}
            </button>
            <p
              aria-live="polite"
              className={cn(
                'mt-2 text-center text-[11px] text-muted-foreground',
                submitError && 'text-destructive'
              )}
            >
              {submitError
                ? 'Gagal membuat pesanan. Coba lagi.'
                : (problem ?? 'Bisa dibayar pakai semua e-wallet & m-banking.')}
            </p>
            {/* Tab baru: isian checkout tetap utuh */}
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Dengan membayar, kamu menyetujui{' '}
              <a
                href="/syarat-ketentuan"
                target="_blank"
                rel="noreferrer"
                className={cn('underline underline-offset-2', focusClass)}
              >
                S&amp;K
              </a>{' '}
              &amp;{' '}
              <a
                href="/kebijakan-privasi"
                target="_blank"
                rel="noreferrer"
                className={cn('underline underline-offset-2', focusClass)}
              >
                Kebijakan Privasi
              </a>
              .
            </p>
          </div>
        </section>
      </form>

      <VoucherDialog
        dialogRef={voucherDialog}
        vouchers={vouchers}
        ctx={voucherCtx}
        picks={{ produk: menuSlot.voucher?.id ?? null, ongkir: shipSlot.voucher?.id ?? null }}
        onPick={(target, id) => setVoucherPicks((prev) => ({ ...prev, [target]: id }))}
      />
    </div>
  );
}
