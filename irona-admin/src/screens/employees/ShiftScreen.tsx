import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CalendarCog, CheckCircle2, History, Pencil, Repeat, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '../../components/PageHeader';
import { fetchEmployeeShifts, fetchUpcomingOverrides } from '../../services/shifts';
import type { DateOverride, EmployeeShiftRow } from '../../types/shift';
import { formatClock, formatDayLabel, parseLocalDate, todayISO } from '../../utils/date';
import ShiftDefaultsModal from './ShiftDefaultsModal';
import ShiftDateOverrideModal from './ShiftDateOverrideModal';
import ShiftChangeModal from './ShiftChangeModal';
import ShiftHistoryModal from './ShiftHistoryModal';
import icMore from '../../assets/ui/more.svg';

export default function ShiftScreen() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<EmployeeShiftRow[]>([]);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [defaultsFor, setDefaultsFor] = useState<EmployeeShiftRow | null | 'new'>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [changeFor, setChangeFor] = useState<EmployeeShiftRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shiftRows, upcoming] = await Promise.all([fetchEmployeeShifts(date), fetchUpcomingOverrides(todayISO())]);
      setRows(shiftRows);
      setOverrides(upcoming);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat jadwal shift.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const today = todayISO();
  const isToday = date === today;
  const overridesToday = overrides.filter((o) => o.date === date);

  return (
    <div className="flex max-w-[1400px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Shift Kerja"
        info="Jadwal mingguan tiap karyawan berulang otomatis. Ubah per tanggal hanya untuk tukar, gantikan, tambah shift, libur mendadak, atau jam khusus toko."
        action={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 font-mono text-xs text-[#0f172a] outline-none focus:border-[#94a3b8]"
            />
            {!isToday && (
              <button
                onClick={() => setDate(today)}
                className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
              >
                Hari ini
              </button>
            )}
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
            >
              <History className="size-3.5" />
              Riwayat
            </button>
            <button
              onClick={() => setOverrideOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
            >
              <CalendarClock className="size-3.5" />
              Jam Khusus
            </button>
            <button
              onClick={() => setDefaultsFor('new')}
              className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1e293b]"
            >
              <CalendarCog className="size-3.5" />
              Atur Jadwal Mingguan
            </button>
          </div>
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

      {overrides.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-5 py-3">
          <CalendarClock className="size-4 shrink-0 text-[#b45309]" />
          <span className="text-xs font-bold text-[#92400e]">Tampilkan:</span>

          <button
            onClick={() => setDate(today)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
              isToday
                ? 'border-[#0f172a] bg-[#0f172a] text-white'
                : 'border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc]'
            }`}
          >
            Jam Normal · Hari Ini
          </button>

          <span className="mx-1 h-4 w-px bg-[#fcd34d]" />
          <span className="text-[11px] font-semibold text-[#92400e]">Jam Khusus:</span>

          {overrides.map((o) => (
            <button
              key={o.id}
              onClick={() => setDate(o.date)}
              title="Lihat jadwal tanggal ini"
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                o.date === date
                  ? 'border-[#b45309] bg-[#b45309] text-white'
                  : 'border-[#fcd34d] bg-white text-[#92400e] hover:bg-[#fef3c7]'
              }`}
            >
              {parseLocalDate(o.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
              {o.patternName} {formatClock(o.startTime)}–{formatClock(o.endTime)}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <table className="w-full border-collapse">
          <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
            <tr className="text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
              <th className="px-4 py-3 text-left">Nama</th>
              <th className="px-3 py-3 text-left">Username</th>
              <th className="px-3 py-3 text-left">
                Shift ({formatDayLabel(date)})
                {overridesToday.length > 0 && (
                  <span className="ml-2 rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs normal-case tracking-normal text-[#92400e]">
                    ada jam khusus
                  </span>
                )}
              </th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-[#94a3b8]">
                  Memuat jadwal...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-[#94a3b8]">
                  Belum ada karyawan Kasir/Driver aktif.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.employeeId} className="border-t border-[#f1f5f9]">
                  <td className="px-4 py-3.5 text-sm font-bold text-[#0f172a]">{row.fullName}</td>
                  <td className="px-3 py-3.5 font-mono text-sm text-[#64748b]">@{row.username}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!row.hasSchedule && (
                        <span className="rounded-full border border-dashed border-[#f43f5e] px-2.5 py-0.5 text-xs font-bold text-[#e11d48]">
                          Belum diatur
                        </span>
                      )}
                      {row.hasSchedule && row.isLibur && (
                        <span className="rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold text-[#475569]">
                          Libur
                        </span>
                      )}
                      {row.slots.map((slot, i) => (
                        <span
                          key={slot.shiftPatternId}
                          title={slot.isChanged ? 'Hasil tukar/gantikan/tambah, bukan dari jadwal mingguan' : undefined}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            slot.isSpecialHours
                              ? 'border border-[#f59e0b] bg-[#fffbeb] text-[#92400e]'
                              : i === 0
                                ? 'border border-[#cbd5e1] bg-white text-[#334155]'
                                : 'bg-[#0f172a] text-white'
                          } ${slot.isChanged ? 'border-dashed' : ''}`}
                        >
                          {i > 0 && <span className="opacity-70">Shift 2 ·</span>}
                          {slot.shiftName} ({formatClock(slot.startTime)}–{formatClock(slot.endTime)})
                          {slot.isSpecialHours && <span className="opacity-80">· Jam Khusus</span>}
                        </span>
                      ))}
                      {row.isSwap && (
                        <span className="rounded-full border border-[#fbbf24] bg-[#fffbeb] px-2.5 py-0.5 text-xs font-bold text-[#92400e]">
                          Tukar dgn {row.swapWithName}
                        </span>
                      )}
                      {!row.isSwap && row.slots.some((s) => s.isChanged) && (
                        <span className="rounded-full border border-[#cbd5e1] bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium text-[#475569]">
                          Diubah
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-lg border border-[#e2e8f0] p-[7px] hover:bg-[#f8fafc]">
                        <img src={icMore} alt="Aksi" className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setChangeFor(row)}>
                          <Repeat className="mr-2 size-3.5" />
                          Ubah Jadwal Tanggal Ini
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDefaultsFor(row)}>
                          <Pencil className="mr-2 size-3.5" />
                          Ubah Jadwal Mingguan
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {defaultsFor && (
        <ShiftDefaultsModal
          employee={defaultsFor === 'new' ? null : defaultsFor}
          allEmployees={rows}
          onClose={() => setDefaultsFor(null)}
          onSaved={(name) => {
            setDefaultsFor(null);
            setFlash(`Jadwal mingguan ${name} berhasil disimpan.`);
            loadData();
          }}
        />
      )}

      {overrideOpen && (
        <ShiftDateOverrideModal
          onClose={() => {
            setOverrideOpen(false);
            loadData(); // jam khusus bisa dihapus dari dalam modal
          }}
          onSaved={(savedDate) => {
            setOverrideOpen(false);
            setFlash(`Jam khusus ${formatDayLabel(savedDate)} berhasil disimpan.`);
            if (savedDate === date) loadData();
            else setDate(savedDate); // pindah ke tanggalnya supaya langsung terlihat
          }}
        />
      )}

      {historyOpen && (
        <ShiftHistoryModal
          onClose={() => setHistoryOpen(false)}
          onChanged={(message) => {
            setFlash(message);
            loadData();
          }}
        />
      )}

      {changeFor && (
        <ShiftChangeModal
          employee={changeFor}
          date={date}
          allEmployees={rows}
          onClose={() => setChangeFor(null)}
          onSaved={(message) => {
            setChangeFor(null);
            setFlash(message);
            loadData();
          }}
        />
      )}
    </div>
  );
}
