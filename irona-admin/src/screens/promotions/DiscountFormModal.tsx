import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Info, Search, X } from 'lucide-react';
import { fetchProductOptions, savePromotion } from '../../services/promotions';
import { formatRupiah } from '../../utils/format';
import { todayISO } from '../../utils/date';
import type {
  Channel,
  DiscountKind,
  DiscountTarget,
  MinPurchaseType,
  ProductOption,
  PromoType,
  Promotion,
  PromotionInput,
  TargetCustomer,
} from '../../types/promotion';
import { FieldError, FieldLabel, RupiahInput, inputClass } from '../products/product-form/formUi';
import { DAY_LABELS, DAY_ORDER, typeMeaning } from './discountFormat';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#e2e8f0] p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-[#64748b]">{title}</p>
      {children}
    </div>
  );
}

/** Segmented control: tepat satu pilihan aktif */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-fit rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
            value === o.value
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-[#475569] hover:text-[#0f172a]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-[#334155]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[#0f172a]"
      />
      {label}
    </label>
  );
}

/** Dropdown jenis nilai + angka dalam 1 baris (PRD) */
function ValueInput({
  kind,
  value,
  onKindChange,
  onValueChange,
  hasError,
}: {
  kind: DiscountKind;
  value: string;
  onKindChange: (k: DiscountKind) => void;
  onValueChange: (v: string) => void;
  hasError: boolean;
}) {
  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-xl border bg-white ${hasError ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'}`}
    >
      <select
        value={kind}
        onChange={(e) => onKindChange(e.target.value as DiscountKind)}
        className="border-r border-[#e2e8f0] bg-[#f8fafc] px-3 text-xs font-bold text-[#334155] outline-none"
      >
        <option value="nominal">Nominal (Rp)</option>
        <option value="persen">Persentase (%)</option>
      </select>
      {kind === 'nominal' && (
        <span className="flex items-center pl-4 text-sm text-[#64748b]">Rp</span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={kind === 'nominal' && value ? Number(value).toLocaleString('id-ID') : value}
        onChange={(e) =>
          onValueChange(e.target.value.replace(/\D/g, '').slice(0, kind === 'persen' ? 3 : 12))
        }
        placeholder={kind === 'persen' ? '20' : '5.000'}
        className="w-full bg-transparent px-3 py-[13px] text-sm font-semibold text-[#0f172a] outline-none"
      />
      {kind === 'persen' && (
        <span className="flex items-center pr-4 text-sm text-[#64748b]">%</span>
      )}
    </div>
  );
}

type Props = {
  promotion: Promotion | null;
  onClose: () => void;
  onSaved: (name: string, mode: 'create' | 'edit') => void;
};

export default function DiscountFormModal({ promotion, onClose, onSaved }: Props) {
  const isEdit = !!promotion;
  const today = todayISO();

  const [name, setName] = useState(promotion?.name ?? '');
  const [description, setDescription] = useState(promotion?.description ?? '');
  const [channel, setChannel] = useState<Channel>(promotion?.channel ?? 'offline');
  const [target, setTarget] = useState<DiscountTarget>(promotion?.discountTarget ?? 'produk');
  const [allProducts, setAllProducts] = useState(promotion?.appliesToAllProducts ?? false);
  const [productIds, setProductIds] = useState<string[]>(promotion?.productIds ?? []);
  const [maxKm, setMaxKm] = useState(
    promotion?.maxDistanceKm ? String(promotion.maxDistanceKm) : ''
  );
  const [kind, setKind] = useState<DiscountKind>(promotion?.discountKind ?? 'nominal');
  const [value, setValue] = useState(promotion ? String(Math.round(promotion.discountValue)) : '');
  const [promoType, setPromoType] = useState<PromoType>(promotion?.promoType ?? 'otomatis');
  const [customer, setCustomer] = useState<TargetCustomer>(promotion?.targetCustomer ?? 'semua');
  const [minType, setMinType] = useState<MinPurchaseType>(promotion?.minPurchaseType ?? 'nominal');
  const [minValue, setMinValue] = useState(
    promotion ? String(Math.round(promotion.minPurchaseValue)) : ''
  );
  const [repeatable, setRepeatable] = useState(promotion?.isRepeatable ?? false);
  const [oneClaim, setOneClaim] = useState(promotion?.maxOneClaimPerCustomer ?? false);
  const [takeAway, setTakeAway] = useState(promotion?.appliesToTakeAway ?? true);
  const [startDate, setStartDate] = useState(promotion?.startDate ?? today);
  const [endDate, setEndDate] = useState(promotion?.endDate ?? '');
  const [days, setDays] = useState<number[]>(promotion?.validDays ?? []);
  const [startTime, setStartTime] = useState(promotion?.validStartTime?.slice(0, 5) ?? '');
  const [endTime, setEndTime] = useState(promotion?.validEndTime?.slice(0, 5) ?? '');

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    fetchProductOptions()
      .then(setProducts)
      .catch((err) => setErrors({ form: err?.message ?? 'Gagal memuat produk.' }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  // Offline selalu potong harga produk
  const effectiveTarget: DiscountTarget = channel === 'offline' ? 'produk' : target;

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  function toggleProduct(id: string) {
    setProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function handleSave() {
    const valueNum = Number(value) || 0;
    const next: Record<string, string | undefined> = {};
    if (!name.trim()) next.name = 'Nama diskon wajib diisi.';
    if (effectiveTarget === 'produk' && !allProducts && productIds.length === 0)
      next.products = 'Pilih produk, atau centang Semua Produk.';
    if (kind === 'nominal' && valueNum <= 0) next.value = 'Nilai potongan wajib diisi.';
    if (kind === 'persen' && (valueNum <= 0 || valueNum > 100))
      next.value = 'Persentase antara 1 dan 100.';
    if (maxKm && !(Number(maxKm) > 0)) next.maxKm = 'Jarak maksimal harus lebih dari 0.';
    if (!(Number(minValue) > 0)) next.minValue = 'Minimal pembelian wajib diisi.';
    if (!startDate || !endDate) next.period = 'Isi tanggal mulai dan selesai.';
    else if (endDate < startDate)
      next.period = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
    if (!!startTime !== !!endTime)
      next.hours = 'Isi jam mulai dan selesai, atau kosongkan keduanya.';
    else if (startTime && endTime <= startTime) next.hours = 'Jam selesai harus setelah jam mulai.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: PromotionInput = {
      name: name.trim(),
      description: description.trim() || null,
      channel,
      discountTarget: effectiveTarget,
      discountKind: kind,
      discountValue: valueNum,
      maxDistanceKm: effectiveTarget === 'ongkir' && maxKm ? Number(maxKm) : null,
      appliesToAllProducts: effectiveTarget === 'ongkir' || allProducts,
      productIds: effectiveTarget === 'ongkir' || allProducts ? [] : productIds,
      promoType,
      targetCustomer: customer,
      minPurchaseType: minType,
      minPurchaseValue: Number(minValue),
      isRepeatable: repeatable,
      maxOneClaimPerCustomer: channel === 'online' && oneClaim,
      appliesToTakeAway: channel === 'offline' && takeAway,
      startDate,
      endDate,
      validDays: days.length === 7 ? [] : days,
      validStartTime: startTime || null,
      validEndTime: endTime || null,
    };

    setSaving(true);
    try {
      await savePromotion(input, promotion?.id ?? null);
      onSaved(input.name, isEdit ? 'edit' : 'create');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Gagal menyimpan diskon.' });
    } finally {
      setSaving(false);
    }
  }

  const choiceClass = (active: boolean) =>
    `rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
      active
        ? 'border-[#0f172a] bg-[#0f172a] text-white'
        : 'border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc]'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              {isEdit ? 'Ubah Diskon' : 'Tambah Diskon'}
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Kalau beberapa diskon memenuhi syarat di satu transaksi, hanya yang potongannya
              terbesar yang dipakai.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {/* ---------- Bagian 1 ---------- */}
          <Section title="Jenis & Cakupan">
            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Nama Diskon</FieldLabel>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Jumat Berkah"
                className={inputClass(!!errors.name)}
              />
              <FieldError message={errors.name} />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>Deskripsi</FieldLabel>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Potongan khusus pelanggan setiap Jumat siang"
                className={`${inputClass()} resize-none font-normal`}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Channel</FieldLabel>
              <Segmented
                value={channel}
                onChange={setChannel}
                options={[
                  { value: 'offline', label: 'Offline' },
                  { value: 'online', label: 'Online' },
                ]}
              />
            </div>

            {channel === 'online' && (
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Sasaran Diskon</FieldLabel>
                <Segmented
                  value={target}
                  onChange={setTarget}
                  options={[
                    { value: 'produk', label: 'Harga Produk' },
                    { value: 'ongkir', label: 'Ongkir' },
                  ]}
                />
              </div>
            )}

            {effectiveTarget === 'produk' ? (
              <div className="flex flex-col gap-2">
                <FieldLabel required>Cakupan Produk</FieldLabel>
                <Check checked={allProducts} onChange={setAllProducts} label="Semua Produk" />
                {!allProducts && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Cari produk..."
                          className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#94a3b8]"
                        />
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-[#0f172a]">
                        {productIds.length} dipilih
                      </span>
                    </div>
                    <div
                      className={`max-h-56 overflow-y-auto rounded-lg border ${errors.products ? 'border-[#f43f5e]' : 'border-[#e2e8f0]'}`}
                    >
                      {filteredProducts.map((p) => (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-2.5 border-t border-[#f1f5f9] px-3 py-2 text-xs text-[#0f172a] first:border-t-0 hover:bg-[#f8fafc]"
                        >
                          <input
                            type="checkbox"
                            checked={productIds.includes(p.id)}
                            onChange={() => toggleProduct(p.id)}
                            className="size-3.5 accent-[#0f172a]"
                          />
                          {p.name} —{' '}
                          {p.sellingPrice > 0 ? formatRupiah(p.sellingPrice) : 'harga belum diatur'}
                          {!p.isActive && (
                            <span className="text-[10px] text-[#94a3b8]">(nonaktif)</span>
                          )}
                        </label>
                      ))}
                      {filteredProducts.length === 0 && (
                        <p className="py-6 text-center text-xs text-[#94a3b8]">
                          Produk tidak ditemukan.
                        </p>
                      )}
                    </div>
                  </>
                )}
                <FieldError message={errors.products} />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Jarak Maksimal</FieldLabel>
                <div className="flex w-48 items-center rounded-xl border border-[#cbd5e1] bg-white pr-4">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={maxKm}
                    onChange={(e) => setMaxKm(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
                    placeholder="Kosong = semua"
                    className="w-full bg-transparent px-[17px] py-[13px] text-sm font-semibold text-[#0f172a] outline-none placeholder:font-medium placeholder:text-[#94a3b8]"
                  />
                  <span className="text-sm text-[#64748b]">km</span>
                </div>
                <FieldError message={errors.maxKm} />
                <p className="text-[11px] text-[#94a3b8]">
                  Kosongkan untuk berlaku di semua jarak pengantaran. Isi 100% untuk gratis ongkir.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Nilai Potongan</FieldLabel>
              <div className="w-80">
                <ValueInput
                  kind={kind}
                  value={value}
                  onKindChange={(k) => {
                    setKind(k);
                    setValue('');
                  }}
                  onValueChange={setValue}
                  hasError={!!errors.value}
                />
              </div>
              <FieldError message={errors.value} />
            </div>
          </Section>

          {/* ---------- Bagian 2 ---------- */}
          <Section title="Aturan Penerapan">
            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Tipe</FieldLabel>
              <Segmented
                value={promoType}
                onChange={setPromoType}
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'otomatis', label: 'Otomatis' },
                ]}
              />
              <p className="text-[11px] text-[#475569]">{typeMeaning(promoType, channel)}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Target Pelanggan</FieldLabel>
              <Segmented
                value={customer}
                onChange={setCustomer}
                options={[
                  { value: 'semua', label: 'Semua' },
                  { value: 'member', label: 'Member' },
                ]}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Minimal Pembelian</FieldLabel>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMinType('nominal')}
                    className={choiceClass(minType === 'nominal')}
                  >
                    Nominal (Rp)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMinType('qty')}
                    className={choiceClass(minType === 'qty')}
                  >
                    Jumlah Produk
                  </button>
                </div>
                <div className="w-56">
                  {minType === 'nominal' ? (
                    <RupiahInput
                      value={minValue}
                      onChange={setMinValue}
                      hasError={!!errors.minValue}
                      placeholder="50.000"
                    />
                  ) : (
                    <div
                      className={`flex items-center rounded-xl border bg-white pr-4 ${errors.minValue ? 'border-[#f43f5e]' : 'border-[#cbd5e1]'}`}
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        value={minValue}
                        onChange={(e) => setMinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="2"
                        className="w-full bg-transparent px-[17px] py-[13px] text-sm font-semibold text-[#0f172a] outline-none"
                      />
                      <span className="text-sm text-[#64748b]">produk</span>
                    </div>
                  )}
                </div>
              </div>
              <FieldError message={errors.minValue} />
            </div>

            <div className="flex flex-col gap-2">
              <Check checked={repeatable} onChange={setRepeatable} label="Berlaku Kelipatan" />
              {channel === 'online' && (
                <Check
                  checked={oneClaim}
                  onChange={setOneClaim}
                  label="Maksimal 1× Klaim per Pelanggan"
                />
              )}
              {channel === 'offline' && (
                <Check
                  checked={takeAway}
                  onChange={setTakeAway}
                  label="Berlaku juga untuk Take Away"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-[#f1f5f9] pt-4">
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Tanggal Mulai</FieldLabel>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass(!!errors.period)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Tanggal Selesai</FieldLabel>
                <input
                  type="date"
                  value={endDate}
                  min={startDate > today ? startDate : today}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass(!!errors.period)}
                />
              </div>
            </div>
            <FieldError message={errors.period} />

            <div className="flex flex-col gap-1.5">
              <FieldLabel
                aside={
                  <span className="text-[11px] font-normal normal-case text-[#94a3b8]">
                    opsional · kosong = setiap hari
                  </span>
                }
              >
                Hari Berlaku
              </FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {DAY_ORDER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={choiceClass(days.includes(d))}
                  >
                    {DAY_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Jam Mulai</FieldLabel>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputClass(!!errors.hours)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Jam Selesai</FieldLabel>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputClass(!!errors.hours)}
                />
              </div>
            </div>
            <FieldError message={errors.hours} />
            <p className="flex items-center gap-2 text-[11px] text-[#94a3b8]">
              <Info className="size-3.5 shrink-0" />
              {channel === 'online' && promoType === 'manual'
                ? 'Voucher berlaku sampai tanggal selesai, kapan pun diklaim. '
                : ''}
              Setelah tanggal selesai lewat, diskon otomatis Kedaluwarsa dan terkunci.
            </p>
          </Section>

          {errors.form && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {errors.form}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e2e8f0] bg-[#f1f5f9] px-6 pb-3.5 pt-[15px]">
          <button
            onClick={onClose}
            className="rounded border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Diskon'}
          </button>
        </div>
      </div>
    </div>
  );
}
