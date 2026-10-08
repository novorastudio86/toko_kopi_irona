# Toko Kopi Irona

Sistem manajemen untuk Toko Kopi Irona. Repo ini berisi:

| Folder | Isi |
|---|---|
| `irona-admin/` | **Web Admin**: React 19 + Vite + TypeScript + Tailwind, dipakai Owner/Admin |
| `irona-backend/` | **Backend Supabase**: migrasi database PostgreSQL, seed data, edge functions, script data dummy |
| `irona-customer/` | **Web Customer**: pesan online & member Kora Club (http://localhost:5174, lihat `irona-customer/README.md`) |

Aplikasi Kasir + Driver (React Native) memakai backend Supabase yang sama.

---

## Daftar isi

1. [Yang perlu di-install](#1-yang-perlu-di-install)
2. [Clone repo](#2-clone-repo)
3. [Jalankan backend (Supabase di Docker)](#3-jalankan-backend-supabase-di-docker)
4. [Atur environment variable (Doppler)](#4-atur-environment-variable-doppler)
5. [Jalankan Web Admin](#5-jalankan-web-admin)
6. [Login pertama kali](#6-login-pertama-kali)
7. [Isi data contoh (opsional)](#7-isi-data-contoh-opsional)
8. [Perintah sehari-hari](#8-perintah-sehari-hari)
9. [Email kode OTP member (Resend)](#9-email-kode-otp-member-resend)
10. [Mengubah database (migrasi)](#10-mengubah-database-migrasi)
11. [Git: menyimpan & mengirim perubahan](#11-git-menyimpan--mengirim-perubahan)
12. [Masalah yang sering muncul](#12-masalah-yang-sering-muncul)
13. [Struktur folder](#13-struktur-folder)

---

## 1. Yang perlu di-install

| Alat | Versi | Cara install / cek |
|---|---|---|
| **Git** | terbaru | `git --version` |
| **Node.js** | 20 atau lebih baru (proyek ini dikembangkan dengan v24) | https://nodejs.org → cek `node -v` |
| **Docker Desktop** | terbaru | https://www.docker.com/products/docker-desktop → buka aplikasinya sampai statusnya *running* |
| **Doppler CLI** | terbaru | macOS: `brew install dopplerhq/cli/doppler` · lainnya: https://docs.doppler.com/docs/install-cli |

> Supabase CLI **tidak perlu di-install global**: sudah ada sebagai dependensi di `irona-backend`, dipanggil lewat `npx supabase ...`.
> `psql` juga tidak perlu di-install; semua perintah SQL dijalankan lewat `docker exec` (lihat bagian 8).

---

## 2. Clone repo

```bash
git clone https://github.com/novorastudio86/toko_kopi_irona.git
cd toko_kopi_irona
```

---

## 3. Jalankan backend (Supabase di Docker)

Pastikan **Docker Desktop sudah jalan**, lalu:

```bash
cd irona-backend
npm install
doppler run --project toko-kopi-irona --config dev -- npx supabase start
```

> Supabase dinyalakan **lewat Doppler** supaya `RESEND_API_KEY` ikut terbaca untuk mengirim email kode OTP member (lihat [bagian 9](#9-email-kode-otp-member-resend)). Belum punya akses Doppler? Lihat bagian 9 untuk cara memakai Mailpit saja.

Pertama kali, perintah ini mengunduh image Docker Supabase (bisa beberapa menit), lalu otomatis:

- menjalankan **semua migrasi** di `supabase/migrations/` (urut sesuai nama file),
- mengisi **seed** dari `supabase/seed.sql`: role, akun admin awal, satuan, bahan baku, kategori, produk & resep.

Setelah selesai, akan muncul daftar alamat lokal:

| Layanan | Alamat |
|---|---|
| API Supabase | http://127.0.0.1:54321 |
| **Studio** (lihat/edit tabel lewat browser) | http://127.0.0.1:54323 |
| Mailpit (email lokal, hanya terpakai kalau SMTP Resend dimatikan) | http://127.0.0.1:54324 |
| Database Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Untuk melihat kunci API lokal (dipakai di langkah 4):

```bash
npx supabase status -o env
```

Catat nilai **`API_URL`** dan **`ANON_KEY`**.

> Kunci Supabase **lokal** sama untuk semua orang (kunci demo bawaan Supabase CLI) dan hanya berlaku di komputer masing-masing. Kunci **production** jangan pernah ditulis di kode atau di-commit.

---

## 4. Atur environment variable (Doppler)

Web Admin butuh 2 variabel:

| Nama | Isi untuk lokal |
|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` (nilai `API_URL`) |
| `VITE_SUPABASE_ANON_KEY` | nilai `ANON_KEY` dari `npx supabase status -o env` |

Proyek ini menyimpan env di **Doppler** (tidak ada file `.env` di repo).

### Pilihan A: pakai Doppler (disarankan untuk tim)

1. Minta pemilik proyek mengundang kamu ke workplace Doppler (project **`toko-kopi-irona`**, config **`dev`**).
2. Login dan hubungkan folder:

   ```bash
   doppler login
   cd irona-admin
   doppler setup      # pilih project toko-kopi-irona → config dev
   cd ../irona-backend
   doppler setup      # pilih project & config yang sama
   ```

3. Pastikan 2 variabel di atas ada di Doppler (`doppler secrets` untuk melihat).

> Belum diundang ke Doppler tim? Kamu bisa membuat project Doppler sendiri (gratis) di https://dashboard.doppler.com, isi 2 variabel di atas, lalu `doppler setup` ke project itu.

### Pilihan B: tanpa Doppler (paling cepat untuk coba-coba)

Buat file `irona-admin/.env.local`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=isi-dengan-ANON_KEY-dari-supabase-status
```

File `*.local` sudah masuk `.gitignore`, jadi tidak akan ikut ter-commit.

---

## 5. Jalankan Web Admin

```bash
cd irona-admin
npm install
```

Lalu jalankan dev server:

```bash
# Pilihan A (Doppler)
doppler run -- npm run dev

# Pilihan B (.env.local)
npm run dev
```

Buka http://localhost:5173

Port tiap app sudah dikunci supaya bisa dijalankan bersamaan tanpa bentrok:

| App | Alamat |
|---|---|
| Web Admin | http://localhost:5173 |
| Web Customer | http://localhost:5174 |
| Supabase (API / DB / Studio / Mailpit) | 54321 / 54322 / 54323 / 54324 |

Kalau muncul error `Port 517x is already in use`, berarti app itu sudah jalan di terminal lain.

---

## 6. Login pertama kali

Seed membuat 1 akun Admin/Owner **khusus untuk lokal**:

| Username | Password |
|---|---|
| `owner1` | `TestPass123!` |

Username diubah otomatis menjadi email `owner1@irona.internal` di Supabase Auth.
Akun karyawan lain dibuat dari menu **Karyawan › Daftar Karyawan** (lewat edge function `create-employee`).

> ⚠️ Password ini hanya untuk development. Di server production, buat akun admin baru dengan password kuat dan jangan pakai seed ini.

---

## 7. Isi data contoh (opsional)

Supaya dashboard, laporan, dan keuangan langsung ada isinya, jalankan script di `irona-backend/supabase/dev-data/` **berurutan** (dari folder `irona-backend`):

```bash
# 1. 10 member + transaksinya (nomor transaksi DUMMY-…)
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_pelanggan.sql

# 2. ±900 transaksi harian, belanja bahan, gaji, pengeluaran, aset, pencairan Midtrans (DUMMY-KEU-…)
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_keuangan.sql

# 3. Lengkapi pesanan online dummy dengan jarak, ongkir, biaya layanan, alamat, driver
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_pesanan_online.sql

# 4. Sesi login–logout kasir (Laporan Pendapatan Kasir & Jam Operasional)
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_sesi_kasir.sql

# 5. Klaim reward member (Laporan Redeem Point)
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_redeem.sql

# 6. Penyesuaian stok bahan baku (Laporan Penyesuaian Stok)
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_penyesuaian_stok.sql

# 7. Pemakaian bahan dari penjualan dummy + stok awal (Perputaran Stok, kolom Terjual di Kelola Stok)
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_pemakaian_stok.sql

# 8. PIN uji untuk karyawan Kasir/Driver yang belum punya PIN (lihat isi file untuk PIN-nya)
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_pin_karyawan.sql

# 9. 4 pesanan online BARU hari ini (2 member, 2 tamu) untuk mencoba menu Online di Kasir App.
#    Boleh dijalankan berkali-kali; tiap kali menambah 4 pesanan.
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_online_masuk.sql

# 10. Absenkan driver + tugaskan 3 pesanan contoh ke driver (1 Dibuat, 2 Siap Diantar)
#     untuk mencoba Driver App. Butuh pesanan "masuk" dari langkah 9.
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_antaran_driver.sql
```

Untuk **menghapus** data contoh (urutannya penting):

```bash
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_online_masuk_hapus.sql
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_pemakaian_stok_hapus.sql
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_penyesuaian_stok_hapus.sql
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_redeem_hapus.sql
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_sesi_kasir_hapus.sql
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_keuangan_hapus.sql
docker exec -i supabase_db_irona-backend psql -U postgres < supabase/dev-data/dummy_pelanggan_hapus.sql
```

---

## 8. Perintah sehari-hari

Jalankan dari folder `irona-backend`:

| Tujuan | Perintah |
|---|---|
| Menyalakan Supabase | `doppler run --project toko-kopi-irona --config dev -- npx supabase start` |
| Mematikan Supabase (data tetap tersimpan) | `npx supabase stop` |
| Melihat alamat & kunci lokal | `npx supabase status` |
| Menjalankan SQL | `docker exec supabase_db_irona-backend psql -U postgres -c "select count(*) from transactions"` |
| Menjalankan file SQL | `docker exec -i supabase_db_irona-backend psql -U postgres < file.sql` |
| Backup data (sebelum ubah database) | `docker exec supabase_db_irona-backend pg_dump -U postgres --data-only -n public postgres > backup_sebelum_xxx.sql` |
| ⚠️ Reset total database | `npx supabase db reset`: **menghapus semua data**, lalu menjalankan ulang migrasi + seed |

Dari folder `irona-admin`:

| Tujuan | Perintah |
|---|---|
| Dev server | `doppler run -- npm run dev` |
| Cek tipe TypeScript | `npx tsc -p tsconfig.app.json --noEmit` |
| Cek lint | `npm run lint` |
| Rapikan format kode | `npm run format` |
| Build production | `doppler run -- npm run build` |

---

## 9. Email kode OTP member (Resend)

Member Web Customer wajib memverifikasi email dengan **kode 6 angka** (berlaku 10 menit). Kode lupa password juga dikirim lewat email. Emailnya dikirim Supabase Auth lewat **SMTP Resend** atas nama **Toko Kopi Irona `<noreply@tokokopiirona.com>`**.

```
Web Customer → Supabase Auth → (SMTP) → Resend → kotak masuk member
```

### Di mana pengaturannya

| Yang diatur | Lokasi |
|---|---|
| SMTP Resend, alamat pengirim, batas 30 email/jam | `irona-backend/supabase/config.toml` → `[auth.email.smtp]`, `[auth.rate_limit]` |
| Masa berlaku kode, wajib verifikasi email | `config.toml` → `[auth.email]` (`enable_confirmations`, `otp_expiry`) |
| Tampilan email (Bahasa Indonesia) | `irona-backend/supabase/templates/confirmation.html` & `recovery.html` |
| Logo & maskot di email | `irona-customer/public/email/` (diambil lewat `{{ .SiteURL }}`) |
| API key Resend | **Doppler** → `RESEND_API_KEY` (project `toko-kopi-irona`, config `dev`) |

`config.toml` hanya berisi `pass = "env(RESEND_API_KEY)"`. **Key asli tidak boleh ditulis di file mana pun yang ikut ter-commit.**

### Wajib: nyalakan Supabase lewat Doppler

```bash
cd irona-backend
npx supabase stop
doppler run --project toko-kopi-irona --config dev -- npx supabase start
```

Kalau dinyalakan dengan `npx supabase start` biasa, `RESEND_API_KEY` kosong dan daftar member gagal dengan pesan *"Email kode gagal dikirim"*. Setiap kali mengubah `config.toml` atau template email, Supabase perlu di-restart dengan cara di atas.

### Tidak punya akses Doppler? Pakai Mailpit

Untuk uji lokal tanpa Resend, ubah sementara di `config.toml`:

```toml
[auth.email.smtp]
enabled = false
```

lalu `npx supabase stop` dan `npx supabase start`. Semua email kode akan tertangkap di **Mailpit** (http://127.0.0.1:54324), bukan dikirim ke email sungguhan. **Jangan commit** perubahan `enabled = false` ini.

### Domain pengirim

- Domain **tokokopiirona.com** (dibeli & DNS-nya dikelola di Rumahweb) sudah diverifikasi di Resend (region Tokyo), jadi email bisa dikirim ke **alamat siapa pun**.
- Record DNS yang dipasang di Rumahweb untuk Resend: TXT `resend._domainkey` (DKIM), CNAME `rsend` & `send` (SPF), TXT `_dmarc` (DMARC). **Jangan dihapus**, nanti email ditolak.
- Kalau domain belum terverifikasi dan pengirim masih `onboarding@resend.dev`, Resend hanya mau mengirim ke email pemilik akun Resend (error *"You can only send testing emails to your own email address"*).

### Catatan

- **Logo belum tampil di Gmail selama lokal.** Gambar email diambil dari `localhost:5174`, yang tidak bisa diakses server Gmail. Gambar akan muncul setelah Web Customer di-deploy dan `site_url` diganti ke domain asli.
- **Email awal bisa masuk Spam/Promosi** karena domain masih baru. Tandai "Bukan spam".
- **Rotasi key.** Kalau API key Resend sempat terlihat (screenshot, chat, riwayat terminal): hapus key itu di resend.com/api-keys, buat yang baru (*Sending access*), lalu simpan ke Doppler tanpa menampilkannya di layar:
  ```bash
  pbpaste | doppler secrets set RESEND_API_KEY --project toko-kopi-irona --config dev
  ```
- **Alur pendaftaran.** Akun member (`customers`) baru dibuat setelah kode benar. Kalau nomor HP sudah terdaftar lewat kasir dan belum punya akun, akunnya otomatis disambungkan dan poinnya ikut. Akun karyawan tidak bisa masuk ke Web Customer.

---

## 10. Mengubah database (migrasi)

Semua perubahan struktur database **wajib lewat file migrasi**, jangan edit tabel langsung di Studio.

```bash
cd irona-backend

# 1. Backup data dulu
docker exec supabase_db_irona-backend pg_dump -U postgres --data-only -n public postgres > backup_sebelum_fitur_x.sql

# 2. Buat file migrasi baru (</dev/null supaya CLI tidak menunggu input)
npx supabase migration new nama_fitur </dev/null

# 3. Tulis SQL di file baru: supabase/migrations/<timestamp>_nama_fitur.sql

# 4. Terapkan ke database lokal
npx supabase migration up
```

Aturan penting saat menulis SQL (lihat juga `docs/ATURAN-BISNIS.md`):

- **`UPDATE`/`DELETE` wajib pakai `WHERE`.** Supabase memasang `pg_safeupdate` untuk request dari aplikasi; tanpa `WHERE` akan error *"UPDATE requires a WHERE clause"*. Untuk tabel pengaturan satu baris (`id boolean`), pakai `where id`.
- **Tutup buku bulanan.** Data transaksi/keuangan di bulan yang sudah lewat dikunci trigger database. Script yang sengaja menulis data bertanggal lampau (seed, data dummy, backfill di migrasi) harus diawali:
  ```sql
  set local irona.bypass_period_lock = 'on';   -- di dalam begin; ... commit;
  ```
- **Hak akses.** Tabel baru wajib `enable row level security` + policy (biasanya `is_admin()`).
- File `backup_*.sql` di `irona-backend/` **tidak ikut ke GitHub** (sudah di `.gitignore`), karena berisi salinan data.

---

## 11. Git: menyimpan & mengirim perubahan

```bash
git pull                          # ambil perubahan terbaru dulu
git add -A
git commit -m "jelaskan perubahan"
git push
```

Kalau push ditolak dengan **403 / Permission denied**: akun GitHub di komputermu belum punya akses ke repo `novorastudio86/toko_kopi_irona`. Minta diundang sebagai *collaborator*, terima undangannya, lalu login ulang git memakai **Personal Access Token (classic)** dengan izin `repo` (https://github.com/settings/tokens/new). Token fine-grained tidak bisa dipakai untuk repo milik akun lain.

---

## 12. Masalah yang sering muncul

| Gejala | Penyebab & solusi |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop belum jalan. Buka aplikasinya, tunggu sampai *running*, ulangi `npx supabase start`. |
| `port is already allocated` / port 54321–54324 terpakai | Ada Supabase lain yang jalan. Matikan dengan `npx supabase stop --project-id <nama>` atau hentikan container lama di Docker Desktop. |
| Halaman Web Admin putih / error `supabaseUrl is required` | Env belum terbaca. Jalankan dengan `doppler run -- npm run dev`, atau buat `irona-admin/.env.local` (bagian 4). |
| `Doppler Error: Could not find requested project` | Akun Doppler kamu belum punya akses ke project tim. Minta diundang, atau pakai project sendiri / `.env.local`. |
| Login gagal "Invalid login credentials" | Seed belum jalan. Pastikan `npx supabase start` sukses, atau `npx supabase db reset` (⚠️ menghapus data) untuk mengulang migrasi + seed. |
| `UPDATE requires a WHERE clause` | Ada `UPDATE`/`DELETE` tanpa `WHERE` di fungsi SQL (lihat bagian 10). |
| `Bulan … sudah tutup buku (hanya bisa dilihat)` | Data bulan lalu memang terkunci. Buka kembali lewat **Keuangan › Cash Flow › Buka Kembali**, atau untuk script dev pakai `irona.bypass_period_lock` (bagian 10). |
| Daftar member: *"Email kode gagal dikirim"* | Supabase dinyalakan tanpa Doppler (`RESEND_API_KEY` kosong), atau key Resend sudah dihapus. Restart lewat `doppler run ... -- npx supabase start` (bagian 9). Detail error: `docker logs supabase_auth_irona-backend --since 10m`. |
| Daftar member: *"Terlalu sering meminta kode"* | Batas kirim email per jam (`email_sent` di `config.toml`) atau jeda 60 detik antar kirim ulang. Tunggu sebentar. |
| Tambah karyawan gagal | Edge function `create-employee` butuh Supabase jalan penuh (`npx supabase status` → semua service *running*). Kalau baru restart Docker, jalankan `npx supabase stop` lalu `npx supabase start`. |

---

## 13. Struktur folder

```
toko_kopi_irona/
├── irona-admin/                  # Web Admin (React + Vite)
│   └── src/
│       ├── screens/              # halaman per modul (dashboard, finance, reports, sales, …)
│       ├── services/             # akses data Supabase per modul
│       ├── types/                # tipe TypeScript
│       ├── components/           # komponen bersama (PageHeader, TablePagination, …)
│       ├── constants/navigation.ts  # menu sidebar
│       └── App.tsx               # routing
├── irona-backend/
│   └── supabase/
│       ├── migrations/           # SEMUA perubahan database, urut timestamp
│       ├── seed.sql              # data awal (role, admin lokal, produk & resep)
│       ├── dev-data/             # script data dummy + penghapusnya
│       ├── functions/            # edge functions (create-employee, update-employee)
│       └── config.toml           # konfigurasi Supabase lokal
└── docs/
    └── ATURAN-BISNIS.md          # ringkasan keputusan bisnis yang sudah disepakati
```

### Modul Web Admin yang sudah jadi

Dashboard · Keuangan (Cash Flow, tutup buku) · Produk (kategori, produk, resep, bahan baku, kelola stok, aset) · Karyawan (daftar, hak akses, presensi + persetujuan lembur, shift, kasbon) · Pelanggan (member & poin) · Promosi (diskon, point reward) · Penjualan (tipe order, order online, jam buka, custom struk, penyesuaian transaksi) · Laporan Cash Flow · Laporan Penjualan.

Belum: Laporan Produk, Toko, Karyawan, Pelanggan, Persediaan · Analisa Laporan · Pengaturan.
