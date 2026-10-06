import { useEffect, useState, type ReactNode } from 'react';
import { PencilLine, X } from 'lucide-react';
import { fetchEmployeeDetail } from '../../services/employees';
import { formatRupiah } from '../../utils/format';
import { parseLocalDate } from '../../utils/date';
import type { EmployeeDetail } from '../../types/employee';

/** "2 tahun 3 bulan" / "5 bulan" / "kurang dari 1 bulan" */
function tenure(hireDate: string): string {
  const start = parseLocalDate(hireDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return 'kurang dari 1 bulan';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years > 0 ? `${years} tahun` : '', rest > 0 ? `${rest} bulan` : ''].filter(Boolean).join(' ');
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-[#f1f5f9] py-4 last:border-b-0">
      <span className="shrink-0 text-sm text-[#64748b]">{label}</span>
      <div className="text-right text-sm text-[#0f172a]">{children}</div>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

type Props = { employeeId: string; onClose: () => void; onEdit: () => void };

export default function EmployeeDetailModal({ employeeId, onClose, onEdit }: Props) {
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEmployeeDetail(employeeId)
      .then((data) => {
        if (cancelled) return;
        if (!data) setError('Karyawan tidak ditemukan.');
        setDetail(data);
      })
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat detail karyawan.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const joinedAt = detail
    ? parseLocalDate(detail.hireDate).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#e2e8f0] px-6 py-5">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#0f172a] text-base font-bold text-white">
              {detail ? initials(detail.fullName) : '—'}
            </span>
            <div>
              <h2 className="text-base font-bold leading-6 text-[#0f172a]">Detail Karyawan</h2>
              <p className="text-sm text-[#64748b]">
                {detail ? `${detail.code} • Mulai kerja ${joinedAt}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {loading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat detail...</p>
          ) : error || !detail ? (
            <p className="my-4 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          ) : (
            <>
              <Row label="Nama">
                <span className="font-bold">{detail.fullName}</span>
              </Row>
              <Row label="Alamat">
                {detail.address ?? <span className="text-[#94a3b8]">Belum diisi</span>}
              </Row>
              <Row label="No. Telp">
                <span className="font-mono">{detail.phoneNumber}</span>
              </Row>
              <Row label="Role">
                <span className="inline-flex items-center rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-bold text-white">
                  {detail.roleName}
                </span>
              </Row>
              <Row label="Tanggal Mulai Kerja">
                {parseLocalDate(detail.hireDate).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                <span className="block text-xs text-[#64748b]">Masa kerja {tenure(detail.hireDate)}</span>
              </Row>
              <Row label="Username">
                <span className="font-mono">@{detail.username}</span>
              </Row>
              <Row label="Akses Aplikasi">
                {detail.roleType === 'staf'
                  ? 'Tanpa aplikasi (absen QR saja)'
                  : detail.roleType === 'driver'
                    ? 'Aplikasi Driver'
                    : detail.roleType === 'admin'
                      ? 'Web Admin'
                      : 'Aplikasi Kasir'}
              </Row>
              <Row label="Gaji Pokok">
                <span className="font-mono font-bold">{formatRupiah(detail.baseSalary)}</span>
              </Row>
              {detail.roleType === 'driver' && (
                <Row label="Bonus per Pengantaran">
                  <span className="font-mono font-bold">
                    {detail.deliveryBonus > 0 ? formatRupiah(detail.deliveryBonus) : '—'}
                  </span>
                </Row>
              )}
              <Row label="Status Akun">
                {detail.isActive ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-3.5 py-1.5 text-xs font-bold text-white">
                    <span className="size-1.5 rounded-full bg-[#34d399]" />
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-3.5 py-1.5 text-xs font-bold text-[#475569]">
                    <span className="size-1.5 rounded-full bg-[#94a3b8]" />
                    Nonaktif
                  </span>
                )}
              </Row>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-[#e2e8f0] px-6 py-4">
          <button
            onClick={onEdit}
            disabled={!detail}
            className="flex items-center gap-2 text-sm font-semibold text-[#334155] hover:text-[#0f172a] disabled:opacity-60"
          >
            <PencilLine className="size-4" />
            Ubah Profil
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#cbd5e1] bg-white px-6 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}