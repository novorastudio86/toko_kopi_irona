# Aturan Bisnis Toko Kopi Irona

Ringkasan keputusan yang sudah disepakati dengan owner selama pengembangan Web Admin.
Kalau PRD (Google Sheet "Masterlink_IronaKopi", tab **Fix PRD-WA**) berbeda dengan dokumen ini, **dokumen ini yang berlaku** karena berisi keputusan terbaru.

Poin bertanda *(sementara)* masih default dan bisa direvisi owner.

---

## Arsitektur

- 4 aplikasi, **1 backend Supabase**: Web Admin (repo ini), Web Customer, dan aplikasi Kasir + Driver (satu aplikasi React Native, pilih peran saat login).
- Login karyawan memakai username. Di Supabase Auth, username menjadi email `username@irona.internal`.
- Role: `admin` (Admin/Owner, satu role yang sama), `kasir`, `driver`, `staf` (Barista, tanpa login, hanya presensi QR).
- Halaman scan QR presensi `/absensi` di Web Admin **hanya untuk testing**; nanti scanner pindah ke aplikasi Kasir.

## Karyawan, shift, lembur

- Jam toko normal 08:00–23:00. Shift Pagi 08–16, Shift Sore 16–23.
- **Tarif per jam** = gaji pokok ÷ total jam kerja terjadwal sebulan (hanya jam di dalam 08:00–23:00).
- **Bonus lembur** = tarif per jam × jam lembur, dihitung **per menit** (tarif per menit = tarif per jam ÷ 60).
- Yang dihitung lembur:
  - **Lembur malam**: pulang lewat jam tutup, khusus shift penutup (Sore). **Wajib disetujui admin** di Presensi (setujui penuh / sebagian / tolak) sebelum dibayar.
  - **Lembur pagi**: kerja sebelum jam 08:00 karena **Jam Khusus** buka lebih pagi. Otomatis disetujui.
- Shift Pagi yang pulang lewat 16:00 **bukan lembur**, kecuali admin menambahkan Shift 2 di tanggal itu.
- **Shift 2** (double shift) dibayar sebagai bonus dan tidak masuk hitungan jam terjadwal.
- Telat hanya dicatat, tidak memotong gaji.

## Kasbon

- Kasbon = uang muka gaji: **dipotong sekaligus dari gaji bulan yang sama** dengan tanggal pengajuan (tanpa cicilan).
- Di Keuangan, kasbon dicatat keluar dari Fixed Cost **saat diberikan**; pembayaran gaji dicatat **bersih** (sudah dipotong kasbon). Pelunasan tunai dicatat masuk kembali.

## Pelanggan & poin

- Poin dihitung dari nilai produk setelah diskon (tanpa ongkir/biaya layanan), dengan tingkatan **greedy**: pakai tingkat terbesar berulang kali. Contoh: tingkat 10rb = 1 dan 30rb = 5 → Rp50.000 = 30rb + 10rb + 10rb = 7 poin.
- Sisa ≥ batas pembulatan (default Rp5.000) dihitung 1 tingkat terkecil lagi.
- Reward hanya berupa **produk gratis** untuk N poin. Voucher diskon/ongkir ada di Promosi › Diskon.

## Diskon & ongkir

- Diskon mengikuti PRD: channel Offline **atau** Online; untuk online bisa memotong harga produk atau ongkir; target Semua/Member; minimal pembelian wajib.
- Dalam satu transaksi hanya **1 diskon** yang dipakai (potongan terbesar); berlaku kelipatan.
- **Ongkir** (semua angka diatur admin di Penjualan › Order Online):
  - Tidak ada radius gratis; dihitung dari 0 km.
  - Tiap kelipatan penuh (default 2 km) × tarif per kelipatan (default Rp5.000), ditambah sisa jarak per 100 m × tarif per 100 m (default Rp500, dibulatkan ke atas).
  - Di atas jarak maksimal (default 11 km), pesanan antar ditolak.
- Gratis/potongan ongkir hanya lewat Promosi › Diskon.

## Transaksi & pembayaran

- Metode bayar hanya **Tunai** dan **QRIS**. Pesanan online selalu QRIS lewat payment gateway (Midtrans).
- Tidak ada pajak (PB1) di transaksi.
- Nama pelanggan: non-member diketik kasir; member cukup nomor HP, nama terisi otomatis.
- `transactions.total_amount` = **nilai produk setelah diskon**. Total dibayar pelanggan = total_amount + ongkir + biaya layanan.
- **Refund** selalu 1 transaksi utuh.
  - "Salah order" (belum dibuat) mengembalikan stok bahan.
  - Untuk member, poin dan total belanjanya ikut ditarik.
- **Try & Error** hanya memotong stok bahan. Biayanya = cost per porsi di Master Resep × porsi; untuk racikan baru, add cost terkunci 10%.
- Semua catatan penyesuaian bersifat final (tidak bisa diubah/dihapus).

## Keuangan (Cash Flow)

Cash Flow adalah **pencatatan/pelacakan**, bukan pemindahan uang sungguhan. Saldo boleh minus.

- **Pembagian**: setiap transaksi dibagi dari **Penjualan Bersih** ke **HPP 40% · Fixed Cost 30% · Net Profit 30%**.
  - Penjualan Bersih = nilai produk setelah diskon − porsi MDR untuk produk.
  - MDR hanya untuk pesanan online via Midtrans: 0,7% + PPN 11% dari MDR, dihitung dari total yang dibayar.
- *(sementara)* **Ongkir & biaya layanan** dipisah: tidak ikut penjualan maupun pembagian 40/30/30.
- **HPP**
  - Pengeluaran: belanja bahan baku (Stok Masuk). Produksi racikan tidak dicatat.
  - 80% = batas belanja bahan per bulan (lewat batas hanya diberi peringatan).
  - 20% = **Saldo Mengendap** (cadangan operasional). Sisa batas belanja yang tidak terpakai masuk ke sini saat ganti bulan.
- **Fixed Cost**: gaji, kasbon, pengeluaran lain, biaya Try & Error.
- **Net Profit** dibagi per bulan: **BEP 50% · Owner 25% · Manager 25%**.
  - Pembelian aset memotong BEP.
  - Kalau BEP kurang, Owner yang menanggung; kalau BEP lebih, sisanya masuk ke Owner. Manager tidak terpengaruh.
- **Refund** membalik pembagian 40/30/30 secara proporsional.
- **Saldo Online (Midtrans)**:
  - Tertahan → **Tersedia** 3 hari kerja setelah settlement (Sabtu, Minggu, dan tanggal libur tidak dihitung).
  - → **Dicairkan**, dicatat admin sekaligus per pencairan.
- **Tutup buku otomatis**: begitu ganti bulan, data bulan lalu terkunci (hanya bisa dilihat).
  - Admin/Owner bisa **Buka Kembali** dengan alasan, lalu **Tutup Kembali**. Semuanya tercatat di riwayat.
  - Yang dikunci: transaksi, refund, stok, try & error, kasbon, pengeluaran, aset (Ubah Status aset tetap boleh), pencairan online.

## Dashboard & laporan

- *(sementara)* Grafik penjualan kumulatif, dibandingkan dengan periode sebelumnya sampai titik waktu yang sama.
- *(sementara)* Target penjualan harian & bulanan diatur dari Dashboard; target mingguan = harian × 7.
- Laporan bisa diekspor ke **Excel (.xlsx)**.
- Penjualan per Kasir hanya menampilkan karyawan dengan role Kasir.
- Laba Kotor = Penjualan Bersih (setelah refund) − biaya gateway porsi produk.
