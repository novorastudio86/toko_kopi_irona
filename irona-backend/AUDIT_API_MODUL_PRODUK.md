# Audit API Modul Produk

> Dokumen sementara — 2026-10-05
> Acuan: sheet **Fix PRD-WA** di `docs/Masterlink_IronaKopi.xlsx` (baris Produk: Daftar Kategori s/d Aset Barang).
> Dicek terhadap state database lokal yang sedang jalan (tabel, view, RPC, trigger, RLS). Beberapa bagian diuji di transaksi yang di-rollback, jadi tidak ada data yang berubah.

**Kesimpulan:** Daftar Kategori dan Aset Barang sudah lengkap dan sesuai PRD. Empat sub modul lain masih punya kekurangan. Yang paling penting: produk belum otomatis nonaktif saat stok bahan habis, dan History Perubahan di Master Resep belum ada.

## Ringkasan

| Sub Modul | Status | Kekurangan utama |
|---|---|---|
| Daftar Kategori | ✅ Lengkap | – |
| Daftar Produk | ⚠ Kurang 1 aturan besar | Auto-nonaktif/aktif dari stok belum ada |
| Master Resep | ❌ Kurang | History Perubahan belum ada; biaya racikan yang tersimpan bisa basi |
| Daftar Bahan Baku | ❌ Kurang | Estimasi Penyusutan, Rekomendasi minimum, kunci Satuan Dasar |
| Kelola Stok | ⚠ Ada yang beda dari PRD | Cara input penyesuaian; ada bug di produksi racikan |
| Aset Barang | ✅ Lengkap | – |

---

## 1. Daftar Kategori ✅

Semua kebutuhan PRD sudah ada:

- Kolom nama, ikon, urutan, Tampil di Menu, dan Tampil di Online.
- Urutan dijaga database: wajib unik dan harus > 0.
- Kategori yang masih punya produk tidak bisa dihapus.

## 2. Daftar Produk ⚠

**Sudah sesuai:**

- Simpan produk 3 step lewat `save_product`. Produk "Isi Nanti" dipaksa nonaktif.
- Nama dan SKU dijaga unik.
- History tersimpan di tabel `product_history` dan terisi otomatis lewat trigger.
- Badge "Bahan Baku Menipis" (`product_low_stock`) sudah mengikuti aturan penelusuran PRD: racikan Batch berhenti di stoknya sendiri, racikan Made to Order ditelusuri ke bahan penyusunnya.
- Produk yang sudah punya transaksi tidak bisa dihapus.

**Kurang:**

- [ ] ❌ **Auto-nonaktif/auto-aktif dari stok belum dibuat.** Kolom `deactivated_manually` diisi saat toggle manual, tapi tidak ada logika yang membacanya. Akibatnya, produk yang bahannya habis tetap aktif dan tetap bisa dijual di kasir maupun web customer.
- [ ] ⚠ `save_product` masih menerima status `lengkap` dengan resep kosong. Takaran ≤ 0 dan harga jual kosong juga tidak ditolak.
- [ ] ⚠ Kolom `products.cost` dan `products.recommended_selling_price` tidak pernah diisi `save_product`. Yang terisi hanya 22 produk dari seed; produk baru dari UI bernilai 0/null. Sebaiknya dihapus atau dihitung otomatis.
- [ ] ⚠ Produk yang belum pernah terjual tapi terhubung ke promo, reward, atau tipe order juga tidak bisa dihapus, dan pesan error-nya error database mentah.
- [ ] (Frontend) Tombol History Perubahan masih "segera hadir", padahal API-nya (`product_history`) sudah ada.

## 3. Master Resep ❌

**Sudah sesuai:**

- `save_racikan`: mode Batch/Made to Order, yield, total hasil, add cost, minimum stok khusus Batch, dan cegah referensi melingkar sampai bertingkat.
- `recipe_list` hanya berisi produk dengan resep plus semua racikan. Produk Tanpa Resep tidak ikut.
- `racikan_low_stock` mulai menelusuri 1 level di bawah racikan, sesuai PRD.

**Kurang:**

- [ ] ❌ **History Perubahan belum ada sama sekali.** Tidak ada tabel yang mencatat perubahan bahan/takaran resep, dan racikan tidak punya history. PRD meminta semua perubahan dicatat (bahan/takaran, Add Cost %, Desired Cost %, Mode Produksi, Yield — before → after). Tombolnya di UI juga masih "segera hadir".
- [ ] ❌ **Biaya racikan yang tersimpan bisa basi.** Kolom `cost_per_batch`, `price_per_unit`, dan `cost_per_porsi` hanya dihitung saat racikan disimpan. Kalau harga bahan berubah lewat Stok Masuk, angkanya tidak ikut berubah. Editor resep di form produk memakai `price_per_unit` yang tersimpan ini, sehingga cost di form produk bisa berbeda dengan cost di tabel Master Resep (yang dihitung live). Sekarang belum kelihatan karena data racikan masih kosong.
- [ ] ⚠ Racikan yang pernah diproduksi tidak bisa dihapus walaupun sudah tidak dipakai, karena terkait riwayat stok. Sebaiknya cukup dinonaktifkan.

## 4. Daftar Bahan Baku ❌

**Sudah sesuai:** jenis Tetap/Menyusut, satuan dasar, satuan beli default, isi per kemasan, harga dari Stok Masuk terakhir, minimum stok, aktif/nonaktif, dan daftar pemakai (`raw_material_usage`).

**Kurang:**

- [ ] ❌ **Estimasi Penyusutan (%) sudah dihapus** di migration `drop_shrinkage_percentage` (disengaja; alasannya biaya susut sudah tertutup Add Cost). Tapi PRD masih memintanya, termasuk info "estimasi susut wajar" di Stok Masuk dan Penyesuaian. **Perlu keputusan.**
- [ ] ❌ **Kebutuhan Minimum Teragregasi / Rekomendasi belum ada API-nya** (untuk ikon 🔺 dan teks "Rekomendasi: X"). View `raw_material_usage` tidak memfilter resep yang aktif, dan isinya mencampur takaran per porsi (produk) dengan takaran per batch (racikan), jadi tidak bisa langsung dijumlahkan.
- [ ] ❌ **Satuan Dasar tidak terkunci** setelah ada transaksi stok, baik di backend maupun di form. Kalau diganti, angka stok jadi salah arti.
- [ ] ⚠ Bahan baku ditulis langsung ke tabel, tanpa RPC. Akibatnya `unit_price` dan `current_stock`, yang menurut PRD read-only, secara teknis masih bisa diubah langsung.
- [ ] ⚠ Nama bahan baku dan nama racikan belum dijaga unik (nama produk sudah).

## 5. Kelola Stok ⚠

**Sudah sesuai:**

- `stock_card`: stok awal, masuk, terjual, penyesuaian, produksi, dan stok akhir per periode, gabungan bahan baku dan racikan Batch.
- `record_stock_in`: konversi kemasan ke satuan dasar dan update harga terakhir.
- `record_racikan_production`: khusus Batch, cek stok, potong bahan, tambah stok racikan, dan catat pembuatnya.
- Jenis penyesuaian Opname/Penyusutan/Rusak/Hilang/Lainnya sudah ada, dan data stok terkunci begitu bulannya tutup buku.

**Kurang:**

- [ ] ⚠ **Cara input penyesuaian berbeda dari PRD.** PRD meminta "Jumlah Penyesuaian (+/-)", tapi API dan form meminta stok fisik lalu menghitung selisihnya sendiri. Untuk Opname cara ini cocok, tapi untuk Rusak/Hilang orang biasanya memasukkan jumlah yang hilang. **Perlu keputusan.**
- [ ] ❌ **Bug produksi racikan:** kalau racikan Batch memakai komponen racikan Made to Order, produksi selalu gagal "stok tidak cukup". Penyebabnya, stok racikan Made to Order selalu 0 dan `record_racikan_production` tidak menelusurinya ke bahan baku. Sekarang belum kena karena belum ada data racikan.
- [ ] ⚠ `record_stock_adjustment` tidak menolak racikan Made to Order (racikan ini tidak punya stok). `record_stock_in` juga tidak menolak bahan yang nonaktif. Untuk sekarang keduanya sudah dibatasi di frontend.

## 6. Aset Barang ✅

- Simpan aset (`save_asset`), ganti status dengan catatan wajib (`update_asset_status`), dan riwayat perubahan (`asset_history`) sudah ada.
- Ubah/Hapus terkunci begitu bulan beli sudah lewat.
- Ganti status **tidak** ikut terkunci bulan — sudah diuji: trigger kuncinya sengaja tidak memeriksa kolom `status`, jadi sesuai PRD.
- Catatan kecil: kolom `assets.source` tidak dipakai, yang dipakai `notes`.

---

## Struktur API secara umum

- **Polanya sudah benar:** baca data lewat tabel/view, simpan yang kompleks lewat RPC dengan cek `is_admin()`, ditambah RLS. Yang belum konsisten hanya bahan baku, yang masih ditulis langsung ke tabel padahal punya aturan bisnis.
- [ ] ⚠ **Celah keamanan yang akan muncul:** tabel `raw_materials`, `racikan`, `racikan_components`, `product_recipe_components`, dan `stock_movements` bisa dibaca semua user yang login. Begitu login customer di web customer selesai dibuat (sekarang masih TODO), customer yang terdaftar bisa membaca harga beli bahan dan HPP. Hak baca ini perlu dibatasi ke karyawan saja (`is_employee()`).

## Perlu keputusan

1. **Estimasi Penyusutan (%):** dikembalikan sesuai PRD, atau PRD-nya yang diperbarui?
2. **Penyesuaian stok:** input "stok fisik" seperti sekarang, "jumlah +/-" seperti PRD, atau keduanya tergantung jenis penyesuaian?

## Rekomendasi urutan perbaikan

1. Auto-nonaktif/aktif produk dari stok.
2. Batasi hak baca data biaya ke karyawan.
3. Hitung biaya racikan secara live.
4. Kunci Satuan Dasar.
5. Perbaiki produksi racikan yang memakai komponen Made to Order.
6. Buat History Master Resep.
7. Buat API Rekomendasi minimum.
