import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  addHoliday,
  cancelDisbursement,
  deleteHoliday,
  fetchDisbursements,
  fetchHolidays,
  fetchOnlineBalance,
  recordDisbursement,
} from '../../services/finance';
import type {
  BalanceStatus,
  BankHoliday,
  Disbursement,
  OnlineBalanceRow,
} from '../../types/finance';
import { formatRupiah, formatRupiahDetail } from '../../utils/format';
import { toLocalISO, todayISO } from '../../utils/date';
import { FieldLabel, inputClass } from '../products/product-form/formUi';
import {
  BALANCE_STATUS_CLASSES,
  BALANCE_STATUS_LABELS,
  formatDate,
  formatDateTime,
} from './cashFlowFormat';

type Tab = 'transaksi' | 'cairkan' | 'riwayat' | 'libur';

type Props = {
  initialTab: Tab;
  /** Tab Transaksi hanya menampilkan pesanan di periode ini */
  period: { start: string; end: string; label: string };
  onClose: () => void;
  onChanged: (message: string) => void;
};

const TABS: [Tab, string][] = [
  ['transaksi', 'Transaksi'],
  ['cairkan', 'Catat Pencairan'],
  ['riwayat', 'Riwayat Pencairan'],
  ['libur', 'Hari Libur'],
];

export default function OnlineBalanceModal({ initialTab, period, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [rows, setRows] = useState<OnlineBalanceRow[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [holidays, setHolidays] = useState<BankHoliday[]>([]);
  const [statusFilter, setStatusFilter] = useState<'' | BalanceStatus>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [disburseDate, setDisburseDate] = useState(todayISO());
  const [disburseNotes, setDisburseNotes] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, d, h] = await Promise.all([
        fetchOnlineBalance(),
        fetchDisbursements(),
        fetchHolidays(),
      ]);
      setRows(r);
      setDisbursements(d);
      setHolidays(h);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat saldo online.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const periodRows = rows.filter((r) => {
    const d = toLocalISO(new Date(r.transactionDate));
    return d >= period.start && d <= period.end;
  });
  const filtered = statusFilter ? periodRows.filter((r) => r.status === statusFilter) : periodRows;
  const totals = (list: OnlineBalanceRow[]) => ({
    gross: list.reduce((s, r) => s + r.grossAmount, 0),
    fee: list.reduce((s, r) => s + r.gatewayMdr + r.gatewayTax, 0),
    net: list.reduce((s, r) => s + r.netAmount, 0),
  });
  const filteredTotals = totals(filtered);

  // Transaksi yang ikut dicairkan per tanggal pencairan (sudah lewat 3 hari kerja per tanggal itu)
  const toDisburse = useMemo(
    () =>
      rows.filter(
        (r) =>
          (r.status === 'tersedia' || r.status === 'tertahan') && r.availableDate <= disburseDate
      ),
    [rows, disburseDate]
  );
  const disburseTotals = totals(toDisburse);

  async function run(action: () => Promise<void>, message: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged(message);
      await load();
      return true;
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">
              Saldo Online (Midtrans)
            </h2>
            <p className="text-xs leading-4 text-[#64748b]">
              Dana pesanan online bisa ditarik setelah 3 hari kerja sejak settlement (Sabtu, Minggu
              & hari libur tidak dihitung).
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

        <div className="flex shrink-0 gap-1 border-b border-[#e2e8f0] px-6">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-xs font-semibold ${
                tab === key
                  ? 'border-[#0f172a] text-[#0f172a]'
                  : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          {error && (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}

          {tab === 'transaksi' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as '' | BalanceStatus)}
                  className="w-48 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs outline-none"
                >
                  <option value="">Semua Status ({periodRows.length})</option>
                  {(['tertahan', 'tersedia', 'dicairkan', 'direfund'] as BalanceStatus[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {BALANCE_STATUS_LABELS[s]} (
                        {periodRows.filter((r) => r.status === s).length})
                      </option>
                    )
                  )}
                </select>
                <p className="text-xs text-[#475569]">
                  <span className="pr-2 font-semibold text-[#0f172a]">{period.label}</span>
                  Bruto <b className="font-mono">{formatRupiah(filteredTotals.gross)}</b> · Potongan{' '}
                  <b className="font-mono">{formatRupiahDetail(filteredTotals.fee)}</b> · Bersih{' '}
                  <b className="font-mono">{formatRupiahDetail(filteredTotals.net)}</b>
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="bg-[#f8fafc] text-[10px] font-bold uppercase tracking-[0.5px] text-[#64748b]">
                    <tr>
                      <th className="px-3 py-2 text-left">No Transaksi</th>
                      <th className="px-3 py-2 text-left">Settlement</th>
                      <th className="px-3 py-2 text-right">Nominal</th>
                      <th className="px-3 py-2 text-right">MDR 0,7%</th>
                      <th className="px-3 py-2 text-right">PPN MDR</th>
                      <th className="px-3 py-2 text-right">Bersih</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Tersedia / Dicairkan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-[#94a3b8]">
                          Belum ada transaksi online.
                        </td>
                      </tr>
                    )}
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t border-[#f1f5f9]">
                        <td className="px-3 py-2 font-mono text-[#0f172a]">
                          {r.transactionNumber}
                          {r.customerName && (
                            <span className="block font-sans text-[10px] text-[#94a3b8]">
                              {r.customerName}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[#475569]">{formatDateTime(r.settledAt)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatRupiah(r.grossAmount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#be123c]">
                          {formatRupiahDetail(r.gatewayMdr)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#be123c]">
                          {formatRupiahDetail(r.gatewayTax)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">
                          {formatRupiahDetail(r.netAmount)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${BALANCE_STATUS_CLASSES[r.status]}`}
                          >
                            {BALANCE_STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#475569]">
                          {r.disbursedDate
                            ? `Dicairkan ${formatDate(r.disbursedDate)}`
                            : `Tersedia ${formatDate(r.availableDate)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'cairkan' && (
            <div className="flex flex-col gap-4">
              <p className="rounded-lg bg-[#f8fafc] px-3 py-2.5 text-[11px] leading-4 text-[#475569]">
                Midtrans mencairkan seluruh saldo yang tersedia sekaligus (manual atau terjadwal).
                Catat di sini setelah dana masuk ke rekening: semua transaksi yang sudah tersedia
                per tanggal pencairan ditandai <b>Sudah Dicairkan</b>. Cocokkan totalnya dengan
                dashboard Midtrans.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel required>Tanggal Pencairan</FieldLabel>
                  <input
                    type="date"
                    value={disburseDate}
                    max={todayISO()}
                    onChange={(e) => setDisburseDate(e.target.value)}
                    className={inputClass()}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Catatan</FieldLabel>
                  <input
                    type="text"
                    value={disburseNotes}
                    onChange={(e) => setDisburseNotes(e.target.value)}
                    placeholder="Contoh: Tarik dana ke BCA"
                    className={inputClass()}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-xs">
                <div className="flex justify-between text-[#475569]">
                  <span>Transaksi yang ikut dicairkan</span>
                  <span className="font-mono">{toDisburse.length}</span>
                </div>
                <div className="flex justify-between text-[#475569]">
                  <span>Nominal bruto</span>
                  <span className="font-mono">{formatRupiah(disburseTotals.gross)}</span>
                </div>
                <div className="flex justify-between text-[#475569]">
                  <span>Potongan MDR + PPN</span>
                  <span className="font-mono text-[#be123c]">
                    −{formatRupiahDetail(disburseTotals.fee)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between border-t border-dashed border-[#cbd5e1] pt-2 text-sm font-bold text-[#0f172a]">
                  <span>Dana masuk rekening</span>
                  <span className="font-mono">{formatRupiahDetail(disburseTotals.net)}</span>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  disabled={busy || toDisburse.length === 0}
                  onClick={() =>
                    run(
                      () => recordDisbursement(disburseDate, disburseNotes.trim() || null),
                      `Pencairan ${formatRupiahDetail(disburseTotals.net)} tercatat.`
                    ).then((ok) => {
                      if (!ok) return;
                      setDisburseNotes('');
                      setTab('riwayat');
                    })
                  }
                  className="rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-40"
                >
                  {busy ? 'Menyimpan...' : 'Catat Pencairan'}
                </button>
              </div>
            </div>
          )}

          {tab === 'riwayat' && (
            <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-[#f8fafc] text-[10px] font-bold uppercase tracking-[0.5px] text-[#64748b]">
                  <tr>
                    <th className="px-3 py-2 text-left">Tanggal</th>
                    <th className="px-3 py-2 text-right">Transaksi</th>
                    <th className="px-3 py-2 text-right">Bruto</th>
                    <th className="px-3 py-2 text-right">Potongan</th>
                    <th className="px-3 py-2 text-right">Bersih</th>
                    <th className="px-3 py-2 text-left">Catatan</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {disbursements.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-[#94a3b8]">
                        Belum ada pencairan.
                      </td>
                    </tr>
                  )}
                  {disbursements.map((d) => (
                    <tr key={d.id} className="border-t border-[#f1f5f9]">
                      <td className="px-3 py-2">{formatDate(d.disbursedDate)}</td>
                      <td className="px-3 py-2 text-right">{d.transactionCount}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatRupiah(d.grossAmount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[#be123c]">
                        {formatRupiahDetail(d.feeAmount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {formatRupiahDetail(d.netAmount)}
                      </td>
                      <td className="px-3 py-2 text-[#475569]">{d.notes || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Batalkan pencairan ${formatDate(d.disbursedDate)}? Transaksinya kembali berstatus Tersedia.`
                              )
                            )
                              run(() => cancelDisbursement(d.id), 'Pencairan dibatalkan.');
                          }}
                          className="text-[11px] font-medium text-[#e11d48] hover:underline"
                        >
                          Batalkan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'libur' && (
            <div className="flex flex-col gap-4">
              <p className="text-[11px] leading-4 text-[#64748b]">
                Tanggal libur nasional / cuti bersama tidak dihitung sebagai hari kerja saat
                menentukan kapan saldo online Tersedia.
              </p>
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Tanggal</FieldLabel>
                  <input
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    className={inputClass()}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel>Nama Libur</FieldLabel>
                  <input
                    type="text"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    placeholder="Contoh: Idul Fitri"
                    className={inputClass()}
                  />
                </div>
                <button
                  disabled={busy || !holidayDate || !holidayName.trim()}
                  onClick={() =>
                    run(
                      () => addHoliday(holidayDate, holidayName.trim()),
                      'Tanggal libur ditambahkan.'
                    ).then((ok) => {
                      if (!ok) return;
                      setHolidayDate('');
                      setHolidayName('');
                    })
                  }
                  className="flex h-[46px] items-center gap-1.5 rounded-xl bg-[#0f172a] px-4 text-xs font-semibold text-white disabled:opacity-40"
                >
                  <Plus className="size-4" />
                  Tambah
                </button>
              </div>
              <div className="flex flex-col divide-y divide-[#f1f5f9] rounded-xl border border-[#e2e8f0]">
                {holidays.length === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-[#94a3b8]">
                    Belum ada tanggal libur.
                  </p>
                )}
                {holidays.map((h) => (
                  <div
                    key={h.date}
                    className="flex items-center justify-between px-4 py-2.5 text-xs"
                  >
                    <span>
                      <span className="font-mono text-[#0f172a]">{formatDate(h.date)}</span>
                      <span className="pl-3 text-[#475569]">{h.name}</span>
                    </span>
                    <button
                      disabled={busy}
                      onClick={() => run(() => deleteHoliday(h.date), 'Tanggal libur dihapus.')}
                      aria-label="Hapus"
                      className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#fff1f2] hover:text-[#e11d48]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
