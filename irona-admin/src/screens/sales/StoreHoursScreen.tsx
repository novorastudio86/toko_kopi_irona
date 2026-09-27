import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Copy, Globe, History, Store, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { fetchStoreHours, saveStoreHours } from '../../services/storeHours';
import type { DayHours, HoursChannel } from '../../types/storeHours';
import StoreHoursHistoryModal from './StoreHoursHistoryModal';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
/** Tampil Senin → Minggu */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const SECTIONS: {
  channel: HoursChannel;
  title: string;
  description: string;
  openLabel: string;
  icon: typeof Store;
}[] = [
  {
    channel: 'offline',
    title: 'Jam Operasional Offline (Toko)',
    description: 'Jam buka toko untuk Dine In & Take Away di kasir.',
    openLabel: 'Buka',
    icon: Store,
  },
  {
    channel: 'online',
    title: 'Jam Layanan Online',
    description: 'Di luar jam ini, checkout di Web Customer diblokir total.',
    openLabel: 'Aktif',
    icon: Globe,
  },
];

function sameDays(a: DayHours[], b: DayHours[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function HoursSection({
  channel,
  title,
  description,
  openLabel,
  icon: Icon,
  saved,
  onSaved,
}: (typeof SECTIONS)[number] & { saved: DayHours[]; onSaved: (message: string) => void }) {
  const [days, setDays] = useState<DayHours[]>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = !sameDays(days, saved);

  function update(dow: number, patch: Partial<DayHours>) {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d)));
  }

  /** Salin jam Senin ke semua hari */
  function copyMonday() {
    const monday = days.find((d) => d.dayOfWeek === 1);
    if (!monday) return;
    setDays((prev) => prev.map((d) => ({ ...monday, dayOfWeek: d.dayOfWeek })));
  }

  async function handleSave() {
    const invalid = days.find(
      (d) => d.isOpen && (!d.openTime || !d.closeTime || d.closeTime <= d.openTime)
    );
    if (invalid) {
      setError(`${DAY_NAMES[invalid.dayOfWeek]}: jam tutup harus setelah jam buka.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveStoreHours(channel, days);
      onSaved(`${title} berhasil disimpan.`);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan jam buka.');
    } finally {
      setSaving(false);
    }
  }

  const timeClass =
    'rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 font-mono text-xs text-[#0f172a] outline-none focus:border-[#94a3b8] disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]';

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#334155]">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-[#0f172a]">{title}</p>
            <p className="text-[11px] text-[#64748b]">{description}</p>
          </div>
        </div>
        <button
          onClick={copyMonday}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-[11px] font-semibold text-[#475569] hover:bg-[#f8fafc]"
        >
          <Copy className="size-3" />
          Samakan ke Semua Hari
        </button>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#64748b]">
            <th className="px-5 py-2.5 text-left">Hari</th>
            <th className="px-3 py-2.5 text-left">{openLabel}</th>
            <th className="px-3 py-2.5 text-left">
              {channel === 'offline' ? 'Jam Buka' : 'Jam Mulai'}
            </th>
            <th className="px-5 py-2.5 text-left">
              {channel === 'offline' ? 'Jam Tutup' : 'Jam Selesai'}
            </th>
          </tr>
        </thead>
        <tbody>
          {DAY_ORDER.map((dow) => {
            const d = days.find((x) => x.dayOfWeek === dow);
            if (!d) return null;
            return (
              <tr
                key={dow}
                className={`border-t border-[#f1f5f9] ${d.isOpen ? '' : 'bg-[#fcfcfd]'}`}
              >
                <td
                  className={`px-5 py-2.5 text-xs font-semibold ${d.isOpen ? 'text-[#0f172a]' : 'text-[#94a3b8]'}`}
                >
                  {DAY_NAMES[dow]}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={d.isOpen}
                    onClick={() => update(dow, { isOpen: !d.isOpen })}
                    className={`relative h-5 w-9 rounded-full transition-colors ${d.isOpen ? 'bg-[#0f172a]' : 'bg-[#cbd5e1]'}`}
                  >
                    <span
                      className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${d.isOpen ? 'left-[18px]' : 'left-0.5'}`}
                    />
                  </button>
                  {!d.isOpen && <span className="ml-2 text-[11px] text-[#94a3b8]">Tutup</span>}
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="time"
                    value={d.openTime}
                    disabled={!d.isOpen}
                    onChange={(e) => update(dow, { openTime: e.target.value })}
                    className={timeClass}
                  />
                </td>
                <td className="px-5 py-2.5">
                  <input
                    type="time"
                    value={d.closeTime}
                    disabled={!d.isOpen}
                    onChange={(e) => update(dow, { closeTime: e.target.value })}
                    className={timeClass}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-between gap-3 border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3">
        <p className="text-[11px] text-[#e11d48]">{error}</p>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={() => {
                setDays(saved);
                setError(null);
              }}
              className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
            >
              Batalkan Perubahan
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="rounded-lg bg-[#0f172a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-40"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoreHoursScreen() {
  const [hours, setHours] = useState<Record<HoursChannel, DayHours[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Naikkan versi supaya form di-reset ke data tersimpan terbaru setelah simpan
  const [version, setVersion] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setHours(await fetchStoreHours());
      setVersion((v) => v + 1);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat jam buka.');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  return (
    <div className="flex max-w-[1400px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        breadcrumb={['Penjualan', 'Jam Buka']}
        title="Jam Buka"
        info="Jam buka toko (offline) dan jam layanan pesanan online per hari. Take Away mengikuti jam offline. Terpisah dari jam kerja/lembur karyawan."
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

      {!hours ? (
        <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat jam buka...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {SECTIONS.map((s) => (
            <HoursSection
              key={`${s.channel}-${version}`}
              {...s}
              saved={hours[s.channel]}
              onSaved={(message) => {
                setFlash(message);
                loadData();
              }}
            />
          ))}
        </div>
      )}

      {historyOpen && <StoreHoursHistoryModal onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
