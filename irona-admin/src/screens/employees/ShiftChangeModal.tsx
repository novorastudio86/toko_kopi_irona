import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  addShiftSlot,
  coverShiftSlot,
  fetchEmployeeSlots,
  fetchShiftPatterns,
  setShiftDayOff,
  swapShiftSlots,
} from '../../services/shifts';
import type { EmployeeShiftRow, ShiftPattern, ShiftSlot } from '../../types/shift';
import { formatClock, formatDayLabel } from '../../utils/date';

type Tab = 'tukar' | 'gantikan' | 'tambah' | 'libur';

const TABS: { id: Tab; label: string }[] = [
  { id: 'tukar', label: 'Tukar' },
  { id: 'gantikan', label: 'Gantikan' },
  { id: 'tambah', label: 'Tambah Shift' },
  { id: 'libur', label: 'Libur / Sakit' },
];

type Props = {
  employee: EmployeeShiftRow;
  date: string;
  /** Semua karyawan di tanggal ini (termasuk employee) */
  allEmployees: EmployeeShiftRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

function slotLabel(s: { shiftName: string; startTime: string; endTime: string }) {
  return `${s.shiftName} (${formatClock(s.startTime)}–${formatClock(s.endTime)})`;
}

export default function ShiftChangeModal({ employee, date, allEmployees, onClose, onSaved }: Props) {
  const hasSlots = employee.slots.length > 0;
  const others = allEmployees.filter((e) => e.employeeId !== employee.employeeId);

  const [tab, setTab] = useState<Tab>(hasSlots ? 'tukar' : 'tambah');
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [mySlotId, setMySlotId] = useState(employee.slots[0]?.shiftPatternId ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tukar
  const [partnerId, setPartnerId] = useState('');
  const [partnerDate, setPartnerDate] = useState(date);
  const [partnerSlots, setPartnerSlots] = useState<ShiftSlot[]>([]);
  const [partnerSlotId, setPartnerSlotId] = useState('');
  const [partnerLoading, setPartnerLoading] = useState(false);

  // Gantikan
  const [replacementId, setReplacementId] = useState('');

  // Tambah
  const [addPatternId, setAddPatternId] = useState('');

  useEffect(() => {
    fetchShiftPatterns()
      .then(setPatterns)
      .catch((err) => setError(err?.message ?? 'Gagal memuat pola shift.'));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function loadPartnerSlots(id: string, onDate: string) {
    setPartnerSlots([]);
    setPartnerSlotId('');
    if (!id || !onDate) return;
    setPartnerLoading(true);
    try {
      const slots = await fetchEmployeeSlots(id, onDate);
      setPartnerSlots(slots);
      setPartnerSlotId(slots[0]?.shiftPatternId ?? '');
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat jadwal karyawan.');
    } finally {
      setPartnerLoading(false);
    }
  }

  const mySlot = employee.slots.find((s) => s.shiftPatternId === mySlotId) ?? null;
  const partner = others.find((e) => e.employeeId === partnerId) ?? null;
  const partnerSlot = partnerSlots.find((s) => s.shiftPatternId === partnerSlotId) ?? null;
  const replacement = others.find((e) => e.employeeId === replacementId) ?? null;

  // Pola yang bisa ditambahkan: belum dimiliki & tidak bertabrakan dengan shift yang ada
  const addOptions = patterns.filter(
    (p) =>
      !employee.slots.some(
        (s) => s.shiftPatternId === p.id || (p.startTime < s.endTime && s.startTime < p.endTime)
      )
  );
  const addPattern = patterns.find((p) => p.id === (addPatternId || addOptions[0]?.id)) ?? null;

  async function run(action: () => Promise<void>, message: string) {
    setSaving(true);
    setError(null);
    try {
      await action();
      onSaved(message);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan perubahan jadwal.');
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    const trimmed = note.trim() || null;

    if (tab === 'tukar') {
      if (!mySlot || !partner || !partnerSlot) {
        setError('Lengkapi shift yang ditukar dan pasangannya.');
        return;
      }
      run(
        () =>
          swapShiftSlots({
            employeeAId: employee.employeeId,
            dateA: date,
            patternAId: mySlot.shiftPatternId,
            employeeBId: partner.employeeId,
            dateB: partnerDate,
            patternBId: partnerSlot.shiftPatternId,
            note: trimmed,
          }),
        `Shift ${employee.fullName} & ${partner.fullName} berhasil ditukar.`
      );
    }

    if (tab === 'gantikan') {
      if (!mySlot || !replacement) {
        setError('Pilih shift dan karyawan pengganti.');
        return;
      }
      run(
        () =>
          coverShiftSlot({
            fromEmployeeId: employee.employeeId,
            toEmployeeId: replacement.employeeId,
            date,
            patternId: mySlot.shiftPatternId,
            note: trimmed,
          }),
        `Shift ${mySlot.shiftName} ${employee.fullName} digantikan ${replacement.fullName}.`
      );
    }

    if (tab === 'tambah') {
      if (!addPattern) {
        setError('Pilih shift yang ditambahkan.');
        return;
      }
      run(
        () => addShiftSlot({ employeeId: employee.employeeId, date, patternId: addPattern.id, note: trimmed }),
        `Shift ${addPattern.name} ditambahkan untuk ${employee.fullName}.`
      );
    }

    if (tab === 'libur') {
      if (!trimmed) {
        setError('Isi alasan libur.');
        return;
      }
      run(
        () => setShiftDayOff(employee.employeeId, date, trimmed),
        `${employee.fullName} ditandai Libur pada ${formatDayLabel(date)}.`
      );
    }
  }

  const needsSlot = tab === 'tukar' || tab === 'gantikan' || tab === 'libur';
  const blocked = needsSlot && !hasSlots;

  const labelClass = 'text-xs font-bold uppercase tracking-[0.6px] text-[#334155]';
  const fieldClass =
    'w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#94a3b8]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 pb-5 pt-5">
          <div>
            <h2 className="text-lg font-bold leading-7 text-[#0f172a]">{employee.fullName}</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              {formatDayLabel(date)} ·{' '}
              {hasSlots ? employee.slots.map(slotLabel).join(' + ') : employee.hasSchedule ? 'Libur' : 'Belum diatur'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-4 gap-1.5 px-6 pt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={`rounded-lg py-2 text-[11px] font-bold ${
                tab === t.id ? 'bg-[#0f172a] text-white' : 'border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          {blocked && (
            <p className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-xs leading-5 text-[#64748b]">
              {employee.fullName} tidak punya shift di tanggal ini. Buka dari baris karyawan yang punya shift, atau
              gunakan <span className="font-bold">Tambah Shift</span>.
            </p>
          )}

          {!blocked && (tab === 'tukar' || tab === 'gantikan') && (
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Shift {employee.fullName}</label>
              <select value={mySlotId} onChange={(e) => setMySlotId(e.target.value)} className={fieldClass}>
                {employee.slots.map((s) => (
                  <option key={s.shiftPatternId} value={s.shiftPatternId}>
                    {slotLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!blocked && tab === 'tukar' && (
            <>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className={labelClass}>Tukar dengan</label>
                  <select
                    value={partnerId}
                    onChange={(e) => {
                      setPartnerId(e.target.value);
                      loadPartnerSlots(e.target.value, partnerDate);
                    }}
                    className={fieldClass}
                  >
                    <option value="">Pilih karyawan</option>
                    {others.map((e) => (
                      <option key={e.employeeId} value={e.employeeId}>
                        {e.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className={labelClass}>Tanggal shift-nya</label>
                  <input
                    type="date"
                    value={partnerDate}
                    onChange={(e) => {
                      setPartnerDate(e.target.value);
                      loadPartnerSlots(partnerId, e.target.value);
                    }}
                    className={fieldClass}
                  />
                </div>
              </div>

              {partnerId && (
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Shift {partner?.fullName}</label>
                  {partnerLoading ? (
                    <p className="text-xs text-[#94a3b8]">Memuat jadwal...</p>
                  ) : partnerSlots.length === 0 ? (
                    <p className="text-xs leading-5 text-[#e11d48]">
                      {partner?.fullName} tidak punya shift di {formatDayLabel(partnerDate)}. Pilih tanggal lain, atau
                      pakai tab <span className="font-bold">Gantikan</span>.
                    </p>
                  ) : (
                    <select value={partnerSlotId} onChange={(e) => setPartnerSlotId(e.target.value)} className={fieldClass}>
                      {partnerSlots.map((s) => (
                        <option key={s.shiftPatternId} value={s.shiftPatternId}>
                          {slotLabel(s)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {mySlot && partner && partnerSlot && (
                <div className="flex flex-col gap-1 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-xs leading-5 text-[#92400e]">
                  <p className="font-bold">Hasil setelah ditukar:</p>
                  <p>
                    {formatDayLabel(date)}: {mySlot.shiftName} dipegang <span className="font-bold">{partner.fullName}</span>
                  </p>
                  <p>
                    {formatDayLabel(partnerDate)}: {partnerSlot.shiftName} dipegang{' '}
                    <span className="font-bold">{employee.fullName}</span>
                  </p>
                </div>
              )}
            </>
          )}

          {!blocked && tab === 'gantikan' && (
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Digantikan oleh</label>
              <select value={replacementId} onChange={(e) => setReplacementId(e.target.value)} className={fieldClass}>
                <option value="">Pilih karyawan pengganti</option>
                {others.map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.fullName} — {e.slots.length > 0 ? e.slots.map((s) => s.shiftName).join(' + ') : 'Libur'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] leading-4 text-[#94a3b8]">
                {employee.fullName} dilepas dari shift ini; pengganti mendapat shift tersebut khusus tanggal ini. Kalau
                pengganti sudah punya shift lain hari itu, shift ini jadi Shift 2-nya (dibayar sebagai bonus).
              </p>
            </div>
          )}

          {tab === 'tambah' && (
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Shift yang ditambahkan</label>
              {addOptions.length === 0 ? (
                <p className="text-xs text-[#e11d48]">Tidak ada shift lain yang jamnya tidak bertabrakan.</p>
              ) : (
                <select
                  value={addPatternId || addOptions[0]?.id}
                  onChange={(e) => setAddPatternId(e.target.value)}
                  className={fieldClass}
                >
                  {addOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {slotLabel({ shiftName: p.name, startTime: p.startTime, endTime: p.endTime })}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] leading-4 text-[#94a3b8]">
                {hasSlots
                  ? 'Karyawan ini sudah punya shift hari itu — shift tambahan jadi Shift 2 dan dibayar sebagai bonus.'
                  : 'Khusus tanggal ini saja. Jadwal mingguan tidak berubah.'}
              </p>
            </div>
          )}

          {!blocked && tab === 'libur' && (
            <p className="text-xs leading-5 text-[#64748b]">
              Semua shift {employee.fullName} di {formatDayLabel(date)} dilepas. Jadwal mingguan tetap berlaku di hari lain.
            </p>
          )}

          {!blocked && (
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{tab === 'libur' ? 'Alasan' : 'Catatan (opsional)'}</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tab === 'libur' ? 'Contoh: Sakit demam' : 'Contoh: Ada acara keluarga'}
                className={fieldClass}
              />
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">{error}</p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#cbd5e1] bg-white px-5 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || blocked}
            className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
