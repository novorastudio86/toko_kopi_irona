import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Info, Plus } from 'lucide-react';
import { CATEGORY_ICONS } from '../../constants/categoryIcons';
import {
  createCategory,
  fetchCategories,
  fetchCategoryById,
  fetchNextDisplayOrder,
  updateCategory,
} from '../../services/categories';
import type { Category } from '../../types/category';
import icBack from '../../assets/ui/arrow-left.svg';
import icCheck from '../../assets/ui/check.svg';
import icSave from '../../assets/ui/save.svg';

const LIST_PATH = '/product/category';
const ONLINE_NAME_MAX = 24;

type OnlineMode = 'existing' | 'new';

/** Label tab online sebuah kategori: nama online kalau ada, kalau tidak nama kategori */
function onlineLabelOf(c: Pick<Category, 'name' | 'onlineName'>): string {
  return (c.onlineName ?? c.name).trim();
}

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function FieldLabel({
  children,
  required,
  optional,
}: {
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <p className="text-xs font-bold uppercase leading-4 tracking-[0.6px] text-[#334155]">
      {children}
      {required && <span className="text-[#f43f5e]"> *</span>}
      {optional && <span className="font-normal lowercase text-[#94a3b8]"> (opsional)</span>}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs leading-4 text-[#f43f5e]">{message}</p>;
}

function ChannelOption({
  checked,
  onToggle,
  title,
  description,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex flex-1 items-start rounded-xl bg-white text-left drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] transition-colors ${
        checked ? 'border-2 border-[#0f172a] p-4' : 'border border-[#e2e8f0] p-[17px] hover:border-[#cbd5e1]'
      }`}
    >
      <span
        className={`mt-px flex size-[18px] shrink-0 items-center justify-center rounded ${
          checked ? 'bg-[#0f172a]' : 'border border-[#cbd5e1] bg-white'
        }`}
      >
        {checked && <img src={icCheck} alt="" className="size-4" />}
      </span>
      <span className="flex flex-col gap-px pl-3">
        <span className="text-xs font-bold leading-4 text-[#0f172a]">{title}</span>
        <span className="text-[11px] leading-[16.5px] text-[#64748b]">{description}</span>
      </span>
    </button>
  );
}

/** Kotak bagian per kanal (POS / Online) */
function ChannelSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[rgba(226,232,240,0.8)] bg-[rgba(248,250,252,0.7)] p-[17px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#0f172a]" />
          <span className="text-xs font-bold uppercase leading-4 tracking-[0.3px] text-[#1e293b]">
            {title}
          </span>
        </div>
        <span className="text-[11px] leading-[16.5px] text-[#94a3b8]">{hint}</span>
      </div>
      {children}
    </div>
  );
}

type PreviewTab = {
  key: string;
  label: string;
  order: number;
  active: boolean;
  isNew: boolean;
};

/** Deretan tab kategori gaya Web Customer — tab yang sudah ada bisa diklik untuk dipilih */
function OnlineTabBar({
  tabs,
  onSelect,
  onAddNew,
  showAddNew,
}: {
  tabs: PreviewTab[];
  onSelect: (label: string) => void;
  onAddNew: () => void;
  showAddNew: boolean;
}) {
  const tabClass = (active: boolean) =>
    `inline-flex h-[33px] min-w-[84px] items-center justify-center whitespace-nowrap border border-[#a9a3a1] px-2.5 font-['Bitcheese',cursive] text-[11px] leading-none transition-colors ${
      active ? 'bg-[#2e2c2c] text-white' : 'bg-[#f4f2ed] text-[#2e2c2c] hover:bg-[#e8e4dc]'
    }`;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex w-max items-center">
        {tabs.map((tab) =>
          tab.isNew ? (
            <span key={tab.key} className={tabClass(true)}>
              {tab.label}
            </span>
          ) : (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelect(tab.label)}
              aria-pressed={tab.active}
              className={tabClass(tab.active)}
            >
              {tab.label}
            </button>
          )
        )}
        {showAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            className="ml-3 inline-flex h-[33px] items-center gap-1 rounded-md border border-dashed border-[#a9a3a1] px-3 text-[11px] font-semibold text-[#2e2c2c] hover:bg-[#f4f2ed]"
          >
            <Plus className="size-3.5" />
            Tab Baru
          </button>
        )}
      </div>
    </div>
  );
}

type Errors = { name?: string; onlineName?: string; displayOrder?: string; form?: string };

export default function CategoryFormScreen() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [onlineMode, setOnlineMode] = useState<OnlineMode>('new');
  const [selectedTab, setSelectedTab] = useState(''); // dipakai saat mode 'existing'
  const [onlineName, setOnlineName] = useState(''); // dipakai saat mode 'new'
  const [icon, setIcon] = useState<string | null>(null);
  const [displayOrder, setDisplayOrder] = useState('');
  const [showInMenu, setShowInMenu] = useState(true);
  const [showOnline, setShowOnline] = useState(true);

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const categories = await fetchCategories();
        if (cancelled) return;
        setAllCategories(categories);

        if (isEdit) {
          const cat = await fetchCategoryById(id!);
          if (cancelled) return;
          if (!cat) {
            setNotFound(true);
            return;
          }
          setName(cat.name);
          setIcon(cat.icon);
          setDisplayOrder(String(cat.displayOrder));
          setShowInMenu(cat.showInMenu);
          setShowOnline(cat.showOnline);

          // Apakah kategori ini bergabung ke tab milik kategori lain?
          const label = onlineLabelOf(cat);
          const joinsOther = categories.some(
            (c) => c.id !== cat.id && c.showOnline && sameLabel(onlineLabelOf(c), label)
          );
          if (joinsOther) {
            setOnlineMode('existing');
            setSelectedTab(label);
          } else {
            setOnlineMode('new');
            setOnlineName(cat.onlineName ?? '');
          }
        } else {
          const next = await fetchNextDisplayOrder();
          if (!cancelled) setDisplayOrder(String(next));
        }
      } catch (err: any) {
        if (!cancelled) setErrors({ form: err?.message ?? 'Gagal memuat data kategori.' });
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  // Tab online yang sudah ada (kategori lain), digabung per label, posisi = urutan terkecil di grup
  const existingTabs = useMemo(() => {
    const map = new Map<string, { label: string; order: number }>();
    allCategories
      .filter((c) => c.showOnline && c.id !== id)
      .forEach((c) => {
        const label = onlineLabelOf(c);
        const key = label.toLowerCase();
        const current = map.get(key);
        if (!current || c.displayOrder < current.order) map.set(key, { label, order: c.displayOrder });
      });
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [allCategories, id]);

  // Label tab baru (mode 'new'): nama online yang diketik, atau Nama Kategori
  const newTabLabel = onlineName.trim() || name.trim() || 'Tab Baru';

  const previewTabs = useMemo<PreviewTab[]>(() => {
    const tabs: PreviewTab[] = existingTabs.map((t) => ({
      key: t.label,
      label: t.label,
      order: t.order,
      active: onlineMode === 'existing' && sameLabel(t.label, selectedTab),
      isNew: false,
    }));

    if (onlineMode === 'new') {
      const orderNumber = Number(displayOrder);
      tabs.push({
        key: '__new',
        label: newTabLabel,
        order: Number.isFinite(orderNumber) && orderNumber > 0 ? orderNumber : Number.MAX_SAFE_INTEGER,
        active: true,
        isNew: true,
      });
    }

    return tabs.sort((a, b) => a.order - b.order || (a.isNew ? 1 : -1));
  }, [existingTabs, onlineMode, selectedTab, displayOrder, newTabLabel]);

  function selectExistingTab(label: string) {
    setOnlineMode('existing');
    setSelectedTab(label);
    setErrors((prev) => ({ ...prev, onlineName: undefined }));
  }

  function startNewTab() {
    setOnlineMode('new');
    setSelectedTab('');
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Nama kategori wajib diisi.';

    if (showOnline && onlineMode === 'new') {
      const duplicate = existingTabs.find((t) => sameLabel(t.label, newTabLabel));
      if (duplicate) {
        next.onlineName = `Tab "${duplicate.label}" sudah ada. Klik tab tersebut di pratinjau untuk menggabungkan kategori ini.`;
      }
    }

    const order = Number(displayOrder);
    if (!displayOrder.trim() || !Number.isInteger(order) || order <= 0) {
      next.displayOrder = 'Urutan tampil harus berupa angka bulat lebih dari 0.';
    }
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const input = {
      name: name.trim(),
      onlineName: onlineMode === 'existing' ? selectedTab : onlineName.trim() || null,
      icon,
      displayOrder: Number(displayOrder),
      showInMenu,
      showOnline,
    };

    setSaving(true);
    try {
      if (isEdit) await updateCategory(id!, input);
      else await createCategory(input);

      navigate(LIST_PATH, {
        state: {
          flash: `Kategori "${input.name}" berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`,
        },
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        setErrors({
          displayOrder: `Urutan ${input.displayOrder} sudah dipakai kategori lain. Gunakan angka lain.`,
        });
      } else {
        setErrors({ form: err?.message ?? 'Gagal menyimpan kategori.' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col">
      {/* Top bar */}
      <div className="border-b border-[#e2e8f0] bg-white px-8 pb-[17px] pt-4">
        <div className="flex items-center pt-1">
          <button
            type="button"
            onClick={() => navigate(LIST_PATH)}
            className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]"
            aria-label="Kembali ke Daftar Kategori"
          >
            <img src={icBack} alt="" className="size-4" />
          </button>
          <h2 className="pl-3 text-xl font-bold leading-7 tracking-[-0.5px] text-[#0f172a]">
            {isEdit ? 'Ubah Kategori' : 'Tambah Kategori Baru'}
          </h2>
        </div>
      </div>

      <div className="p-8">
        <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          {/* Card header */}
          <div className="border-b border-[#f1f5f9] bg-gradient-to-r from-[rgba(248,250,252,0.7)] to-white px-7 pb-[29px] pt-7">
            <h3 className="text-base font-bold leading-6 text-[#0f172a]">Detail &amp; Konfigurasi Kategori</h3>
          </div>

          {initialLoading ? (
            <p className="p-7 text-xs text-[#94a3b8]">Memuat data...</p>
          ) : notFound ? (
            <p className="p-7 text-xs text-[#f43f5e]">Kategori tidak ditemukan atau sudah dihapus.</p>
          ) : (
            <div className="flex flex-col gap-7 p-7">
              {/* 1. Kanal Visibilitas */}
              <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(226,232,240,0.8)] bg-[rgba(248,250,252,0.7)] p-[21px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-2 pb-0.5 pt-[5px]">
                    <span className="rounded bg-[#0f172a] px-2 text-[11px] font-extrabold uppercase leading-[16.5px] tracking-[0.55px] text-white">
                      Langkah 1
                    </span>
                    <span className="text-xs font-bold uppercase leading-4 tracking-[0.6px] text-[#1e293b]">
                      Kanal Visibilitas
                    </span>
                  </div>
                  <span className="text-[11px] leading-[16.5px] text-[#94a3b8]">
                    Pilih di mana kategori ini akan dipublikasikan
                  </span>
                </div>
                <div className="flex gap-3.5 pt-1">
                  <ChannelOption
                    checked={showInMenu}
                    onToggle={() => setShowInMenu((v) => !v)}
                    title="Tampil di Menu (POS Kasir)"
                    description="Kategori aktif dan dapat dipilih di aplikasi kasir counter."
                  />
                  <ChannelOption
                    checked={showOnline}
                    onToggle={() => setShowOnline((v) => !v)}
                    title="Tampil di Online"
                    description="Kategori tampil pada website customer & online order."
                  />
                </div>
              </div>

              {/* 2. Nama Kategori */}
              <div className="flex flex-col gap-2">
                <FieldLabel required>Nama Kategori</FieldLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Signature Cold Brew"
                  className={`w-full rounded-xl border bg-white px-[17px] py-[14px] text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#94a3b8] ${
                    errors.name ? 'border-[#f43f5e]' : 'border-[#e2e8f0]'
                  }`}
                />
                <FieldError message={errors.name} />
              </div>

              {/* 3. Tampilan per kanal — muncul sesuai checkbox Langkah 1 */}
              <div className="flex flex-col gap-4 border-t border-[#f1f5f9] pt-[9px]">
                <FieldLabel>Tampilan per Kanal</FieldLabel>

                {!showInMenu && !showOnline && (
                  <p className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-3 text-xs leading-4 text-[#64748b]">
                    Kategori ini tidak akan tampil di kasir maupun web customer. Centang minimal satu kanal di
                    Langkah 1 jika ingin menampilkannya.
                  </p>
                )}

                {showInMenu && (
                  <ChannelSection
                    title="Ikon Tampil di Menu (POS Kasir)"
                    hint={`${Object.keys(CATEGORY_ICONS).length} ikon cepat POS · opsional`}
                  >
                    <div className="grid grid-cols-5 gap-3 pt-1">
                      {Object.entries(CATEGORY_ICONS).map(([key, meta]) => {
                        const selected = icon === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            title={meta.label}
                            aria-pressed={selected}
                            onClick={() => setIcon(selected ? null : key)}
                            className={`flex h-14 items-center justify-center rounded-2xl drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] transition-colors ${
                              selected
                                ? 'border-2 border-[#0f172a] bg-[#f1f5f9]'
                                : 'border border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                            }`}
                          >
                            <img src={meta.src} alt={meta.label} className="size-6" />
                          </button>
                        );
                      })}
                    </div>
                  </ChannelSection>
                )}

                {showOnline && (
                  <ChannelSection title="Tampilan di Online (Web Customer)" hint="Tab teks, tanpa ikon">
                    <div className="flex flex-col gap-2 pt-1">
                      <FieldLabel>Tab di Web Customer</FieldLabel>
                      <p className="text-[11px] leading-[16.5px] text-[#64748b]">
                        Klik tab yang sudah ada untuk menggabungkan kategori ini ke tab tersebut, atau buat tab
                        baru jika kategori ini perlu tab sendiri.
                      </p>
                      <OnlineTabBar
                        tabs={previewTabs}
                        onSelect={selectExistingTab}
                        onAddNew={startNewTab}
                        showAddNew={onlineMode === 'existing'}
                      />
                      {onlineMode === 'existing' && selectedTab && (
                        <p className="text-[11px] leading-[16.5px] text-[#64748b]">
                          Produk kategori ini akan tampil di tab{' '}
                          <span className="font-semibold text-[#0f172a]">"{selectedTab}"</span>.
                        </p>
                      )}
                    </div>

                    {onlineMode === 'new' && (
                      <div className="flex flex-col gap-2">
                        <FieldLabel optional>Nama Tab Baru</FieldLabel>
                        <input
                          type="text"
                          value={onlineName}
                          maxLength={ONLINE_NAME_MAX}
                          onChange={(e) => setOnlineName(e.target.value)}
                          placeholder={name.trim() || 'Contoh: Pop Series'}
                          className={`w-full rounded-xl border bg-white px-[17px] py-[14px] text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#94a3b8] ${
                            errors.onlineName ? 'border-[#f43f5e]' : 'border-[#e2e8f0]'
                          }`}
                        />
                        <p className="flex justify-between text-[11px] leading-[16.5px] text-[#94a3b8]">
                          <span>Kosongkan untuk memakai Nama Kategori.</span>
                          <span>
                            {onlineName.length}/{ONLINE_NAME_MAX}
                          </span>
                        </p>
                        <FieldError message={errors.onlineName} />
                      </div>
                    )}
                  </ChannelSection>
                )}
              </div>

              {/* 4. Urutan Tampil */}
              <div className="flex w-80 max-w-full flex-col gap-2 border-t border-[#f1f5f9] pt-[9px]">
                <FieldLabel required>Urutan Tampil</FieldLabel>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className={`w-full rounded-xl border bg-white px-[17px] py-[13px] text-sm font-semibold leading-5 text-[#1e293b] outline-none focus:border-[#94a3b8] ${
                    errors.displayOrder ? 'border-[#f43f5e]' : 'border-[#e2e8f0]'
                  }`}
                />
                <FieldError message={errors.displayOrder} />
              </div>

              {errors.form && (
                <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
                  {errors.form}
                </p>
              )}
            </div>
          )}

          {/* Bottom actions */}
          <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-[#f8fafc] px-7 pb-4 pt-[17px]">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-[#64748b]" />
              <p className="text-xs leading-4 text-[#64748b]">
                Semua perubahan tersinkronisasi otomatis dengan server Toko Kopi Irona.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(LIST_PATH)}
                className="rounded-xl border border-[#cbd5e1] bg-white px-[21px] py-[11px] text-xs font-semibold leading-4 text-[#334155] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#f8fafc]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || initialLoading || notFound}
                className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-6 py-2.5 text-xs font-bold leading-4 text-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <img src={icSave} alt="" className="size-4" />
                {saving ? 'Menyimpan...' : 'Simpan Kategori'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}