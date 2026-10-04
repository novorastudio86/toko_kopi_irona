import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

// DRAFT: isi belum ditinjau owner/konsultan hukum. Bagian [..] menunggu keputusan bisnis.

interface Section {
  title: string;
  /** Paragraf pembuka (opsional) */
  intro?: string;
  points?: string[];
}

interface LegalDoc {
  path: string;
  label: string;
  title: string;
  lead: string;
  sections: Section[];
}

const UPDATED = '4 Oktober 2026';

const PRIVASI: LegalDoc = {
  path: '/kebijakan-privasi',
  label: 'Kebijakan Privasi',
  title: 'Kebijakan Privasi',
  lead: 'Kami cuma minta data yang dibutuhkan untuk mengantar pesananmu dan mencatat poin Kora Club. Ini penjelasan lengkapnya.',
  sections: [
    {
      title: 'Data yang kami kumpulkan',
      points: [
        'Akun member: email, nama, dan nomor HP/WhatsApp.',
        'Pesanan online: nama penerima, nomor WhatsApp, titik antar di peta beserta perkiraan alamatnya, catatan untuk driver dan kasir, serta isi pesanan.',
        'Riwayat transaksi dan poin Kora Club, termasuk belanja di toko saat kamu menyebut nomor HP ke kasir.',
        'Di perangkatmu sendiri (penyimpanan browser): isi keranjang, daftar pesanan terakhir, dan, kalau kamu mencentangnya, nama, nomor, serta titik antar untuk pesanan berikutnya.',
      ],
    },
    {
      title: 'Untuk apa data dipakai',
      points: [
        'Memproses, menyiapkan, dan mengantar pesanan.',
        'Menghubungimu lewat WhatsApp soal pesanan (mis. driver mencari alamat).',
        'Menghitung ongkir dari jarak rute toko ke titik antar.',
        'Mengirim kode verifikasi ke email saat daftar & reset password, mencatat poin, dan menukar reward.',
        'Memperbaiki layanan dari data pesanan secara keseluruhan (tidak per orang).',
      ],
    },
    {
      title: 'Pihak lain yang terlibat',
      intro: 'Kami tidak menjual data pribadimu. Data hanya dibagikan seperlunya kepada:',
      points: [
        'Driver Irona: nama, nomor WhatsApp, titik antar, dan catatan untuk driver.',
        'Penyedia pembayaran QRIS untuk memproses pembayaran. Kami tidak menyimpan data rekening atau e-wallet-mu.',
        'Penyedia peta dan alamat untuk menampilkan peta, mengenali alamat dari titik, dan menghitung jarak. [Nama penyedia final menyusul.]',
        'Penyedia server dan database tempat data disimpan.',
      ],
    },
    {
      title: 'Berapa lama data disimpan',
      points: [
        'Data akun disimpan selama akunmu aktif atau sampai kamu minta dihapus.',
        'Data transaksi disimpan selama dibutuhkan untuk pembukuan toko. [Durasi menyusul.]',
        'Data di perangkatmu tetap ada sampai kamu menghapus data situs di browser.',
      ],
    },
    {
      title: 'Hak kamu',
      points: [
        'Mengubah nama dan nomor HP sendiri di halaman Membership.',
        'Meminta salinan data atau penghapusan akun lewat admin WhatsApp di bagian bawah situs.',
        'Menolak menyimpan data untuk pesanan berikutnya dengan menghapus centang di checkout.',
      ],
    },
    {
      title: 'Perubahan kebijakan',
      intro:
        'Kebijakan ini bisa diperbarui sewaktu-waktu. Tanggal pembaruan terakhir selalu tertulis di atas halaman ini.',
    },
  ],
};

const SK: LegalDoc = {
  path: '/syarat-ketentuan',
  label: 'Syarat & Ketentuan',
  title: 'Syarat & Ketentuan',
  lead: 'Aturan main saat memesan online dan memakai Kora Club di Toko Kopi Irona.',
  sections: [
    {
      title: 'Pesanan online',
      points: [
        'Pesanan online hanya diantar ke titik yang kamu tentukan di peta, tidak ada ambil sendiri.',
        'Jarak antar dibatasi; batas maksimal tampil di halaman checkout.',
        'Pesanan hanya bisa dibuat selama jam buka pesanan online.',
        'Pastikan titik antar dan nomor WhatsApp benar. Kesalahan data bisa membuat pesanan terlambat atau gagal diantar.',
      ],
    },
    {
      title: 'Harga dan biaya',
      points: [
        'Harga menu mengikuti yang tampil di situs saat checkout.',
        'Ongkir dihitung dari jarak rute toko ke titik antar, ditambah biaya admin per pesanan.',
        'Total yang tampil sebelum bayar adalah jumlah final yang kamu bayar.',
      ],
    },
    {
      title: 'Pembayaran',
      points: [
        'Pembayaran pesanan online hanya lewat QRIS (semua e-wallet dan m-banking).',
        'Pesanan diproses setelah pembayaran terkonfirmasi.',
        'Kode QR punya batas waktu. Lewat dari itu, pesanan batal otomatis.',
      ],
    },
    {
      title: 'Pembatalan dan refund',
      points: [
        'Pesanan yang sudah dibayar tidak bisa dibatalkan sendiri lewat situs.',
        'Kalau ada menu habis atau pesanan tidak bisa diproses, admin akan menghubungimu. Refund mengikuti kebijakan toko. [Prosedur dan lama refund menyusul.]',
      ],
    },
    {
      title: 'Voucher dan promo',
      points: [
        'Setiap voucher dan promo punya syarat sendiri (periode, minimal belanja, hari, dan jam berlaku) yang tertulis di detailnya.',
        'Voucher tidak bisa diuangkan dan tidak bisa digabung di luar aturan yang tertulis.',
        'Irona berhak membatalkan pemakaian promo yang tidak wajar.',
      ],
    },
    {
      title: 'Kora Club',
      points: [
        'Gratis, satu akun untuk satu orang.',
        'Poin dihitung dari harga produk setelah diskon, tidak termasuk ongkir, dan masuk setelah pesanan dibayar.',
        'Pesanan yang direfund, poinnya ditarik kembali.',
        'Kode reward berlaku 1 hari. Lewat dari itu kode hangus dan poin tidak kembali.',
        'Irona berhak menonaktifkan akun yang menyalahgunakan poin atau reward.',
      ],
    },
    {
      title: 'Perubahan ketentuan',
      intro:
        'Ketentuan ini bisa diperbarui sewaktu-waktu. Dengan tetap memesan setelah pembaruan, kamu dianggap menyetujui versi terbaru.',
    },
  ],
};

const DOCS = [PRIVASI, SK];

/** Halaman statis Kebijakan Privasi & S&K. Ditautkan dari footer, checkout, dan pop-up daftar. */
export default function LegalScreen({ doc }: { doc: 'privasi' | 'sk' }) {
  const page = doc === 'privasi' ? PRIVASI : SK;

  return (
    <>
      <title>{`${page.title} | Toko Kopi Irona`}</title>
      <meta name="description" content={page.lead} />

      <section className="border-b border-foreground bg-secondary">
        <div className="mx-auto max-w-page px-4 py-8 md:px-[30px] md:py-12">
          <nav aria-label="Dokumen" className="flex flex-wrap gap-2">
            {DOCS.map((d) => (
              <NavLink
                key={d.path}
                to={d.path}
                className={cn(
                  'rounded-full border border-foreground bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary',
                  'aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
                )}
              >
                {d.label}
              </NavLink>
            ))}
          </nav>
          <h1 className="mt-5 font-display text-[32px] leading-[1.1] md:text-[44px]">
            {page.title}
          </h1>
          <p className="mt-3 max-w-[620px] text-sm leading-6">{page.lead}</p>
          <p className="mt-3 text-[12px] text-muted-foreground">Terakhir diperbarui {UPDATED}</p>
        </div>
      </section>

      <div className="mx-auto max-w-page px-4 py-8 md:px-[30px] md:py-10">
        <p
          role="note"
          className="max-w-[720px] border border-dashed border-foreground px-4 py-3 text-[13px] leading-5"
        >
          <strong>Draf.</strong> Dokumen ini masih rancangan dan belum final. Pertanyaan soal isinya
          bisa ditanyakan ke admin lewat WhatsApp.
        </p>

        <ol className="mt-8 grid max-w-[720px] gap-8">
          {page.sections.map((s, i) => (
            <li key={s.title}>
              <h2 className="flex gap-3 text-lg font-semibold">
                <span className="font-mono text-sm leading-7 text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.title}
              </h2>
              {s.intro && <p className="mt-2 pl-8 text-sm leading-6">{s.intro}</p>}
              {s.points && (
                <ul className="mt-2 grid gap-1.5 pl-8 text-sm leading-6">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-[9px] size-1.5 shrink-0 rounded-full bg-foreground"
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
