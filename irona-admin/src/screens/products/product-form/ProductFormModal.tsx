import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Info, X } from 'lucide-react';
import { fetchCategories } from '../../../services/categories';
import {
  fetchProductDetail,
  fetchRecipeSources,
  isProductNameTaken,
  saveProduct,
  suggestSku,
  uploadProductPhoto,
} from '../../../services/products';
import type { Category } from '../../../types/category';
import type { ProductDetail, RecipeMethod, RecipeRow, RecipeSource } from '../../../types/product';
import { InfoStep, type InfoErrors, type InfoValues } from './InfoStep';
import { RecipeStep, newRecipeRow } from './RecipeStep';
import { PricingStep } from './PricingStep';
import { ModalShell } from '../../../components/ModalShell';

type Step = 1 | 2 | 3;

const STEP_META = [
  { title: 'Info Produk', sub: 'Deskripsi produk' },
  { title: 'Resep & Bahan', sub: 'Takaran modal' },
  { title: 'Penetapan Harga', sub: 'Margin jual' },
];

const EMPTY_INFO: InfoValues = {
  name: '',
  description: '',
  photoFile: null,
  photoPreview: null,
  photoUrl: null,
  categoryId: '',
  availableOffline: true,
  availableOnline: false,
  unit: '',
  sku: '',
  skuTouched: false,
};

const METHOD_BY_STATUS: Record<ProductDetail['recipeStatus'], RecipeMethod> = {
  lengkap: 'isi_sekarang',
  belum_lengkap: 'isi_nanti',
  tanpa_resep: 'tanpa_resep',
};

type Props = {
  productId?: string | null; // diisi = mode Ubah Data
  onClose: () => void;
  onSaved: (productName: string, mode: 'create' | 'edit') => void;
};

export default function ProductFormModal({ productId = null, onClose, onSaved }: Props) {
  const isEdit = !!productId;
  const [step, setStep] = useState<Step>(1);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<RecipeSource[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [original, setOriginal] = useState<ProductDetail | null>(null);

  const [info, setInfo] = useState<InfoValues>(EMPTY_INFO);
  const [infoErrors, setInfoErrors] = useState<InfoErrors>({});

  const [method, setMethod] = useState<RecipeMethod | null>(null); // dipilih user di step 2
  const [rows, setRows] = useState<RecipeRow[]>([newRecipeRow()]);
  const [addCostPct, setAddCostPct] = useState<number | null>(10);
  const [manualTotalCost, setManualTotalCost] = useState('');
  const [recipeError, setRecipeError] = useState<string | null>(null);

  const [desiredPct, setDesiredPct] = useState<number | null>(null);
  const [sellingPrice, setSellingPrice] = useState('');
  const [pricingErrors, setPricingErrors] = useState<{ desiredPct?: string; sellingPrice?: string }>({});

  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Untuk mendeteksi apakah form sudah diubah (konfirmasi saat menutup)
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const [captureSnapshot, setCaptureSnapshot] = useState(false);

  // Data awal: kategori, bahan resep, dan data produk kalau mode ubah
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, srcs] = await Promise.all([fetchCategories(), fetchRecipeSources()]);
        if (cancelled) return;
        setCategories(cats);
        setSources(srcs);

        if (productId) {
          const detail = await fetchProductDetail(productId);
          if (cancelled) return;
          if (!detail) {
            setInitError('Produk tidak ditemukan atau sudah dihapus.');
            return;
          }
          setOriginal(detail);
          setInfo({
            name: detail.name,
            description: detail.description ?? '',
            photoFile: null,
            photoPreview: null,
            photoUrl: detail.photoUrl,
            categoryId: detail.categoryId,
            availableOffline: detail.availableOffline,
            availableOnline: detail.availableOnline,
            unit: detail.unit,
            sku: detail.sku ?? '',
            skuTouched: !!detail.sku, // SKU lama dipertahankan; produk lama tanpa SKU dibuatkan otomatis
          });
          setMethod(METHOD_BY_STATUS[detail.recipeStatus]);
          setRows(
            detail.recipe.length > 0
              ? detail.recipe.map((r) => ({
                  rowId: crypto.randomUUID(),
                  sourceKey: `${r.type}:${r.id}`,
                  quantity: String(r.quantity),
                }))
              : [newRecipeRow()]
          );
          setAddCostPct(detail.addCostPercentage);
          setManualTotalCost(detail.baseCost !== null ? String(Math.round(detail.baseCost)) : '');
          setDesiredPct(detail.desiredCostPercentage ?? null);
          setSellingPrice(detail.sellingPrice !== null ? String(Math.round(detail.sellingPrice)) : '');
        }
        setCaptureSnapshot(true);
      } catch (err: any) {
        if (!cancelled) setInitError(err?.message ?? 'Gagal memuat data form.');
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Setiap pindah step, tampilkan dari atas
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // SKU otomatis mengikuti kategori, selama belum diketik manual
  useEffect(() => {
    if (info.skuTouched || !info.categoryId) return;
    const category = categories.find((c) => c.id === info.categoryId);
    if (!category) return;
    let cancelled = false;
    suggestSku(category.name)
      .then((sku) => !cancelled && setInfo((prev) => (prev.skuTouched ? prev : { ...prev, sku })))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [info.categoryId, info.skuTouched, categories]);

  // Bersihkan URL pratinjau foto saat pop up ditutup
  useEffect(() => {
    return () => {
      if (info.photoPreview) URL.revokeObjectURL(info.photoPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.key, s])), [sources]);
  const validRows = rows.filter((r) => r.sourceKey && Number(r.quantity) > 0);
  const recipeCost = validRows.reduce(
    (sum, r) => sum + Number(r.quantity) * (sourceMap.get(r.sourceKey)?.unitPrice ?? 0),
    0
  );
  // Cost sebelum Add Cost: dari resep, atau diisi manual untuk produk tanpa resep
  const cost = method === 'tanpa_resep' ? Number(manualTotalCost) || 0 : method === 'isi_sekarang' ? recipeCost : 0;
  const totalCost = cost * (1 + (addCostPct ?? 0) / 100);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        info: { ...info, photoFile: info.photoFile?.name ?? null, photoPreview: null },
        method,
        rows: rows.map((r) => [r.sourceKey, r.quantity]),
        addCostPct,
        manualTotalCost,
        desiredPct,
        sellingPrice,
      }),
    [info, method, rows, addCostPct, manualTotalCost, desiredPct, sellingPrice]
  );

  useEffect(() => {
    if (!captureSnapshot) return;
    setInitialSnapshot(snapshot);
    setCaptureSnapshot(false);
  }, [captureSnapshot, snapshot]);

  const isDirty = initialSnapshot !== null && snapshot !== initialSnapshot;

  function requestClose() {
    if (saving) return;
    if (isDirty && !window.confirm('Tutup form? Perubahan yang belum disimpan akan hilang.')) return;
    onClose();
  }

  // Tutup dengan Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function validateInfo(): Promise<InfoErrors> {
    const errs: InfoErrors = {};
    const name = info.name.trim();
    if (!name) errs.name = 'Nama produk wajib diisi.';
    else if (await isProductNameTaken(name, productId ?? undefined)) errs.name = `Nama produk "${name}" sudah dipakai.`;
    if (!info.categoryId) errs.categoryId = 'Pilih kategori produk.';
    if (!info.unit) errs.unit = 'Pilih satuan produk.';
    if (!info.sku.trim()) errs.sku = 'SKU wajib diisi.';
    if (!info.availableOffline && !info.availableOnline) errs.channels = 'Pilih minimal satu saluran penjualan.';
    return errs;
  }

  function validateRecipe(): string | null {
    if (!method) return 'Pilih metode manajemen resep terlebih dahulu.';
    if (method === 'isi_sekarang') {
      if (rows.some((r) => r.sourceKey && !(Number(r.quantity) > 0))) {
        return 'Takaran setiap bahan harus lebih dari 0.';
      }
      if (validRows.length === 0) return 'Tambahkan minimal satu bahan dengan takarannya.';
    }
    if (method === 'tanpa_resep' && !(Number(manualTotalCost) > 0)) {
      return 'Cost wajib diisi untuk produk tanpa resep.';
    }
    if (method !== 'isi_nanti' && (addCostPct === null || addCostPct < 0)) return 'Pilih persentase Add Cost.';
    return null;
  }

  function validatePricing() {
    const errs: { desiredPct?: string; sellingPrice?: string } = {};
    if (!desiredPct || desiredPct <= 0) errs.desiredPct = 'Pilih persentase desired cost.';
    if (!(Number(sellingPrice) > 0)) errs.sellingPrice = 'Harga jual wajib diisi.';
    return errs;
  }

  async function handleNext() {
    setFormError(null);

    if (step === 1) {
      setChecking(true);
      try {
        const errs = await validateInfo();
        setInfoErrors(errs);
        if (Object.keys(errs).length === 0) setStep(2);
      } catch (err: any) {
        setFormError(err?.message ?? 'Gagal memeriksa data produk.');
      } finally {
        setChecking(false);
      }
      return;
    }

    if (step === 2) {
      const err = validateRecipe();
      setRecipeError(err);
      if (err) return;

      if (method === 'isi_nanti') {
        await handleSave();
        return;
      }

      setStep(3);
      return;
    }

    const errs = validatePricing();
    setPricingErrors(errs);
    if (Object.keys(errs).length === 0) await handleSave();
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      const photoUrl = info.photoFile ? await uploadProductPhoto(info.photoFile) : info.photoUrl;
      const recipeStatus =
        method === 'isi_sekarang' ? 'lengkap' : method === 'isi_nanti' ? 'belum_lengkap' : 'tanpa_resep';

      // Status aktif lama dipertahankan; produk yang tadinya belum lengkap (resep "Isi Nanti" / harga
      // jual kosong) otomatis aktif setelah dilengkapi
      const isActive = original
        ? (original.recipeStatus === 'belum_lengkap' || !(Number(original.sellingPrice) > 0)) &&
          recipeStatus !== 'belum_lengkap'
          ? true
          : original.isActive
        : true;

      await saveProduct(
        {
          name: info.name.trim(),
          description: info.description.trim() || null,
          photoUrl,
          categoryId: info.categoryId,
          unit: info.unit,
          sku: info.sku.trim(),
          availableOffline: info.availableOffline,
          availableOnline: info.availableOnline,
          recipeStatus,
          isActive,
          baseCost: method === 'tanpa_resep' ? Number(manualTotalCost) : null,
          addCostPercentage: method === 'isi_nanti' ? 0 : addCostPct ?? 0,
          desiredCostPercentage: method === 'isi_nanti' ? null : desiredPct,
          sellingPrice: method === 'isi_nanti' ? null : Number(sellingPrice),
          recipe:
            method === 'isi_sekarang'
              ? validRows.map((r) => {
                  const source = sourceMap.get(r.sourceKey)!;
                  return {
                    type: source.type,
                    rawMaterialId: source.type === 'bahan_baku' ? source.id : null,
                    racikanId: source.type === 'racikan' ? source.id : null,
                    quantity: Number(r.quantity),
                    unitId: source.unitId,
                  };
                })
              : [],
        },
        productId
      );

      onSaved(info.name.trim(), isEdit ? 'edit' : 'create');
    } catch (err: any) {
      if (err?.code === '23505') {
        const message = String(err?.message ?? '');
        setInfoErrors(
          message.includes('sku') ? { sku: 'SKU sudah dipakai produk lain.' } : { name: 'Nama produk sudah dipakai.' }
        );
        setStep(1);
      } else {
        setFormError(err?.message ?? 'Gagal menyimpan produk.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCategoryCreated(id: string) {
    setCategories(await fetchCategories());
    setInfo((prev) => ({ ...prev, categoryId: id }));
    setInfoErrors((prev) => ({ ...prev, categoryId: undefined }));
  }

  const header: Record<Step, { title: string; sub: string }> = {
    1: {
      title: isEdit ? 'Ubah Produk' : 'Tambah Produk Baru',
      sub: 'Informasi dasar dan atribut produk',
    },
    2: { title: 'Formula & Resep Produk', sub: 'Hubungkan bahan baku untuk potong stok otomatis' },
    3: { title: 'Penetapan Harga Jual', sub: 'Verifikasi margin laba kotor & finalisasi harga' },
  };

  const nextLabel =
    step === 1
      ? 'Lanjut ke Resep'
      : step === 2 && method !== 'isi_nanti'
        ? 'Lanjut ke Harga'
        : isEdit
          ? 'Simpan Perubahan'
          : 'Simpan Produk';
  const isFinalAction = nextLabel.startsWith('Simpan');
  const busy = checking || saving;

  return (
    <ModalShell open onBackdropClick={undefined} panelClassName="max-w-3xl">
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        {/* Header + stepper */}
        <div className="shrink-0 border-b border-[#f1f5f9] px-8 pb-[25px] pt-7">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <h2 id="product-form-title" className="text-2xl font-bold leading-8 tracking-[-0.6px] text-[#0f172a]">
                {header[step].title}
              </h2>
              <p className="text-sm leading-5 text-[#64748b]">{header[step].sub}</p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Tutup"
              className="rounded-lg p-2 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-6 flex items-center border-t border-[#f1f5f9] pt-[21px]">
            {STEP_META.map((meta, idx) => {
              const number = (idx + 1) as Step;
              const done = number < step;
              const active = number === step;
              const skipped = number === 3 && method === 'isi_nanti';
              return (
                <div key={meta.title} className="flex flex-1 items-center last:flex-none">
                  <div className={`flex items-center gap-3 ${!active && !done ? 'opacity-60' : ''}`}>
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        active
                          ? 'bg-[#0f172a] text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]'
                          : done
                            ? 'bg-[#94a3b8] text-white'
                            : 'border border-[#cbd5e1] bg-[#f8fafc] text-[#475569]'
                      }`}
                    >
                      {done ? <Check className="size-4" /> : number}
                    </span>
                    <span className="flex flex-col">
                      <span
                        className={`whitespace-nowrap text-sm leading-[17.5px] ${
                          active ? 'font-semibold text-[#0f172a]' : 'font-medium text-[#1e293b]'
                        }`}
                      >
                        {meta.title}
                      </span>
                      <span className="whitespace-nowrap text-xs leading-4 text-[#64748b]">
                        {done ? 'Selesai' : skipped ? 'Dilewati (Isi Nanti)' : meta.sub}
                      </span>
                    </span>
                  </div>
                  {idx < STEP_META.length - 1 && <div className="mx-4 h-px flex-1 bg-[#e2e8f0]" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-8">
          {initLoading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat data...</p>
          ) : initError ? (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">{initError}</p>
          ) : step === 1 ? (
            <InfoStep
              values={info}
              onChange={(patch) => setInfo((prev) => ({ ...prev, ...patch }))}
              errors={infoErrors}
              categories={categories}
              onCategoryCreated={handleCategoryCreated}
              onResetSku={() => setInfo((prev) => ({ ...prev, skuTouched: false }))}
            />
          ) : step === 2 ? (
            <RecipeStep
              method={method}
              onMethodChange={(m) => {
                setMethod(m);
                setRecipeError(null);
              }}
              rows={rows}
              onRowsChange={setRows}
              sources={sources}
              addCostPct={addCostPct}
              onAddCostPctChange={setAddCostPct}
              manualTotalCost={manualTotalCost}
              onManualTotalCostChange={setManualTotalCost}
              cost={cost}
              totalCost={totalCost}
              error={recipeError}
            />
          ) : (
            <PricingStep
              totalCost={totalCost}
              desiredPct={desiredPct}
              onDesiredPctChange={setDesiredPct}
              sellingPrice={sellingPrice}
              onSellingPriceChange={setSellingPrice}
              errors={pricingErrors}
            />
          )}

          {formError && (
            <p className="mt-6 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {formError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-[rgba(226,232,240,0.8)] bg-[rgba(248,250,252,0.8)] px-8 pb-5 pt-[21px]">
          {step === 1 ? (
            <p className="flex items-center gap-2 text-xs leading-4 text-[#64748b]">
              <Info className="size-4" />
              Pastikan nama dan kategori terisi dengan benar sebelum melanjutkan.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl border border-[#cbd5e1] bg-white px-5 py-[11px] text-sm font-semibold text-[#334155] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#f8fafc] disabled:opacity-60"
            >
              <ArrowLeft className="size-4" />
              Kembali
            </button>
          )}

          <div className="flex items-center gap-3">
            {step === 1 && (
              <button
                type="button"
                onClick={requestClose}
                className="rounded-xl border border-[#cbd5e1] bg-white px-[21px] py-[11px] text-sm font-semibold text-[#334155] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#f8fafc]"
              >
                Batal
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={busy || initLoading || !!initError}
              className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-6 py-2.5 text-sm font-semibold text-white drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : checking ? 'Memeriksa...' : nextLabel}
              {!busy && (isFinalAction ? <Check className="size-4" /> : <ArrowRight className="size-4" />)}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalShell>
  );
  
}