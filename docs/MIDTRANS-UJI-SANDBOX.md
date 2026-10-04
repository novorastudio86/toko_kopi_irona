# Tutorial Uji Coba Pembayaran QRIS (Midtrans Sandbox)

Tutorial ini menguji alur lengkap pesanan online di komputer lokal:
checkout → QRIS muncul → bayar lewat simulator → status "Disiapkan" → transaksi muncul di Web Admin.

Kerjakan dulu `docs/MIDTRANS-SETUP.md` sampai langkah 3 (akun sandbox dan Server Key).

---

## Komponen yang terlibat

| Bagian | File | Tugas |
|---|---|---|
| Migration | `irona-backend/supabase/migrations/20261004000000_online_orders_midtrans.sql` | Tabel `online_orders`, menu publik, `settle_online_order`, `get_online_order` |
| Edge Function | `irona-backend/supabase/functions/create-online-order` | Hitung ulang harga & ongkir, simpan pesanan, minta QRIS ke Midtrans |
| Edge Function | `irona-backend/supabase/functions/midtrans-webhook` | Terima notifikasi Midtrans, cek `signature_key`, tandai lunas / kedaluwarsa |
| Edge Function | `irona-backend/supabase/functions/online-order-status` | Status untuk halaman pesanan; selama belum lunas ikut cek status ke Midtrans (cadangan webhook) |
| Web Customer | `irona-customer/src/services/onlineOrder.ts`, `products.ts`, `categories.ts` | Baca menu dari Supabase, kirim checkout, cek status |

---

## Langkah 1: Jalankan Supabase lokal dan migration

```bash
cd irona-backend
npx supabase start          # kalau belum jalan
npx supabase migration up   # menerapkan migration online_orders_midtrans
```

> `npx supabase db reset` juga bisa dipakai. Tapi perintah itu **menghapus semua data lokal** dan mengisi ulang dari seed.

---

## Langkah 2: Isi Server Key dan jalankan Edge Function

Buat file `irona-backend/supabase/functions/.env` (sudah diabaikan Git):

```env
MIDTRANS_SERVER_KEY=<SERVER_KEY_DARI_DASHBOARD>
MIDTRANS_IS_PRODUCTION=false
```

Jalankan di terminal terpisah, dan biarkan tetap terbuka:

```bash
cd irona-backend
npx supabase functions serve --env-file supabase/functions/.env
```

---

## Langkah 3: Buka tunnel dan pasang Notification URL

> **Opsional untuk uji lokal.** Tanpa ngrok, status tetap berubah jadi lunas karena halaman pesanan ikut mengecek status langsung ke Midtrans (`online-order-status`). Tunnel tetap perlu untuk menguji webhook itu sendiri (skenario C & D) dan wajib ada di production.

Di terminal lain:

```bash
ngrok http 54321
```

Salin URL `https://....ngrok-free.app`. Di dashboard Midtrans sandbox, buka **Settings › Configuration**, lalu isi **Payment Notification URL**:

```
https://<url-ngrok>/functions/v1/midtrans-webhook
```

Lalu simpan. Cek cepat dari terminal (harus membalas `Signature tidak valid.`, artinya endpoint bisa dijangkau):

```bash
curl -X POST https://<url-ngrok>/functions/v1/midtrans-webhook -d '{"order_id":"x"}'
```

---

## Langkah 4: Siapkan data menu dan jam buka (Web Admin)

Web Customer hanya menampilkan menu yang memenuhi semua syarat ini:

1. **Produk & Menu › Daftar Kategori**: kategori diaktifkan untuk **Online**.
2. **Produk & Menu › Daftar Produk**: produk **aktif**, **tersedia online**, dan punya **harga jual**.
3. **Penjualan › Order Online › Jeda Tayang Online**: produk tidak sedang dijeda.

Checkout juga ditolak server kalau toko online tutup. Di **Penjualan › Jam Buka**, pastikan kanal **Online** buka pada hari dan jam kamu menguji.

Cek cepat lewat SQL:

```bash
docker exec -it supabase_db_irona-backend psql -U postgres -c "select name, price from online_menu_products();"
docker exec -it supabase_db_irona-backend psql -U postgres -c "select is_store_open('online');"
```

---

## Langkah 5: Jalankan Web Customer

Web Customer sekarang butuh 2 variabel env. Nilainya sama dengan Web Admin:

| Nama | Isi lokal |
|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` |
| `VITE_SUPABASE_ANON_KEY` | `ANON_KEY` dari `npx supabase status -o env` |

Simpan di Doppler, atau buat file `irona-customer/.env.local` (sudah diabaikan Git):

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

```bash
cd irona-customer
npm install
npm run dev
```

---

## Langkah 6: Skenario uji

### A. Bayar sukses

1. Buka Web Customer, tambahkan 1–2 menu ke keranjang, lalu buka **Checkout**.
2. Pilih titik antar di peta. Titik harus dalam jangkauan (maks. 11 km dari toko). Isi nama dan nomor WhatsApp, misalnya `081234567890`.
3. Klik **Bayar dengan QRIS**. Halaman pesanan menampilkan **gambar QR asli dari Midtrans** dan hitung mundur 15 menit.
4. Klik **Salin URL QR**. Tombol ini hanya muncul di mode sandbox.
5. Buka https://simulator.sandbox.midtrans.com/v2/qris/index, tempel URL tadi, lalu ikuti tombol scan dan bayar di simulator.
6. Dalam beberapa detik, halaman pesanan berubah ke **Disiapkan**. Halaman mengecek status tiap 5 detik.

**Cek hasil:**

- Di dashboard Midtrans, buka **Transactions**: status `settlement`.
- Di terminal `functions serve`, tidak ada error.
- Di database:

  ```bash
  docker exec -it supabase_db_irona-backend psql -U postgres -c "select code, status, midtrans_status, total, transaction_id from online_orders order by created_at desc limit 5;"
  ```

- Di Web Admin: **Laporan Penjualan › Laporan Penjualan Online** dan **Laporan Cash Flow › Saldo Online** menampilkan transaksi dengan nomor `IRN-XXXXXX`. Status saldonya **Tertahan**.

### B. Waktu bayar habis

1. Buat pesanan baru, tapi jangan dibayar.
2. Setelah 15 menit, halaman menampilkan **Waktu bayar habis**.
3. Midtrans mengirim notifikasi `expire`, lalu `online_orders.status` menjadi `kedaluwarsa`.

> Tidak mau menunggu 15 menit? Batalkan transaksi dari dashboard Midtrans (**Transactions › pilih transaksi › Cancel**). Status pesanan menjadi `dibatalkan`.

### C. Notifikasi palsu ditolak

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/midtrans-webhook \
  -H 'content-type: application/json' \
  -d '{"order_id":"00000000-0000-0000-0000-000000000000","status_code":"200","gross_amount":"1000.00","signature_key":"palsu","transaction_status":"settlement"}'
```

Hasil yang benar: `Signature tidak valid.` dengan HTTP 401.

### D. Kirim ulang notifikasi (idempoten)

Di dashboard Midtrans, buka detail transaksi yang sudah `settlement`. Lalu kirim ulang notifikasi (**Resend notification**, kalau tersedia). Hasil yang benar: tidak muncul transaksi ganda di Laporan.

---

## Masalah yang sering muncul

| Gejala | Penyebab & solusi |
|---|---|
| Menu kosong di Web Customer | Belum ada kategori atau produk online (langkah 4), atau `.env.local` belum diisi |
| "Pesanan online sedang tutup." | Jam Buka kanal Online sedang tutup (langkah 4) |
| "Gagal membuat QRIS. Coba lagi sebentar." | Server Key salah/kosong, atau `functions serve` dijalankan tanpa `--env-file`. Lihat log terminal: `midtrans charge gagal 401` berarti Server Key salah |
| QR muncul, simulator sukses, tapi status tidak berubah | Halaman pesanan harus tetap terbuka (status dicek tiap 5 detik). Kalau tetap tidak berubah, lihat error di terminal `functions serve`. Untuk webhook: cek Notification URL & ngrok di http://127.0.0.1:4040 |
| Webhook membalas 401 | Server Key di `.env` berbeda dengan akun yang dipakai untuk membuat QRIS |
| "Ada menu yang sudah tidak tersedia" | Produk dijeda atau dimatikan setelah masuk keranjang. Muat ulang halaman |

---

## Batasan versi ini

- **Voucher belum aktif.** Server selalu memakai diskon 0, dan tombol voucher disembunyikan. Voucher disambung ke tabel `promotions` di tahap berikutnya.
- Tab "Pilihan Kora" menampilkan semua menu, karena belum ada kolom `is_recommended`. Status "habis" juga belum ada sumber datanya.
- Stok bahan belum dipotong saat pesanan online lunas. Pemotongan stok ikut alur Kasir.
- Pesanan yang sudah lunas berstatus `diproses`. Perubahan ke `diantar`/`selesai` menunggu aplikasi Kasir/Driver.
