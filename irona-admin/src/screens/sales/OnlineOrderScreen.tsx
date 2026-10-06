import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bike, CheckCircle2, CreditCard, EyeOff, History, Receipt, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import {
  calcDeliveryFee,
  fetchOnlineOrderSettings,
  fetchOnlineProducts,
  fetchPausedProducts,
  pauseProductOnline,
  resumeProductOnline,
  saveDeliverySettings,
  saveServiceFee,
} from '../../services/onlineOrder';
import { formatRupiah } from '../../utils/format';
import type {
  DeliverySettings,
  OnlineOrderSettings,
  OnlineProductOption,
  PausedProduct,
} from '../../types/onlineOrder';
import { RupiahInput } from '../products/product-form/formUi';
import GatewaySimulationModal from './GatewaySimulationModal';
import OnlineOrderHistoryModal from './OnlineOrderHistoryModal';

function Section({
  icon: Icon,
  title,
  description,
  aside,
  children,
}: {
  icon: typeof Bike;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#334155]">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-[#0f172a]">{title}</p>
            <p className="text-xs text-[#64748b]">{description}</p>
          </div>
        </div>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  suffix,
  decimal,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  decimal?: boolean;
}) {
  return (
    <div className="flex items-center rounded-xl border border-[#cbd5e1] bg-white pr-4 focus-within:border-[#94a3b8]">
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, '').slice(0, 6))
        }
        className="w-full bg-transparent px-[17px] py-[13px] text-sm font-semibold text-[#0f172a] outline-none"
      />
      <span className="text-sm text-[#64748b]">{suffix}</span>
    </div>
  );
}

const labelClass = 'text-xs font-bold uppercase tracking-[0.6px] text-[#334155]';

/* ---------- Section 1: Jeda Tayang ---------- */
function PauseSection({ onChanged }: { onChanged: (message: string) => void }) {
  const [paused, setPaused] = useState<PausedProduct[]>([]);
  const [products, setProducts] = useState<OnlineProductOption[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [p, list] = await Promise.all([fetchPausedProducts(), fetchOnlineProducts()]);
      setPaused(p);
      setProducts(list);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat produk.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pausedIds = new Set(paused.map((p) => p.productId));
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? products.filter((p) => !pausedIds.has(p.id) && p.name.toLowerCase().includes(q)).slice(0, 8)
      : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, products, paused]);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onChanged(message);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      icon={EyeOff}
      title="Jeda Tayang Online"
      description="Sembunyikan produk sementara dari Web Customer (mis. bahan habis). Status produk & pesanan Dine In/Take Away tidak terpengaruh."
    >
      <div className="relative mb-4 w-96">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari produk untuk dijeda tayangnya di Online"
          className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 pl-[41px] pr-[17px] text-xs text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#94a3b8]"
        />
        {results.length > 0 && (
          <div className="absolute left-0 top-[46px] z-20 w-full overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-lg">
            {results.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Jeda tayang "${p.name}" di Web Customer?`)) return;
                  setSearch('');
                  run(() => pauseProductOnline(p.id), `"${p.name}" dijeda dari Online.`);
                }}
                className="flex w-full items-center justify-between gap-3 border-t border-[#f1f5f9] px-4 py-2.5 text-left text-xs first:border-t-0 hover:bg-[#f8fafc]"
              >
                <span className="font-semibold text-[#0f172a]">{p.name}</span>
                <span className="text-xs text-[#94a3b8]">{p.categoryName}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-[#e11d48]">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="border-y border-[#e2e8f0] bg-[#f8fafc]">
            <tr className="text-xs font-bold uppercase tracking-[0.4px] text-[#64748b]">
              <th className="px-3 py-2.5 text-left">Nama Produk</th>
              <th className="px-3 py-2.5 text-left">Dijeda Sejak</th>
              <th className="px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paused.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-sm text-[#94a3b8]">
                  Tidak ada produk yang sedang dijeda tayangnya dari Online.
                </td>
              </tr>
            )}
            {paused.map((p) => (
              <tr key={p.productId} className="border-t border-[#f1f5f9]">
                <td className="px-3 py-2.5 text-sm font-semibold text-[#0f172a]">{p.productName}</td>
                <td className="px-3 py-2.5 text-sm text-[#475569]">
                  {new Date(p.pausedAt).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => resumeProductOnline(p.productId),
                        `"${p.productName}" tampil lagi di Online.`
                      )
                    }
                    className="rounded-lg border border-[#e2e8f0] px-3 py-1 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
                  >
                    Tampilkan Kembali
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ---------- Section 2: Skema Ongkir ---------- */
function toForm(s: DeliverySettings) {
  return {
    feePerStep: String(Math.round(s.feePerStep)),
    stepKm: String(s.stepKm),
    feePer100m: String(Math.round(s.feePer100m)),
    maxDistanceKm: String(s.maxDistanceKm),
  };
}

function DeliverySection({
  saved,
  onSaved,
}: {
  saved: DeliverySettings;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState(toForm(saved));
  const [simulate, setSimulate] = useState('4.5');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settings: DeliverySettings = {
    feePerStep: Number(form.feePerStep) || 0,
    stepKm: Number(form.stepKm) || 0,
    feePer100m: Number(form.feePer100m) || 0,
    maxDistanceKm: Number(form.maxDistanceKm) || 0,
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(saved));
  const valid = settings.stepKm > 0 && settings.maxDistanceKm > 0;

  const sim = valid ? calcDeliveryFee(Number(simulate) || 0, settings) : null;
  const examples = valid
    ? [
        settings.stepKm,
        settings.stepKm + 0.5,
        settings.stepKm * 2,
        settings.maxDistanceKm,
        settings.maxDistanceKm + 0.3,
      ].map((d) => Math.round(d * 10) / 10)
    : [];

  async function handleSave() {
    if (!valid) {
      setError('Kelipatan jarak & jarak maksimal harus lebih dari 0.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDeliverySettings(settings);
      onSaved('Skema ongkir berhasil disimpan.');
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan skema ongkir.');
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof form) => (v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <Section
      icon={Bike}
      title="Skema Ongkir"
      description="Jarak dihitung dari outlet ke titik pin lokasi pelanggan. Tidak ada gratis ongkir berdasarkan jarak; potongan/gratis ongkir dibuat lewat Promosi › Diskon."
      aside={
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="shrink-0 rounded-lg bg-[#0f172a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-40"
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Tarif per Kelipatan</span>
          <RupiahInput value={form.feePerStep} onChange={set('feePerStep')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Kelipatan Jarak</span>
          <NumberInput value={form.stepKm} onChange={set('stepKm')} suffix="km" decimal />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Tarif per 100 m</span>
          <RupiahInput value={form.feePer100m} onChange={set('feePer100m')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Jarak Maksimal</span>
          <NumberInput
            value={form.maxDistanceKm}
            onChange={set('maxDistanceKm')}
            suffix="km"
            decimal
          />
        </div>
      </div>
      <p className="pt-2 text-xs leading-4 text-[#94a3b8]">
        Ongkir dihitung dari 0 km: tiap kelipatan penuh kena tarif per kelipatan; sisa jarak yang
        belum genap 1 kelipatan kena tarif per 100 m (dibulatkan ke atas). Di atas jarak maksimal,
        opsi antar tidak muncul saat checkout.
      </p>
      {error && <p className="pt-2 text-xs text-[#e11d48]">{error}</p>}

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.55px] text-[#64748b]">Simulasi</p>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <NumberInput value={simulate} onChange={setSimulate} suffix="km" decimal />
          </div>
          <span className="text-sm text-[#64748b]">→</span>
          {sim ? (
            sim.deliverable ? (
              <span className="font-mono text-lg font-bold text-[#0f172a]">
                {formatRupiah(sim.fee)}
              </span>
            ) : (
              <span className="text-sm font-bold text-[#e11d48]">Di luar jangkauan antar</span>
            )
          ) : (
            <span className="text-xs text-[#94a3b8]">Lengkapi skema dulu</span>
          )}
        </div>
        {sim?.deliverable && sim.fee > 0 && (
          <p className="text-xs text-[#475569]">
            {sim.steps > 0 && `${sim.steps} kelipatan × ${formatRupiah(settings.feePerStep)}`}
            {sim.steps > 0 && sim.remainderM > 0 && ' + '}
            {sim.remainderM > 0 &&
              `sisa ${sim.remainderM} m → ${Math.ceil(sim.remainderM / 100)} × ${formatRupiah(settings.feePer100m)}`}
          </p>
        )}
        {examples.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {examples.map((d) => {
              const r = calcDeliveryFee(d, settings);
              return (
                <span
                  key={d}
                  className="rounded-full border border-[#e2e8f0] bg-white px-3 py-1 text-xs text-[#475569]"
                >
                  {d.toLocaleString('id-ID')} km ={' '}
                  <span
                    className={`font-mono font-bold ${r.deliverable ? 'text-[#0f172a]' : 'text-[#e11d48]'}`}
                  >
                    {r.deliverable ? formatRupiah(r.fee) : 'ditolak'}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ---------- Section 3: Biaya Layanan ---------- */
function ServiceFeeSection({
  saved,
  onSaved,
}: {
  saved: number;
  onSaved: (message: string) => void;
}) {
  const [fee, setFee] = useState(String(Math.round(saved)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = fee !== String(Math.round(saved));

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveServiceFee(Number(fee) || 0);
      onSaved('Biaya layanan berhasil disimpan.');
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan biaya layanan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      icon={Receipt}
      title="Biaya Layanan"
      description="Dikenakan ke setiap checkout online, untuk menutup potongan payment gateway."
      aside={
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="shrink-0 rounded-lg bg-[#0f172a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-40"
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      }
    >
      <div className="w-64">
        <RupiahInput value={fee} onChange={setFee} placeholder="1.000" />
      </div>
      {error && <p className="pt-2 text-xs text-[#e11d48]">{error}</p>}
    </Section>
  );
}

export default function OnlineOrderScreen() {
  const [settings, setSettings] = useState<OnlineOrderSettings | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [simulationOpen, setSimulationOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await fetchOnlineOrderSettings());
      setVersion((v) => v + 1);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat pengaturan order online.');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  function afterSave(message: string) {
    setFlash(message);
    loadSettings();
  }

  return (
    <div className="flex max-w-[1400px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Order Online"
        info="Pengaturan pesanan dari Web Customer: jeda tayang produk, skema ongkir, biaya layanan, dan info potongan payment gateway. Harga online diatur di Tipe Order."
        action={
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            <History className="size-3.5" />
            Riwayat Perubahan
          </button>
        }
      />

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-xs font-medium text-[#0f172a]">
          <CheckCircle2 className="size-4 text-[#059669]" />
          {flash}
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      <PauseSection onChanged={setFlash} />

      {settings ? (
        <>
          <DeliverySection key={`ongkir-${version}`} saved={settings} onSaved={afterSave} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ServiceFeeSection
              key={`fee-${version}`}
              saved={settings.serviceFee}
              onSaved={afterSave}
            />
            <Section
              icon={CreditCard}
              title="Rumus Payment Gateway"
              description="Informasi saja — dipotong otomatis oleh payment gateway."
              aside={
                <button
                  onClick={() => setSimulationOpen(true)}
                  className="shrink-0 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
                >
                  Lihat Simulasi
                </button>
              }
            >
              <p className="font-mono text-sm font-bold text-[#0f172a]">
                MDR {settings.mdrPercent}% + PPN {settings.ppnPercent}% dari MDR
              </p>
              <p className="pt-1 text-xs text-[#94a3b8]">
                PPN hanya dikenakan ke biaya MDR, bukan ke total transaksi.
              </p>
            </Section>
          </div>
        </>
      ) : (
        <p className="py-6 text-center text-xs text-[#94a3b8]">Memuat pengaturan...</p>
      )}

      {historyOpen && <OnlineOrderHistoryModal onClose={() => setHistoryOpen(false)} />}
      {simulationOpen && settings && (
        <GatewaySimulationModal
          mdrPercent={settings.mdrPercent}
          ppnPercent={settings.ppnPercent}
          onClose={() => setSimulationOpen(false)}
        />
      )}
    </div>
  );
}
