import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Loader2, Minus, Plus, Store, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import {
  fetchReceiptSettings,
  fetchStoreProfile,
  updateReceiptSettings,
} from '../../services/receipt';
import type { ReceiptSettings, StoreProfile } from '../../types/receipt';
import ReceiptPreview from './ReceiptPreview';
import StoreProfileModal from './StoreProfileModal';

type Tab = 'header' | 'body' | 'footer';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#0f172a]' : 'bg-[#cbd5e1]'}`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  children,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[#f1f5f9] py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#0f172a]">{label}</p>
          {hint && <p className="text-xs text-[#94a3b8]">{hint}</p>}
        </div>
        <Switch checked={checked} onChange={onChange} />
      </div>
      {checked && children}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <p className="pb-1 text-xs font-bold uppercase tracking-[0.55px] text-[#64748b]">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function ReceiptSettingsScreen() {
  const [settings, setSettings] = useState<ReceiptSettings | null>(null);
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [tab, setTab] = useState<Tab>('header');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [samplePayment, setSamplePayment] = useState<'tunai' | 'qris'>('tunai');
  const textTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    Promise.all([fetchReceiptSettings(), fetchStoreProfile()])
      .then(([r, p]) => {
        setSettings(r);
        setStore(p);
      })
      .catch((err) => setError(err?.message ?? 'Gagal memuat pengaturan struk.'));
  }, []);

  async function persist(patch: Partial<ReceiptSettings>) {
    setSaveState('saving');
    try {
      await updateReceiptSettings(patch);
      setSaveState('saved');
    } catch (err: any) {
      setSaveState('error');
      setError(err?.message ?? 'Gagal menyimpan pengaturan.');
    }
  }

  /** Toggle & pilihan: langsung tersimpan */
  function change<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    persist({ [key]: value } as Partial<ReceiptSettings>);
  }

  /** Isian teks: preview langsung berubah, simpan setelah berhenti mengetik */
  function changeText(key: 'header_text' | 'footer_note', value: string) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    clearTimeout(textTimers.current[key]);
    textTimers.current[key] = setTimeout(() => persist({ [key]: value.trim() || null }), 600);
  }

  if (!settings || !store) {
    return (
      <div className="p-8 text-center text-xs text-[#94a3b8]">
        {error ?? 'Memuat pengaturan struk...'}
      </div>
    );
  }

  const s = settings;
  const textareaClass =
    'w-full resize-none rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]';

  return (
    <div className="flex max-w-[1400px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Pengaturan Struk"
        info="Atur tampilan struk yang dicetak di Kasir App. Semua perubahan tersimpan otomatis. Koneksi printer Bluetooth diatur di Kasir App."
        action={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-[#64748b]">
              {saveState === 'saving' && (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Menyimpan...
                </>
              )}
              {saveState === 'saved' && (
                <>
                  <Check className="size-3.5 text-[#059669]" /> Tersimpan
                </>
              )}
              {saveState === 'error' && <span className="text-[#e11d48]">Gagal menyimpan</span>}
            </span>
            <button
              onClick={() => setStoreOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
            >
              <Store className="size-3.5" />
              Data Toko
            </button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      {!store.storeName && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-xs text-[#92400e]">
          <span>Data toko (nama, alamat, logo) belum diisi — struk memakai teks contoh.</span>
          <button onClick={() => setStoreOpen(true)} className="font-bold underline">
            Isi sekarang
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-6">
          {/* Printer & cetak ulang */}
          <div className="flex flex-col gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#0f172a]">Ukuran Kertas Printer</p>
                <p className="text-xs text-[#94a3b8]">
                  58 mm ≈ 32 karakter/baris · 80 mm ≈ 48 karakter/baris
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-1">
                {([58, 80] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => change('paper_width', w)}
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
                      s.paper_width === w
                        ? 'bg-[#0f172a] text-white shadow-sm'
                        : 'text-[#475569] hover:text-[#0f172a]'
                    }`}
                  >
                    {w} mm
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#f1f5f9] pt-4">
              <div>
                <p className="text-xs font-semibold text-[#0f172a]">Batasan Jumlah Cetak Struk</p>
                <p className="text-xs text-[#94a3b8]">
                  Maksimal berapa kali 1 transaksi boleh dicetak (anti cetak ulang berlebihan).
                </p>
              </div>
              <div className="flex items-center gap-3">
                {s.reprint_limit_enabled && (
                  <div className="flex items-center rounded-lg border border-[#cbd5e1]">
                    <button
                      onClick={() => change('reprint_limit', Math.max(1, s.reprint_limit - 1))}
                      className="px-2 py-1.5 text-[#475569] hover:bg-[#f8fafc]"
                      aria-label="Kurangi"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono text-xs font-bold text-[#0f172a]">
                      {s.reprint_limit}×
                    </span>
                    <button
                      onClick={() => change('reprint_limit', Math.min(20, s.reprint_limit + 1))}
                      className="px-2 py-1.5 text-[#475569] hover:bg-[#f8fafc]"
                      aria-label="Tambah"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                )}
                <Switch
                  checked={s.reprint_limit_enabled}
                  onChange={(v) => change('reprint_limit_enabled', v)}
                />
              </div>
            </div>
          </div>

          {/* Tampilan struk */}
          <div className="flex flex-col rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
            <div className="flex gap-1.5 border-b border-[#e2e8f0] px-5 pt-4">
              {(['header', 'body', 'footer'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 pb-2.5 text-xs font-bold capitalize ${
                    tab === t
                      ? 'border-[#0f172a] text-[#0f172a]'
                      : 'border-transparent text-[#94a3b8] hover:text-[#475569]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-6 p-5">
              {tab === 'header' && (
                <>
                  <Group title="Informasi Outlet">
                    <ToggleRow
                      label="Logo"
                      checked={s.show_logo}
                      onChange={(v) => change('show_logo', v)}
                    >
                      <div className="inline-flex w-fit rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-0.5">
                        {(['normal', 'penuh'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => change('logo_mode', m)}
                            className={`rounded-md px-3 py-1 text-xs font-bold capitalize ${
                              s.logo_mode === m ? 'bg-[#0f172a] text-white' : 'text-[#475569]'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </ToggleRow>
                    <ToggleRow
                      label="Nama Toko"
                      checked={s.show_store_name}
                      onChange={(v) => change('show_store_name', v)}
                    />
                    <ToggleRow
                      label="Alamat"
                      checked={s.show_address}
                      onChange={(v) => change('show_address', v)}
                    />
                    <ToggleRow
                      label="No. Telepon"
                      checked={s.show_phone}
                      onChange={(v) => change('show_phone', v)}
                    />
                    <ToggleRow
                      label="Email"
                      checked={s.show_email}
                      onChange={(v) => change('show_email', v)}
                    />
                    <ToggleRow
                      label="Teks Header Kustom"
                      hint="Info tambahan di atas struk"
                      checked={s.show_header_text}
                      onChange={(v) => change('show_header_text', v)}
                    >
                      <textarea
                        rows={2}
                        value={s.header_text ?? ''}
                        onChange={(e) => changeText('header_text', e.target.value)}
                        placeholder="Contoh: Buka setiap hari 08.00–23.00"
                        className={textareaClass}
                      />
                    </ToggleRow>
                  </Group>

                  <Group title="Informasi Transaksi">
                    <ToggleRow
                      label="Nomor Nota"
                      checked={s.show_receipt_number}
                      onChange={(v) => change('show_receipt_number', v)}
                    />
                    <ToggleRow
                      label="Waktu Transaksi"
                      checked={s.show_transaction_time}
                      onChange={(v) => change('show_transaction_time', v)}
                    />
                    <ToggleRow
                      label="Nomor Urut Pesanan"
                      checked={s.show_queue_number}
                      onChange={(v) => change('show_queue_number', v)}
                    />
                    <ToggleRow
                      label="Nama Kasir"
                      checked={s.show_cashier_name}
                      onChange={(v) => change('show_cashier_name', v)}
                    />
                    <ToggleRow
                      label="Nama Pelanggan"
                      hint="Nama yang diketik kasir, atau nama member (otomatis dari No HP)"
                      checked={s.show_customer}
                      onChange={(v) => change('show_customer', v)}
                    />
                    <ToggleRow
                      label="Jenis Order"
                      checked={s.show_order_type}
                      onChange={(v) => change('show_order_type', v)}
                    />
                    <ToggleRow
                      label="Nomor Meja"
                      checked={s.show_table_number}
                      onChange={(v) => change('show_table_number', v)}
                    />
                  </Group>
                </>
              )}

              {tab === 'body' && (
                <Group title="Informasi Produk">
                  <ToggleRow
                    label="Harga Satuan & Ekstra"
                    hint="Rincian harga per item + biaya tambahan Ekstra/Add-on"
                    checked={s.show_item_price}
                    onChange={(v) => change('show_item_price', v)}
                  />
                  <ToggleRow
                    label="Ekstra"
                    hint="Nama Ekstra/Add-on yang dipilih per item"
                    checked={s.show_extras}
                    onChange={(v) => change('show_extras', v)}
                  />
                  <p className="pt-3 text-xs leading-4 text-[#94a3b8]">
                    Ringkasan tagihan (Subtotal, Diskon, Pembulatan, Total, metode bayar) selalu
                    tampil — informasi wajib di setiap struk.
                  </p>
                </Group>
              )}

              {tab === 'footer' && (
                <>
                  <Group title="Teks Footer">
                    <ToggleRow
                      label="Catatan"
                      hint="Bebas: WiFi & password, promo, ucapan terima kasih, dll"
                      checked={s.show_footer_note}
                      onChange={(v) => change('show_footer_note', v)}
                    >
                      <textarea
                        rows={3}
                        value={s.footer_note ?? ''}
                        onChange={(e) => changeText('footer_note', e.target.value)}
                        placeholder={'Terima kasih!\nWiFi: IronaKopi · Pass: kopienak'}
                        className={textareaClass}
                      />
                    </ToggleRow>
                  </Group>
                  <Group title="Informasi Lainnya">
                    <ToggleRow
                      label="Media Sosial"
                      hint="Diambil dari Data Toko"
                      checked={s.show_social_media}
                      onChange={(v) => change('show_social_media', v)}
                    />
                  </Group>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-[#e2e8f0] bg-[#f1f5f9] p-5">
            <p className="pb-3 text-center text-xs font-bold uppercase tracking-[0.55px] text-[#64748b]">
              Live Preview
            </p>
            <div className="mb-3 flex justify-center">
              <div className="inline-flex rounded-lg border border-[#cbd5e1] bg-white p-0.5">
                {(['tunai', 'qris'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSamplePayment(m)}
                    className={`rounded-md px-3 py-1 text-xs font-bold ${
                      samplePayment === m ? 'bg-[#0f172a] text-white' : 'text-[#475569]'
                    }`}
                  >
                    Contoh {m === 'tunai' ? 'Tunai' : 'QRIS'}
                  </button>
                ))}
              </div>
            </div>
            <ReceiptPreview settings={s} store={store} samplePayment={samplePayment} />
          </div>
        </div>
      </div>

      {storeOpen && (
        <StoreProfileModal
          profile={store}
          onClose={() => setStoreOpen(false)}
          onSaved={(p) => {
            setStore(p);
            setStoreOpen(false);
            setSaveState('saved');
          }}
        />
      )}
    </div>
  );
}
