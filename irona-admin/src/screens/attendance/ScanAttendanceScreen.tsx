import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, ScanLine, XCircle } from 'lucide-react';
import { recordAttendanceScan } from '../../services/attendance';

const SCANNER_ID = 'qr-reader';
const COOLDOWN_MS = 15000; // token yang sama diabaikan selama 15 detik

type Feedback =
  | { type: 'success'; name: string; action: 'masuk' | 'pulang'; time: string; note?: string }
  | { type: 'error'; message: string };

function beep(freq: number, duration: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    // abaikan kalau browser tidak mendukung
  }
}

export default function ScanAttendanceScreen() {
  const [now, setNow] = useState(new Date());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;
    let started = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 260, height: 260 } },
        handleScan,
        () => {} // callback error per-frame diabaikan (dipanggil terus saat tidak ada QR di layar)
      )
      .then(() => {
        started = true;
      })
      .catch(() =>
        setCameraError('Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan di browser.')
      );

    return () => {
      // stop() bisa melempar error langsung (bukan Promise reject) kalau start() belum
      // pernah berhasil — jangan panggil stop() sama sekali kalau scanner tidak pernah jalan.
      if (!started) return;
      try {
        scanner.stop().catch(() => undefined);
      } catch {
        // abaikan — scanner memang sudah berhenti/tidak berjalan
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan(decodedText: string) {
    if (processingRef.current) return;

    const lastAt = lastScanRef.current.get(decodedText);
    if (lastAt && Date.now() - lastAt < COOLDOWN_MS) return;

    processingRef.current = true;
    lastScanRef.current.set(decodedText, Date.now());

    try {
      const result = await recordAttendanceScan(decodedText);
      const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      beep(880, 150);
      setFeedback({
        type: 'success',
        name: result.employeeName,
        action: result.action,
        time,
        note:
          result.action === 'masuk' && (result.lateMinutes ?? 0) > 0
            ? `Telat ${result.lateMinutes} menit`
            : result.action === 'pulang' && (result.overtimeMinutes ?? 0) > 0
              ? (result.overtimePendingMinutes ?? 0) > 0
                ? `Lembur ${result.overtimeMinutes} menit (lembur malam menunggu persetujuan admin)`
                : `Lembur ${result.overtimeMinutes} menit`
              : undefined,
      });
    } catch (err: any) {
      beep(220, 300);
      setFeedback({ type: 'error', message: err?.message ?? 'Gagal memproses scan.' });
    } finally {
      setTimeout(() => {
        setFeedback(null);
        processingRef.current = false;
      }, 3500);
    }
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-8 bg-[#0f172a] px-6 py-10 font-['Plus_Jakarta_Sans_Variable',sans-serif] text-white">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.5px]">Absensi Toko Kopi Irona</h1>
        <p className="font-mono text-4xl font-bold tabular-nums">
          {now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </p>
        <p className="text-sm text-[#94a3b8]">
          {now.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      <div className="relative flex size-[340px] items-center justify-center overflow-hidden rounded-3xl border-4 border-white/10 bg-black">
        <div id={SCANNER_ID} className="size-full [&>video]:size-full [&>video]:object-cover" />
        {cameraError && (
          <p className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-[#f43f5e]">
            {cameraError}
          </p>
        )}
        {!cameraError && !feedback && (
          <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-white/40" />
        )}
      </div>

      <p className="flex items-center gap-2 text-sm text-[#94a3b8]">
        <ScanLine className="size-4" />
        Arahkan kartu QR ke kamera untuk absen masuk / pulang
      </p>

      {feedback && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6 ${
            feedback.type === 'success' ? 'bg-[#065f46]/95' : 'bg-[#7f1d1d]/95'
          }`}
        >
          {feedback.type === 'success' ? (
            <>
              <CheckCircle2 className="size-20" />
              <p className="text-3xl font-bold">Selamat datang, {feedback.name}</p>
              <p className="text-xl">
                {feedback.action === 'masuk' ? 'Absen Masuk' : 'Absen Pulang'} · {feedback.time}
              </p>
              {feedback.note && <p className="text-base text-white/80">{feedback.note}</p>}
            </>
          ) : (
            <>
              <XCircle className="size-20" />
              <p className="max-w-md text-center text-xl font-bold">{feedback.message}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
