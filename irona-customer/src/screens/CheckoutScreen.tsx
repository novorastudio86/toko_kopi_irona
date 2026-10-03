import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ponytail: mockup tampilan Checkout (Figma 689:5); isi keranjang, validasi, dan kirim pesanan menyusul

const panelClass = 'rounded-[4px] border border-foreground bg-card';
const fieldClass =
  'h-[33px] w-full rounded-[6px] border border-foreground bg-background px-3 text-[11px] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';
/** Pilihan radio: kotak outline, terisi hitam saat dipilih */
const optionClass =
  'cursor-pointer border border-foreground transition-colors has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground';

const PICKUP_OPTIONS = [
  { value: 'pickup', label: 'Pickup di toko', hint: 'Ambil sendiri' },
  { value: 'dine-in', label: 'Dine in', hint: 'Nomor meja' },
  { value: 'delivery', label: 'Delivery', hint: 'Radius 5 km' },
];

const PAYMENT_OPTIONS = [
  { value: 'qris', label: 'QRIS', hint: 'Semua e-wallet' },
  { value: 'transfer', label: 'Transfer bank', hint: 'Verifikasi manual' },
  { value: 'kasir', label: 'Bayar di kasir', hint: 'Khusus pickup' },
];

const MOCK_ITEMS = [
  { id: 1, name: 'Nama menu', variant: 'Large · Ice · Normal · 1×', price: 'Rp 00.000' },
  { id: 2, name: 'Nama menu', variant: 'Regular · Hot · 2×', price: 'Rp 00.000' },
];

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className={cn(panelClass, 'px-4 pt-4 pb-4')}>
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="mb-3 text-xs font-medium">
        {title}
      </p>
      {children}
    </fieldset>
  );
}

export default function CheckoutScreen() {
  return (
    <>
      <title>Checkout | Toko Kopi Irona</title>
      <div className="mx-auto max-w-page px-4 pt-3 pb-6 md:px-[30px]">
        <h1 className="text-3xl font-semibold">Checkout</h1>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-4 grid items-start gap-4 md:grid-cols-[1fr_340px] md:gap-6"
        >
          <div className="grid gap-4">
            <Step title="1. Cara Ambil">
              <div className="grid gap-2.5 sm:grid-cols-3">
                {PICKUP_OPTIONS.map((o, i) => (
                  <label key={o.value} className={cn(optionClass, 'grid gap-1 px-3 py-3')}>
                    <input
                      type="radio"
                      name="pickup"
                      value={o.value}
                      defaultChecked={i === 0}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{o.label}</span>
                    <span className="text-[10px] opacity-60">{o.hint}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[240px_1fr]">
                <select aria-label="Waktu ambil" className={cn(fieldClass, 'font-medium')}>
                  <option>Waktu ambil</option>
                  <option>Secepatnya</option>
                </select>
                <input
                  aria-label="Nomor meja / alamat"
                  placeholder="Nomor meja / alamat"
                  className={fieldClass}
                />
              </div>
            </Step>

            <Step title="2. Data Pemesanan">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input
                  aria-label="Nama lengkap"
                  placeholder="Nama lengkap"
                  autoComplete="name"
                  className={fieldClass}
                />
                <input
                  aria-label="Nomor WhatsApp"
                  placeholder="Nomor WhatsApp"
                  type="tel"
                  autoComplete="tel"
                  className={fieldClass}
                />
                <input
                  aria-label="Catatan pesanan (opsional)"
                  placeholder="Catatan pesanan (opsional)"
                  className={cn(fieldClass, 'sm:col-span-2')}
                />
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input type="checkbox" className="size-[15px] accent-foreground" />
                Simpan sebagai member Irona biar nggak isi ulang
              </label>
            </Step>

            <Step title="3. Pembayaran">
              <div className="grid gap-2">
                {PAYMENT_OPTIONS.map((o, i) => (
                  <label
                    key={o.value}
                    className={cn(optionClass, 'flex h-[42px] items-center justify-between px-3')}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={o.value}
                      defaultChecked={i === 0}
                      className="sr-only"
                    />
                    <span className="text-xs">{o.label}</span>
                    <span className="font-mono text-[10px]">{o.hint}</span>
                  </label>
                ))}
              </div>
            </Step>
          </div>

          <aside
            aria-label="Ringkasan pesanan"
            className={cn(panelClass, 'p-4 md:sticky md:top-20')}
          >
            <h2 className="text-[11px] font-medium tracking-[0.12em] uppercase">
              Ringkasan pesanan
            </h2>
            <ul className="mt-3 grid gap-3">
              {MOCK_ITEMS.map((item) => (
                <li key={item.id} className="flex gap-2.5">
                  <div className="grid size-[54px] shrink-0 place-items-center border border-foreground bg-stripes text-[9px] font-semibold">
                    FOTO
                  </div>
                  <div className="grid content-start gap-1">
                    <p className="text-xs font-medium">{item.name}</p>
                    <p className="text-[10px]">{item.variant}</p>
                    <p className="text-[11px] font-semibold tracking-wider uppercase">
                      {item.price}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid gap-3 border-t border-foreground pt-3 text-xs">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>Rp 00.000</dd>
              </div>
              <div className="flex justify-between">
                <dt>Biaya layanan</dt>
                <dd>Rp 0.000</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase">Total</dt>
                <dd className="text-lg font-bold">Rp 00.000</dd>
              </div>
            </dl>
            <button
              type="submit"
              className="mt-3 h-[41px] w-full rounded-[6px] bg-primary text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              Buat pesanan
            </button>
          </aside>
        </form>
      </div>
    </>
  );
}
