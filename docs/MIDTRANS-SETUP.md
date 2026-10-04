# Setup Midtrans (Sandbox) untuk Pesanan Online

Panduan ini menyiapkan akun **Midtrans Sandbox** (mode uji coba, tanpa uang sungguhan) supaya pesanan online di Web Customer bisa dibayar dengan **QRIS**.

Aturan bisnis yang dipakai (lihat `docs/ATURAN-BISNIS.md`):

- Pesanan online **selalu** dibayar dengan QRIS lewat Midtrans.
- Batas bayar **15 menit** sejak pesanan dibuat. Lewat batas itu, pesanan jadi *kedaluwarsa*.
- Status "dibayar" hanya diisi oleh **notifikasi (webhook) Midtrans** ke server, tidak pernah oleh browser pelanggan.

---

## 1. Yang perlu disiapkan

| # | Yang disiapkan | Untuk apa | Wajib di sandbox? |
|---|---|---|---|
| 1 | **Email aktif** (disarankan email bisnis toko) | Daftar akun Midtrans | Ya |
| 2 | **Akun Midtrans** (sandbox) | Mengambil Server Key & mengatur webhook | Ya |
| 3 | **Server Key sandbox** (`SB-Mid-server-...`) | Dipakai Edge Function untuk membuat QRIS & mengecek status | Ya |
| 4 | **Merchant ID** & **Client Key** sandbox | Catatan saja; Client Key tidak dipakai di alur QRIS Core API | Catat saja |
| 5 | **Docker Desktop** + Supabase lokal jalan (`npx supabase start`) | Menjalankan database & Edge Function di komputer | Ya |
| 6 | **Akun ngrok** (gratis) + authtoken, atau **cloudflared** | Membuka URL publik ke komputer lokal supaya webhook Midtrans bisa masuk | Ya, untuk uji di lokal |
| 7 | Akses **Doppler** project `toko-kopi-itons` (opsional) | Menyimpan Server Key bersama tim | Opsional |

Untuk **production** nanti (bukan sekarang), siapkan juga:

- KTP pemilik, NPWP, dan nomor rekening bank atas nama usaha atau pemilik.
- Dokumen usaha (NIB, atau surat keterangan usaha).
- Website yang sudah online dengan halaman **Syarat & Ketentuan** dan **Kebijakan Privasi**. Kedua halaman ini sudah ada di Web Customer.
- Pengajuan aktivasi **QRIS** di dashboard production. Proses verifikasi oleh Midtrans biasanya memakan beberapa hari kerja.

---

## 2. Daftar akun Midtrans

1. Buka https://dashboard.midtrans.com/register.
2. Isi email, nama, dan password. Lalu verifikasi lewat email yang dikirim Midtrans.
3. Login di https://dashboard.midtrans.com.
4. Di pojok kiri atas, pastikan mode **Environment = Sandbox**. Ada tombol pilihan *Sandbox / Production*.
   - Dashboard sandbox juga bisa dibuka langsung di https://dashboard.sandbox.midtrans.com.

> Akun sandbox bisa langsung dipakai tanpa verifikasi dokumen. Semua transaksi di sandbox adalah simulasi.

---

## 3. Ambil Access Keys

1. Di dashboard (mode **Sandbox**), buka **Settings › Access Keys**.
2. Catat tiga nilai berikut:

   | Nama | Contoh awalan | Rahasia? |
   |---|---|---|
   | Merchant ID | `G123456789` | Tidak |
   | Client Key | `SB-Mid-client-...` | Tidak (boleh di browser) |
   | **Server Key** | `SB-Mid-server-...` | **Ya, rahasia** |

> **Penting:** Server Key **tidak boleh** ditulis di kode, di-commit ke Git, atau dimasukkan ke variabel `VITE_...`. Variabel `VITE_...` ikut terkirim ke browser pelanggan. Server Key hanya disimpan sebagai *secret* Edge Function (langkah 5).

---

## 4. Cek metode pembayaran QRIS

1. Buka **Settings › Payment** (di beberapa versi dashboard namanya **Payment Channels** atau **Snap Preferences**).
2. Pastikan **QRIS / GoPay** aktif. Di sandbox, metode ini biasanya sudah aktif sejak awal.

Integrasi ini memakai **Core API** dengan `payment_type: "qris"`. Gambar QR ditampilkan langsung di halaman pesanan Web Customer, tanpa popup Snap.

---

## 5. Simpan Server Key sebagai secret Edge Function

### Lokal (Supabase di Docker)

Buat file `irona-backend/supabase/functions/.env`. File ini sudah diabaikan Git lewat aturan `.env*` di `irona-backend/.gitignore`.

```env
MIDTRANS_SERVER_KEY=<SERVER_KEY_DARI_DASHBOARD>
MIDTRANS_IS_PRODUCTION=false
```

Lalu jalankan Edge Function dengan file env tersebut:

```bash
cd irona-backend
npx supabase functions serve --env-file supabase/functions/.env
```

### Pakai Doppler (opsional)

```bash
cd irona-backend
doppler secrets set MIDTRANS_SERVER_KEY=<SERVER_KEY_DARI_DASHBOARD> MIDTRANS_IS_PRODUCTION=false
doppler run -- npx supabase functions serve
```

### Supabase cloud (nanti saat deploy)

```bash
npx supabase secrets set MIDTRANS_SERVER_KEY=<SERVER_KEY_DARI_DASHBOARD> MIDTRANS_IS_PRODUCTION=false
```

---

## 6. Buka URL publik untuk webhook (lokal)

Midtrans tidak bisa mengirim notifikasi ke `127.0.0.1`. Karena itu, buka *tunnel* ke port API Supabase lokal (`54321`).

**Pakai ngrok:**

```bash
ngrok config add-authtoken <authtoken-dari-dashboard-ngrok>
ngrok http 54321
```

Salin URL `https://xxxx.ngrok-free.app` yang muncul.

**Atau pakai cloudflared** (tanpa akun):

```bash
cloudflared tunnel --url http://127.0.0.1:54321
```

> URL ngrok/cloudflared gratis **berubah setiap kali dijalankan ulang**. Setiap URL berubah, ulangi langkah 7.

---

## 7. Atur Payment Notification URL

1. Di dashboard (mode **Sandbox**), buka **Settings › Configuration**. Di dashboard versi baru, menunya ada di **Settings › Payment › Notification URL**.
2. Isi **Payment Notification URL**:

   ```
   https://<url-tunnel>/functions/v1/midtrans-webhook
   ```

   Contoh: `https://ab12-34-56.ngrok-free.app/functions/v1/midtrans-webhook`

3. Kolom *Finish / Unfinish / Error Redirect URL* boleh dikosongkan. Kolom tersebut hanya untuk Snap.
4. Klik **Update** / **Save**.

Endpoint webhook harus membalas **HTTP 200**. Kalau tidak, Midtrans mengirim ulang notifikasi beberapa kali (sekitar 2, 10, 30, 90, lalu 210 menit kemudian).

---

## 8. Ringkasan alamat penting (sandbox)

| Keperluan | Alamat |
|---|---|
| Dashboard sandbox | https://dashboard.sandbox.midtrans.com |
| API charge (buat QRIS) | `POST https://api.sandbox.midtrans.com/v2/charge` |
| API cek status | `GET https://api.sandbox.midtrans.com/v2/{order_id}/status` |
| **Simulator QRIS** (pura-pura bayar) | https://simulator.sandbox.midtrans.com/v2/qris/index |
| Dokumentasi QRIS | https://docs.midtrans.com/reference/qris |
| Dokumentasi webhook | https://docs.midtrans.com/docs/https-notification-webhooks |

Untuk **production**, alamat API berganti ke `https://api.midtrans.com`, Server Key berawalan `Mid-server-...`, dan `MIDTRANS_IS_PRODUCTION=true`.

---

## 9. Cara kerja singkat

```
Pelanggan klik "Bayar dengan QRIS"
  1. Web Customer memanggil Edge Function create-online-order.
  2. Server menghitung ulang harga, ongkir, dan voucher, lalu menyimpan pesanan (status menunggu_pembayaran).
  3. Server memanggil Midtrans /v2/charge (payment_type qris) dan menerima URL gambar QR.
  4. Halaman pesanan menampilkan QR dan hitung mundur 15 menit.
Pelanggan scan QR (di sandbox: pakai Simulator QRIS)
  5. Midtrans mengirim notifikasi ke midtrans-webhook.
  6. Server memeriksa signature_key = SHA512(order_id + status_code + gross_amount + ServerKey).
  7. settlement → pesanan "diproses"; expire/cancel/deny → "kedaluwarsa"/"dibatalkan".
  8. Halaman pesanan mengecek status berkala dan menampilkan "Disiapkan".
```

Panduan uji coba langkah demi langkah ada di `docs/MIDTRANS-UJI-SANDBOX.md`.
