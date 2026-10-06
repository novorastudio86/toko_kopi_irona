import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, RefreshCcw, X } from 'lucide-react';
import { fetchEmployeeDetail, regenerateEmployeeQr } from '../../services/employees';
import type { EmployeeDetail } from '../../types/employee';

const CARD_WIDTH = 420;
const CARD_HEIGHT = 560;
const QR_SIZE = 300;

/** Gambar kartu QR utuh (judul, kode QR, nama, kode karyawan) ke satu canvas */
async function buildCardCanvas(fullName: string, code: string, token: string): Promise<HTMLCanvasElement> {
  // QR digambar ke canvas terpisah dulu, lewat canvas yang KITA buat sendiri —
  // menghindari bug qrcode.toDataURL() yang gagal mendeteksi environment di Vite.
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, token, { width: QR_SIZE, margin: 1 });

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung canvas.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('KARTU ABSENSI', CARD_WIDTH / 2, 42);
  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  ctx.fillText('Toko Kopi Irona', CARD_WIDTH / 2, 62);

  // Canvas-ke-canvas, tidak perlu menunggu gambar dimuat
  ctx.drawImage(qrCanvas, (CARD_WIDTH - QR_SIZE) / 2, 90, QR_SIZE, QR_SIZE);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(fullName, CARD_WIDTH / 2, 90 + QR_SIZE + 42);

  ctx.fillStyle = '#475569';
  ctx.font = '14px monospace';
  ctx.fillText(code, CARD_WIDTH / 2, 90 + QR_SIZE + 66);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.fillText('Scan di tablet kasir saat datang & pulang', CARD_WIDTH / 2, CARD_HEIGHT - 22);

  return canvas;
}

type Props = { employeeId: string; onClose: () => void };

export default function EmployeeQrModal({ employeeId, onClose }: Props) {
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmployeeDetail(employeeId);
      if (!data) {
        setError('Karyawan tidak ditemukan.');
        return;
      }
      setDetail(data);
      const canvas = await buildCardCanvas(data.fullName, data.code, data.qrToken);
      setCardUrl(canvas.toDataURL('image/png'));
    } catch (err: any) {
      setError(err?.message ?? 'Gagal membuat kartu QR.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleDownload() {
    if (!cardUrl || !detail) return;
    const a = document.createElement('a');
    a.href = cardUrl;
    a.download = `QR-${detail.code}-${detail.fullName.replace(/\s+/g, '-')}.png`;
    a.click();
  }

  function handlePrint() {
    if (!cardUrl) return;
    const win = window.open('', '_blank', 'width=480,height=680');
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>Cetak Kartu Absensi</title></head>
        <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;">
          <img src="${cardUrl}" style="max-width:100%;" onload="window.print()" />
        </body>
      </html>
    `);
    win.document.close();
  }

  async function handleRegenerate() {
    if (!detail) return;
    if (
      !window.confirm(
        `Buat ulang QR untuk "${detail.fullName}"? Kartu QR lama tidak akan berlaku lagi setelah ini.`
      )
    ) {
      return;
    }
    setRegenerating(true);
    setError(null);
    try {
      await regenerateEmployeeQr(detail.id);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal membuat ulang QR.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-5 pb-4 pt-4">
          <div>
            <h2 className="text-sm font-bold text-[#0f172a]">Kartu QR Absensi</h2>
            <p className="text-xs text-[#64748b]">{detail?.fullName ?? 'Memuat...'}</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 px-5 py-5">
          {loading ? (
            <p className="py-16 text-xs text-[#94a3b8]">Membuat kartu QR...</p>
          ) : error ? (
            <p className="w-full rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
              {error}
            </p>
          ) : (
            cardUrl && (
              <img
                src={cardUrl}
                alt="Kartu QR absensi"
                className="w-full max-w-[280px] rounded-xl border border-[#e2e8f0]"
              />
            )
          )}

          {!loading && !error && (
            <div className="flex w-full gap-2">
              <button
                onClick={handleDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#cbd5e1] bg-white py-2.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
              >
                <Download className="size-3.5" />
                Unduh
              </button>
              <button
                onClick={handlePrint}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f172a] py-2.5 text-xs font-semibold text-white hover:bg-[#1e293b]"
              >
                <Printer className="size-3.5" />
                Cetak
              </button>
            </div>
          )}

          {!loading && !error && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-xs font-medium text-[#94a3b8] hover:text-[#e11d48] disabled:opacity-60"
            >
              <RefreshCcw className="size-3" />
              {regenerating ? 'Membuat ulang...' : 'Buat Ulang QR (kartu lama hangus)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}