import { useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { cancelRewardClaim, fetchRewardClaims } from '../../services/rewards';
import type { ClaimStatus, Reward, RewardClaim } from '../../types/reward';

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  menunggu: 'Menunggu Ditukar',
  sudah_ditukar: 'Sudah Ditukar',
  hangus: 'Hangus',
  dibatalkan: 'Dibatalkan',
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const cls =
    status === 'menunggu'
      ? 'border border-[#f59e0b] bg-[#fffbeb] text-[#92400e]'
      : status === 'sudah_ditukar'
        ? 'bg-[#0f172a] text-white'
        : status === 'dibatalkan'
          ? 'border border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]'
          : 'border border-dashed border-[#94a3b8] bg-[#f1f5f9] text-[#64748b]';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {CLAIM_STATUS_LABELS[status]}
    </span>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = { reward: Reward; onClose: () => void; onChanged: (message: string) => void };

export default function RewardClaimsModal({ reward, onClose, onChanged }: Props) {
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setClaims(await fetchRewardClaims(reward.id));
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat riwayat klaim.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reward.id]);

  /** Member tidak jadi pesan — batalkan klaim, poin dikembalikan */
  async function handleCancel(c: RewardClaim) {
    const reason = window.prompt(
      `Batalkan klaim ${c.code} milik ${c.customerName}? ${c.pointsUsed} poin akan dikembalikan.\n\nAlasan pembatalan:`,
      'Tidak jadi pesan'
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setError('Alasan pembatalan wajib diisi.');
      return;
    }
    setCancellingId(c.id);
    setError(null);
    try {
      const balance = await cancelRewardClaim(c.id, reason.trim());
      await load();
      onChanged(
        `Klaim ${c.code} dibatalkan. ${c.pointsUsed} poin kembali ke ${c.customerName} (saldo ${balance}).`
      );
    } catch (err: any) {
      setError(err?.message ?? 'Gagal membatalkan klaim.');
    } finally {
      setCancellingId(null);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 pb-[17px] pt-4">
          <div>
            <h2 className="text-base font-bold leading-6 text-[#0f172a]">Riwayat Klaim</h2>
            <p className="text-xs leading-4 text-[#64748b]">
              {reward.name} · {reward.pointsRequired} poin
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

        <div className="overflow-y-auto p-6">
          {error && (
            <p className="mb-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          )}
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#64748b]">
                <th className="pb-2 text-left">Pelanggan</th>
                <th className="pb-2 text-left">No. Telp</th>
                <th className="pb-2 text-left">Tanggal & Jam Klaim</th>
                <th className="pb-2 text-left">Kode</th>
                <th className="pb-2 text-left">Status</th>
                <th className="pb-2 text-left">Ditukar / Hangus</th>
                <th className="pb-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-[#94a3b8]">
                    Memuat riwayat klaim...
                  </td>
                </tr>
              )}
              {!loading && claims.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-[#94a3b8]">
                    Belum ada member yang mengklaim reward ini.
                  </td>
                </tr>
              )}
              {claims.map((c) => (
                <tr key={c.id} className="border-t border-[#f1f5f9]">
                  <td className="py-2.5 text-xs font-semibold text-[#0f172a]">{c.customerName}</td>
                  <td className="py-2.5 font-mono text-xs text-[#475569]">{c.phoneNumber}</td>
                  <td className="py-2.5 text-xs text-[#475569]">{formatDateTime(c.claimedAt)}</td>
                  <td className="py-2.5 font-mono text-xs font-bold tracking-wider text-[#0f172a]">
                    {c.code}
                  </td>
                  <td className="py-2.5">
                    <ClaimStatusBadge status={c.status} />
                  </td>
                  <td className="py-2.5 text-xs text-[#475569]">
                    {c.status === 'sudah_ditukar' && c.redeemedAt ? (
                      formatDateTime(c.redeemedAt)
                    ) : c.status === 'hangus' ? (
                      formatDateTime(c.expiresAt)
                    ) : c.status === 'dibatalkan' && c.cancelledAt ? (
                      <span>
                        {formatDateTime(c.cancelledAt)}
                        {c.cancelReason && (
                          <span className="block text-[11px] text-[#94a3b8]">
                            "{c.cancelReason}"
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[#b45309]">
                        berlaku s/d {formatDateTime(c.expiresAt)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {c.status === 'menunggu' && (
                      <button
                        onClick={() => handleCancel(c)}
                        disabled={cancellingId !== null}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-2 py-1 text-[11px] font-semibold text-[#475569] hover:border-[#fecdd3] hover:text-[#e11d48] disabled:opacity-50"
                      >
                        <Undo2 className="size-3" />
                        {cancellingId === c.id ? 'Membatalkan...' : 'Batalkan'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
