import { useEffect, useState } from 'react';

/**
 * Toast kecil saat pengunjung mencoba order ketika toko tutup; hilang sendiri setelah 3 detik.
 * `shownAt` diganti tiap klik (Date.now()) supaya timer mulai ulang.
 * TODO: ganti dengan pop-up interaktif Kora + maskot yang sedang tidur.
 */
export default function ClosedNotice({
  message,
  shownAt,
}: {
  message: string;
  shownAt: number | null;
}) {
  const [hiddenAt, setHiddenAt] = useState<number | null>(null);

  useEffect(() => {
    if (shownAt === null) return;
    const timer = setTimeout(() => setHiddenAt(shownAt), 3000);
    return () => clearTimeout(timer);
  }, [shownAt]);

  // role="status" selalu ada di DOM supaya perubahan isinya diumumkan screen reader
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
    >
      {shownAt !== null && hiddenAt !== shownAt && (
        <p className="rounded-[6px] border border-foreground bg-primary px-3.5 py-2 text-xs text-primary-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
