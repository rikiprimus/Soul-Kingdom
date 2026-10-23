# Daftar Objek Soul Monster

Daftar semua objek yang ada di game saat ini (angka diambil dari `data/`, keadaan 2026-10-22), ditambah usulan objek baru. Setiap objek punya bagian **Isian pemilik**: tulis bentuk, fungsi, apa yang muncul saat diketuk, leveling, dan deskripsi tiap level yang kamu inginkan. Bagian yang dibiarkan kosong berarti tetap seperti sekarang.

Cara mengisi:

- **Bentuk**: rupa, ukuran tapak (petak), suasana; dipakai untuk membuat gambar (SpriteCook / buatan kode).
- **Fungsi**: apa yang bisa dilakukan pemain dengan objek ini, apa hasilnya.
- **Saat diketuk**: apa yang muncul saat pemain mengetuk objek: kartu info (isi & tombolnya), panel penuh, atau aksi langsung (mis. memungut). Bisa berbeda per keadaan (kosong / sedang bekerja / siap).
- **Leveling**: berapa level, apa yang naik tiap level (hasil, kapasitas, slot, waktu, efek baru), dan syarat Balai Utama.
- **Percepat dengan permata**: apakah waktu bangun / naik level objek ini boleh dipercepat dengan permata, dan harganya (sekarang semua bangunan sama: 1 permata per menit sisa). Waktu lain yang sekarang **tidak** bisa dipercepat: latih pekerja, latih prajurit, langkah rawat Telur Jiwa, tumbuh ladang. Soul Mixer sudah bisa dipercepat.
- **Deskripsi tiap level**: teks yang dilihat pemain di kartu info, termasuk tambahan saat naik level.
- Angka boleh ditulis kira-kira; nanti dipindah ke `data/*.json` dan diuji dengan `pnpm sim:economy`.

## 0. Temuan dari keadaan sekarang

Hal yang mungkin perlu kamu tentukan saat mengisi:

1. **Level Kandang Monster (5 level) dan level Guild (5 level) belum berpengaruh apa pun**. Pemain membayar upgrade tanpa hasil. Perlu efek per level (mis. Kandang: kapasitas monster / diskon makanan; Guild: batas unit Serbu / hadiah Serbu).
2. **Kayu dan batu hanya didapat dari alam liar** (pekerja harus aktif bermain) dan hadiah. Tidak ada bangunan penghasil kayu atau batu, padahal biaya Balai Lv 5–6 butuh puluhan ribu kayu/batu.
3. **Kristal Jiwa** (dipakai Soul Mixer tingkat tinggi) hanya dari peluang saat mengambil alam liar, musuh, dan hadiah.
4. **Dekorasi tidak punya efek** (hanya hiasan), dan semuanya 1 level.
5. **Soul Mixer, Kuburan, Sarang Telur Jiwa, Gerbang Petualangan hanya 1 level**: tidak ada alasan untuk meng-upgrade fitur inti monster.
6. **Arena** sudah bisa dibangun tapi belum berfungsi (Tugas 2.3).
7. **Monster tidak punya level sendiri** selain tahap tumbuh bayi → remaja → dewasa; tidak ada objek untuk melatih atau memperkuat monster dewasa.

## 1. Bangunan

Kategori di menu Bangun: Produksi, Monster, Militer, Dekorasi, Keajaiban, Utama. Ukuran = sisi tapak dalam petak. "Maks" = jumlah yang boleh dibangun per level Balai Utama (pulau lain punya batas sendiri, lihat `data/islands.json`).

**Saat bangunan diketuk** (sekarang), muncul kartu info di kiri bawah: gambar, nama · level, deskripsi, baris status, lalu tombol. Tombol yang ada di hampir semua bangunan: **Upgrade** (biaya, waktu, pilih jumlah pekerja; tidak ada bila level maksimal), **Pindah**, **Putar** (kecuali tembok). Dekorasi & Keajaiban juga punya **Simpan ke Gudang**; dekorasi & tembok punya **Jual**. Saat sedang dibangun **atau naik level**: kemajuan, **Tambah pekerja**, **Percepat (N permata)** — harga sama untuk semua bangunan: 1 permata per menit sisa, minimal 1 (`rules.premium`). Beberapa bangunan langsung menjalankan aksi tanpa kartu (lihat "Sekarang saat diketuk" di tiap bangunan).

Tabel level di tiap bangunan sudah mengikuti rencana baru. Baris bertanda **\*** adalah usulan atau berubah dari `data/` (mis. slot pekerja Tambang/Penggilingan Lv1–3) (belum ada di `data/`, angka kira-kira, nanti diuji dengan `pnpm sim:economy`). Baris "Sekarang" tetap menjelaskan keadaan game saat ini.

| Kategori  | Bangunan            | id                    | Ukuran | Level | Fungsi sekarang                                                                                                                  |
| --------- | ------------------- | --------------------- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| Utama     | Balai Utama         | `balai-utama`         | 4×4    | 8     | Membuka bangunan & level baru; melatih pekerja; dijadikan sasaran serangan desa.                                                 |
| Utama     | Rumah               | `rumah`               | 2×2    | 6     | Hanya menambah populasi.                                                                                                         |
| Utama     | Mansion             | `mansion`             | 2×2    | 6     | Menambah populasi lebih banyak dibanding rumah.                                                                                  |
| Produksi  | Pasar               | `pasar`               | 2×2    | 6     | Menghasilkan emas sendiri, dipungut dengan ketukan. Tempat dapat gacha 1x sehari                                                 |
| Produksi  | Ladang              | `ladang`              | 2×2    | 6     | Tanam → tunggu → panen makanan.                                                                                                  |
| Produksi  | Tambang Emas        | `tambang-emas`        | 2×2    | 8     | Butuh pekerja di dalam; tetap jalan saat game ditutup.                                                                           |
| Produksi  | Tambang Batu        | `tambang-batu`        | 2×2    | 8     | Butuh pekerja di dalam; tetap jalan saat game ditutup.                                                                           |
| Produksi  | Tukang Kayu         | `tukang-kayu`         | 2×2    | 8     | Butuh pekerja di dalam; tetap jalan saat game ditutup.                                                                           |
| Produksi  | Penggilingan        | `penggilingan`        | 2×2    | 8     | Butuh pekerja di dalam; tetap jalan saat game ditutup.                                                                           |
| Produksi  | Peternakan          | `peternakan`          | 3×3    | 5     | Menampung hewan tangkapan; tiap hewan menghasilkan makanan/jam.                                                                  |
| Utama     | Gudang              | `gudang`              | 3×3    | 1     | Menggantikan Kandang Monster (gambarnya dipakai ulang): membuka panel Gudang.                                                    |
| Monster   | Altar               | `altar`               | 3×3    | 1     | Mencampur dua monster dewasa → langsung jadi monster bayi baru (butuh Balai Lv 4). Dulu Soul Mixer.                              |
| Monster   | Kuburan             | `kuburan`             | 2×2    | 1     | Membuka daftar monster gugur untuk dihidupkan kembali. Hanya 1 level.                                                            |
| Monster   | Sarang Telur Jiwa   | `sarang-telur`        | 2×2    | 1     | Bisa dibangun sejak Balai 1. Merawat & menetaskan Telur Jiwa, inkubasi telur yang didapat, beri makan monster hingga dewasa.     |
| Keajaiban | Pohon Emas Purba    | `pohon-emas-purba`    | 3×3    | 1     | Keajaiban: hadiah misi besar, dipasang dari Gudang, tidak bisa dibangun.                                                         |
| Keajaiban | Lumbung Abadi       | `lumbung-abadi`       | 3×3    | 1     | Keajaiban: hadiah set koleksi, dipasang dari Gudang.                                                                             |
| Keajaiban | Kolam Jiwa          | `kolam-jiwa`          | 3×3    | 1     | Keajaiban: hadiah set koleksi, dipasang dari Gudang.                                                                             |
| Militer   | Guild               | `guild`               | 3×3    | 5     | Terbuka di Balai 3. Guild komunitas (misi & pengalaman guild, perang guild) dan pintu masuk Serbu.                               |
| Militer   | Barak               | `barak`               | 3×3    | 6     | Melatih Prajurit; jumlah level ketiga barak menaikkan batas kekuatan Serbu.                                                      |
| Militer   | Lapangan Pemanah    | `lapangan-panah`      | 3×3    | 6     | Melatih Pemanah; ikut menaikkan batas kekuatan Serbu.                                                                            |
| Militer   | Kandang Kuda        | `kandang-kuda`        | 3×3    | 6     | Terbuka di Balai 3. Melatih Penombak Berkuda; ikut menaikkan batas kekuatan Serbu.                                               |
| Militer   | Bengkel             | `bengkel`             | 3×3    | 6     | Terbuka di Balai 4. Membuat 2 mesin perang (Ketapel, Pendobrak) yang naik versi tiap level; ikut menaikkan batas kekuatan Serbu. |
| Militer   | Gerbang Petualangan | `gerbang-petualangan` | 3×3    | 4     | Membuka peta Petualangan; tiap level membuka satu wilayah berikutnya.                                                            |
| Militer   | Arena               | `arena`               | 4×4    | 1     | **Belum berfungsi** ("Arena segera hadir", Tugas 2.3).                                                                           |
| Militer   | Menara Jaga         | `menara`              | 2×2    | 5     | Menembak musuh serangan desa dalam jangkauan.                                                                                    |
| Militer   | Menara sihir        | `menara-sihir`        | 2×2    | 5     | Menembak musuh serangan desa dalam jangkauan pendek tapi lebih kuat.                                                             |
| Militer   | Pohon Jiwa          | `pohon-jiwa`          | 2×2    | 5     | Tempat menyembuhkan pasukan.                                                                                                     |
| Utama     | Perpustakaan        | `perpustakaan`        | 2×2    | 5     | Membuka teknologi, riset dan pengetahuan baru.                                                                                   |
| Militer   | Tembok              | `tembok`              | 1×1    | 8     | Menghalangi jalan musuh serangan desa (musuh memutar atau menjebol).                                                             |
| Militer   | Gerbang             | `gerbang`             | 1×1    | 8     | Pintu masuk yang bisa dipasang untuk buka/tutup bersama tembok.                                                                  |
| Dekorasi  | Pohon Hias          | `pohon-hias`          | 1×1    | 1     | Dekorasi, Tambah populasi 2.                                                                                                     |
| Dekorasi  | Taman Bunga         | `bunga`               | 1×1    | 1     | Dekorasi, Tambah populasi 2.                                                                                                     |
| Dekorasi  | Lampu Jalan         | `lampu`               | 1×1    | 1     | Dekorasi, Tambah populasi 2.                                                                                                     |
| Dekorasi  | Air Mancur          | `air-mancur`          | 2×2    | 1     | Dekorasi, Tambah populasi 5.                                                                                                     |
| Dekorasi  | Patung Naga         | `patung`              | 1×1    | 1     | Dekorasi, Tambah populasi 10.                                                                                                    |
| Dekorasi  | Monumen Keajaiban   | `monumen-keajaiban`   | 2×2    | 1     | Dekorasi, Tambah populasi 15.                                                                                                    |

### Balai Utama (`balai-utama`)

> Jantung desa. Level Balai Utama membuka bangunan dan level baru.

- Kategori: Utama · ukuran 4×4 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Membuka bangunan & level baru; melatih pekerja; dijadikan sasaran serangan desa.
- Sekarang saat diketuk: Kartu: populasi & pekerja, tombol **Latih pekerja**.

| Lv  | Biaya                                                          | Waktu bangun | Butuh Balai | Efek         |
| --- | -------------------------------------------------------------- | ------------ | ----------- | ------------ |
| 1   | gratis                                                         | langsung     | —           | populasi +8  |
| 2   | 1.000 emas + 400 kayu + 100 batu                               | 10 mnt       | 1           | populasi +10 |
| 3   | 5.000 emas + 1.000 makanan + 2.500 kayu + 1.200 batu           | 1 jam        | 2           | populasi +13 |
| 4   | 15.000 emas + 3.000 makanan + 7.000 kayu + 5.000 batu          | 6 jam        | 3           | populasi +17 |
| 5   | 50.000 emas + 20.000 makanan + 20.000 kayu + 12.000 batu       | 24 jam       | 4           | populasi +22 |
| 6   | 150.000 emas + 70.000 makanan + 55.000 kayu + 40.000 batu      | 3 hari       | 5           | populasi +28 |
| 7   | 500.000 emas + 150.000 makanan + 130.000 kayu + 100.000 batu   | 7 hari       | 6           | populasi +35 |
| 8   | 1.000.000 emas + 500.000 makanan + 455.000 kayu + 200.000 batu | 15 hari      | 7           | populasi +43 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 4x4, sebuah balai utama, warna coklat diawal, yg nantinya akan berubah setiap naik level
- Fungsi (apa yang dilakukan pemain dengan objek ini): menambah populasi, menambah pekerja, dan tempat untuk melarikan dari para pekerja bila sedang diserang.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): tombol menambah populasi, melihat gudang, info seputar desa
- Leveling (berapa level, apa yang bertambah tiap level): populasi bertambah setiap level nya, semakin tinggi level pekerja yg dihasilkan lebih cepat. Usulan waktu latih pekerja: Lv1 60 dtk, Lv2 55, Lv3 50, Lv4 45, Lv5 40, Lv6 35, Lv7 30, Lv8 25 dtk.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, 1 permata per menit sisa. Lv 7–8 sangat lama (7 & 15 hari = sampai 21.600 permata), usul harga dibatasi maksimal mis. 3.000 permata.
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Balai kayu sederhana. Pusat desa kecilmu.
  - Lv 2: Atap diperkuat. Desa bisa menampung lebih banyak warga.
  - Lv 3: Balai berdinding batu. Bangunan produksi baru terbuka.
  - Lv 4: Balai berpanji. Altar terbuka: campur dua monster dewasa!
  - Lv 5: Balai bermenara. Pekerja dilatih lebih cepat.
  - Lv 6: Balai megah berlapis batu. Bangunan level tinggi terbuka.
  - Lv 7: Istana desa. Pertahanan dan riset tingkat lanjut terbuka.
  - Lv 8: Istana Jiwa. Puncak kejayaan desamu.
- Catatan lain: (3) "Tombol menambah populasi" maksudnya **Latih pekerja**, atau tombol lain? menambah slot populasi (4) Saat serangan desa: pekerja di luar otomatis lari ke Balai dan tidak bisa diserang sampai serangan selesai.

### Rumah (`rumah`)

> Tempat tinggal. Menambah populasi untuk pekerja, prajurit, dan monster.

- Kategori: Utama · ukuran 2×2 · maks per Balai Lv1: 2, Lv2: 4, Lv3: 6, Lv4: 8, Lv5: 10, Lv6: 12, Lv7: 14, Lv8: 16
- Sekarang: Hanya menambah populasi.
- Sekarang saat diketuk: Kartu: populasi yang ditambahkan rumah ini dan populasi desa.

| Lv  | Biaya                                 | Waktu bangun | Butuh Balai | Efek         |
| --- | ------------------------------------- | ------------ | ----------- | ------------ |
| 1   | 150 emas + 150 kayu                   | 1 mnt        | 1           | populasi +10 |
| 2   | 500 emas + 400 kayu + 100 batu        | 5 mnt        | 2           | populasi +15 |
| 3   | 1.500 emas + 900 kayu + 300 batu      | 15 mnt       | 3           | populasi +20 |
| 4   | 4.000 emas + 1.800 kayu + 800 batu    | 30 mnt       | 4           | populasi +25 |
| 5   | 10.000 emas + 3.500 kayu + 1.800 batu | 1 jam        | 5           | populasi +30 |
| 6*  | 22.000 emas + 6.000 kayu + 3.500 batu | 2 jam        | 6           | populasi +36 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, pondok kayu beratap jerami dengan cerobong berasap tipis; tiap level makin rapi (jerami → genteng → batu bertingkat).
- Fungsi (apa yang dilakukan pemain dengan objek ini): Menambah populasi desa (batas jumlah pekerja, prajurit, dan monster).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: populasi dari rumah ini, populasi desa (terpakai / maks), tombol Upgrade, Pindah, Putar.
- Leveling (berapa level, apa yang bertambah tiap level): 6 level, populasi +10 / +15 / +20 / +25 / +30 / +36. Usulan Lv6: 22.000 emas + 6.000 kayu + 3.500 batu, 2 jam, Balai 6.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Pondok jerami sederhana. Populasi +10.
  - Lv 2: Pondok kayu yang lebih luas. Populasi +15.
  - Lv 3: Rumah kayu berjendela. Populasi +20.
  - Lv 4: Rumah beratap genteng. Populasi +25.
  - Lv 5: Rumah batu yang kokoh. Populasi +30.
  - Lv 6: Rumah batu bertingkat. Populasi +36.
- Catatan lain: Maks per Balai Lv7–8 usul 14 dan 16.

### Mansion (`mansion`)

> Rumah besar para bangsawan desa. Menampung jauh lebih banyak warga.

- Kategori: Utama · ukuran 2×2 · 6 level · usul terbuka di Balai Lv 4 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 0, Lv4: 1, Lv5: 2, Lv6: 3, Lv7: 4, Lv8: 5
- Sekarang: **belum ada** (objek baru, belum di `data/`).

| Lv  | Biaya                                      | Waktu bangun | Butuh Balai | Efek          |
| --- | ------------------------------------------ | ------------ | ----------- | ------------- |
| 1*  | 8.000 emas + 3.000 kayu + 3.000 batu       | 1 jam        | 4           | populasi +30  |
| 2*  | 18.000 emas + 6.500 kayu + 6.500 batu      | 2 jam        | 4           | populasi +50  |
| 3*  | 40.000 emas + 14.000 kayu + 14.000 batu    | 4 jam        | 5           | populasi +60  |
| 4*  | 90.000 emas + 30.000 kayu + 30.000 batu    | 8 jam        | 6           | populasi +72  |
| 5*  | 200.000 emas + 65.000 kayu + 65.000 batu   | 16 jam       | 7           | populasi +86  |
| 6*  | 450.000 emas + 140.000 kayu + 140.000 batu | 32 jam       | 8           | populasi +100 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, rumah bangsawan dua lantai beratap biru, balkon kayu, taman bunga kecil di depan pintu; tiap level bertambah hiasan (panji, lampu, menara kecil).
- Fungsi (apa yang dilakukan pemain dengan objek ini): Menambah populasi jauh lebih banyak per petak dibanding Rumah, tapi mahal (butuh banyak batu).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Sama seperti Rumah: populasi dari mansion ini, populasi desa, Upgrade, Pindah, Putar.
- Leveling (berapa level, apa yang bertambah tiap level): 6 level, populasi +30 / +50 / +60 / +72 / +86 / +100. Usulan Lv1: 8.000 emas + 3.000 kayu + 3.000 batu, 1 jam; tiap level biaya ×2,2 dan waktu ×2.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Rumah besar berdinding batu. Populasi +30.
  - Lv 2: Lantai dua selesai dibangun. Populasi +50.
  - Lv 3: Balkon dan taman ditambahkan. Populasi +60.
  - Lv 4: Sayap rumah diperluas. Populasi +72.
  - Lv 5: Menara kecil berpanji. Populasi +86.
  - Lv 6: Mansion termegah di desa. Populasi +100.
- Catatan lain: Nama yang dilihat pemain usul bahasa Indonesia (aturan 5), mis. **Rumah Bangsawan**; id tetap `mansion`.

### Pasar (`pasar`)

> Pedagang membayar pajak emas. Ketuk untuk memungut emas.

- Kategori: Produksi · ukuran 2×2 · maks per Balai Lv1: 1, Lv2: 2, Lv3: 2, Lv4: 3, Lv5: 3, Lv6: 4, Lv7: 4, Lv8: 5
- Sekarang: Menghasilkan emas sendiri, dipungut dengan ketukan.
- Sekarang saat diketuk: Bila emas sudah cukup terkumpul: **langsung dipungut** (ikon emas terbang ke HUD). Selain itu kartu: emas tersimpan/kapasitas, tombol **Pungut**.

| Lv  | Biaya                                                 | Waktu bangun | Butuh Balai | Efek                             |
| --- | ----------------------------------------------------- | ------------ | ----------- | -------------------------------- |
| 1   | 300 emas + 100 kayu                                   | 1 mnt        | 1           | +600 emas/jam (tampung 2.400)    |
| 2   | 800 emas + 250 kayu                                   | 5 mnt        | 2           | +900 emas/jam (tampung 3.600)    |
| 3   | 2.000 emas + 200 makanan + 500 kayu + 100 batu        | 15 mnt       | 3           | +1.300 emas/jam (tampung 5.200)  |
| 4   | 5.000 emas + 500 makanan + 1.000 kayu + 300 batu      | 30 mnt       | 4           | +1.800 emas/jam (tampung 7.200)  |
| 5   | 12.000 emas + 1.500 makanan + 2.000 kayu + 800 batu   | 1 jam        | 5           | +2.400 emas/jam (tampung 9.600)  |
| 6*  | 28.000 emas + 3.500 makanan + 4.000 kayu + 1.800 batu | 2 jam        | 6           | +3.200 emas/jam (tampung 12.800) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, lapak pedagang dengan tenda kain belang, peti, karung, dan timbangan; tenda makin besar dan berwarna tiap level.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Menghasilkan emas sendiri, dipungut dengan ketukan. Plus **Undian Harian**: 1× sehari gratis, hadiah acak (emas, makanan, kayu, batu, Kristal Jiwa, kadang dekorasi).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Emas cukup: langsung dipungut. Selain itu kartu: emas tersimpan / kapasitas, tombol **Pungut**, tombol **Undian Harian** (menyala bila belum dipakai hari ini; bila sudah, hitung mundur ke undian berikutnya).
- Leveling (berapa level, apa yang bertambah tiap level): 6 level; emas/jam dan tampungan naik. Usulan Lv6: +3.200 emas/jam (tampung 12.800), 28.000 emas + 3.500 makanan + 4.000 kayu + 1.800 batu, 2 jam, Balai 6. Level Pasar tertinggi memperbagus tabel hadiah undian.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Lapak kecil. Pedagang membayar pajak emas.
  - Lv 2: Tenda lebih besar, pedagang lebih ramai.
  - Lv 3: Pasar berpeti. Pajak emas naik.
  - Lv 4: Pasar berwarna-warni. Hadiah undian lebih baik.
  - Lv 5: Pasar ramai pedagang dari pulau lain.
  - Lv 6: Pasar Raya. Pajak emas terbesar dan undian terbaik.
- Catatan lain: Undian 1× sehari per akun (bukan per Pasar), dihitung server (aturan 6). Tidak ada undian tambahan dengan permata, dan undian tidak memberi monster (aturan 7). Telur Jiwa sebagai hadiah langka: boleh atau tidak?

### Ladang (`ladang`)

> Tanam bibit dengan emas, tunggu tumbuh, lalu panen makanan untuk monster.

- Kategori: Produksi · ukuran 2×2 · maks per Balai Lv1: 2, Lv2: 3, Lv3: 4, Lv4: 5, Lv5: 6, Lv6: 7, Lv7: 8, Lv8: 8
- Sekarang: Tanam → tunggu → panen makanan.
- Sekarang saat diketuk: Kosong: kartu dengan tombol **Tanam**. Sedang tumbuh: kartu dengan hitung mundur. Siap: **langsung dipanen**.

| Lv  | Biaya                                 | Waktu bangun | Butuh Balai | Efek                                        |
| --- | ------------------------------------- | ------------ | ----------- | ------------------------------------------- |
| 1   | 100 emas + 80 kayu                    | 30 dtk       | 1           | tanam 50 emas → 150 makanan dalam 5 mnt     |
| 2   | 400 emas + 200 kayu                   | 5 mnt        | 2           | tanam 80 emas → 250 makanan dalam 5 mnt     |
| 3   | 1.000 emas + 400 kayu                 | 15 mnt       | 3           | tanam 120 emas → 450 makanan dalam 10 mnt   |
| 4   | 2.500 emas + 800 kayu + 200 batu      | 30 mnt       | 4           | tanam 180 emas → 700 makanan dalam 15 mnt   |
| 5   | 6.000 emas + 1.500 kayu + 500 batu    | 1 jam        | 5           | tanam 250 emas → 1.000 makanan dalam 20 mnt |
| 6*  | 14.000 emas + 3.000 kayu + 1.200 batu | 2 jam        | 6           | tanam 330 emas → 1.400 makanan dalam 25 mnt |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, petak tanah berpagar kayu rendah; tampilan berubah: tanah kosong → tunas hijau → gandum keemasan siap panen.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Tanam bibit dengan emas → tunggu → panen makanan untuk monster dan prajurit.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kosong: kartu dengan tombol **Tanam**. Sedang tumbuh: kartu hitung mundur. Siap: langsung dipanen.
- Leveling (berapa level, apa yang bertambah tiap level): 6 level. Usulan Lv6: tanam 330 emas → 1.400 makanan dalam 25 mnt; 14.000 emas + 3.000 kayu + 1.200 batu, 2 jam, Balai 6.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Bangun / upgrade boleh (1 permata per menit). Waktu tumbuh tanaman: tetap tidak bisa dipercepat.
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Petak kecil. Tanam gandum untuk makanan.
  - Lv 2: Tanah lebih subur. Panen lebih banyak.
  - Lv 3: Pagar diperbaiki. Panen naik lagi.
  - Lv 4: Ladang beririgasi. Panen besar.
  - Lv 5: Ladang subur. Panen sangat besar.
  - Lv 6: Ladang emas. Panen terbesar di desa.
- Catatan lain:

### Tambang Emas (`tambang-emas`)

> Pekerja di dalam menggali emas, tetap bekerja saat game ditutup.

- Kategori: Produksi · ukuran 2×2 · maks per Balai Lv1: 0, Lv2: 1, Lv3: 1, Lv4: 2, Lv5: 2, Lv6: 3, Lv7: 3, Lv8: 4
- Sekarang: Butuh pekerja di dalam; tetap jalan saat game ditutup.
- Sekarang saat diketuk: Bila hasil cukup: **langsung dipungut**. Selain itu kartu: hasil per pekerja, pekerja di dalam, tombol **Tambah pekerja / Keluarkan pekerja / Pungut**.

| Lv  | Biaya                                     | Waktu bangun | Butuh Balai | Efek                                                  |
| --- | ----------------------------------------- | ------------ | ----------- | ----------------------------------------------------- |
| 1*  | 800 emas + 300 kayu + 200 batu            | 10 mnt       | 2           | 1 slot pekerja, 120 emas/pekerja/jam (tampung 2.000)  |
| 2*  | 2.500 emas + 800 kayu + 600 batu          | 30 mnt       | 3           | 1 slot pekerja, 150 emas/pekerja/jam (tampung 3.500)  |
| 3*  | 7.000 emas + 1.800 kayu + 1.500 batu      | 1 jam        | 4           | 2 slot pekerja, 190 emas/pekerja/jam (tampung 6.000)  |
| 4*  | 18.000 emas + 4.000 kayu + 3.500 batu     | 2 jam        | 5           | 2 slot pekerja, 230 emas/pekerja/jam (tampung 8.000)  |
| 5*  | 40.000 emas + 9.000 kayu + 8.000 batu     | 4 jam        | 5           | 3 slot pekerja, 270 emas/pekerja/jam (tampung 10.000) |
| 6*  | 90.000 emas + 20.000 kayu + 18.000 batu   | 8 jam        | 6           | 4 slot pekerja, 320 emas/pekerja/jam (tampung 13.000) |
| 7*  | 200.000 emas + 45.000 kayu + 40.000 batu  | 16 jam       | 7           | 5 slot pekerja, 370 emas/pekerja/jam (tampung 17.000) |
| 8*  | 450.000 emas + 100.000 kayu + 90.000 batu | 32 jam       | 8           | 6 slot pekerja, 430 emas/pekerja/jam (tampung 22.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, mulut tambang di bukit kecil bertiang kayu, rel dan gerobak berisi bongkahan emas, lentera di pintu.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Pekerja di dalam menggali emas; tetap jalan saat game ditutup.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Hasil cukup: langsung dipungut. Selain itu kartu: hasil per pekerja, pekerja di dalam, tombol **Tambah pekerja / Keluarkan pekerja / Pungut**.
- Leveling (berapa level, apa yang bertambah tiap level): 8 level; slot pekerja 1 / 1 / 2 / 2 / 3 / 4 / 5 / 6 (keputusan pemilik), hasil per pekerja dan tampungan naik tiap level (lihat tabel).
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Lubang tambang kecil. 1 pekerja menggali emas.
  - Lv 2: Lorong diperdalam. 1 pekerja.
  - Lv 3: Rel gerobak dipasang. 2 pekerja.
  - Lv 4: Penyangga batu. Hasil per pekerja naik. 2 pekerja.
  - Lv 5: Lorong kedua dibuka. 3 pekerja.
  - Lv 6: Urat emas besar ditemukan. 4 pekerja.
  - Lv 7: Lift tambang. 5 pekerja.
  - Lv 8: Tambang Emas Agung. Hasil terbesar. 6 pekerja.
- Catatan lain:

### Tambang Batu (`tambang-batu`)

> Pekerja memecah batu dari tebing, tetap bekerja saat game ditutup.

- Kategori: Produksi · ukuran 2×2 · 8 level · usul terbuka Balai 2, maks sama dengan Tambang Emas · maks per Balai Lv1: 0, Lv2: 1, Lv3: 1, Lv4: 2, Lv5: 2, Lv6: 3, Lv7: 3, Lv8: 4
- Sekarang: **belum ada** (objek baru, belum di `data/`).

| Lv  | Biaya                       | Waktu bangun | Butuh Balai | Efek                                                  |
| --- | --------------------------- | ------------ | ----------- | ----------------------------------------------------- |
| 1*  | 600 emas + 400 kayu         | 10 mnt       | 2           | 1 slot pekerja, 60 batu/pekerja/jam (tampung 1.000)   |
| 2*  | 2.000 emas + 1.000 kayu     | 30 mnt       | 3           | 1 slot pekerja, 75 batu/pekerja/jam (tampung 1.800)   |
| 3*  | 6.000 emas + 2.200 kayu     | 1 jam        | 4           | 2 slot pekerja, 95 batu/pekerja/jam (tampung 3.000)   |
| 4*  | 15.000 emas + 5.000 kayu    | 2 jam        | 5           | 2 slot pekerja, 115 batu/pekerja/jam (tampung 4.200)  |
| 5*  | 35.000 emas + 11.000 kayu   | 4 jam        | 5           | 3 slot pekerja, 140 batu/pekerja/jam (tampung 5.500)  |
| 6*  | 80.000 emas + 24.000 kayu   | 8 jam        | 6           | 4 slot pekerja, 170 batu/pekerja/jam (tampung 7.000)  |
| 7*  | 180.000 emas + 52.000 kayu  | 16 jam       | 7           | 5 slot pekerja, 210 batu/pekerja/jam (tampung 9.000)  |
| 8*  | 400.000 emas + 110.000 kayu | 32 jam       | 8           | 6 slot pekerja, 260 batu/pekerja/jam (tampung 12.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, tebing batu abu-abu yang dipahat bertingkat, tumpukan balok batu, katrol kayu dan gerobak.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Pekerja di dalam menghasilkan **batu**; tetap jalan saat game ditutup (menutup temuan 2).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Sama seperti Tambang Emas: hasil cukup langsung dipungut, selain itu kartu hasil + Tambah / Keluarkan pekerja / Pungut.
- Leveling (berapa level, apa yang bertambah tiap level): 8 level; slot pekerja 1 / 1 / 2 / 2 / 3 / 4 / 5 / 6 (keputusan pemilik), hasil per pekerja dan tampungan naik tiap level (lihat tabel).
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Tebing kecil. 1 pekerja memecah batu.
  - Lv 2: Pahatan diperlebar. 1 pekerja.
  - Lv 3: Katrol kayu dipasang. 2 pekerja.
  - Lv 4: Alat besi. Hasil per pekerja naik. 2 pekerja.
  - Lv 5: Tebing kedua dibuka. 3 pekerja.
  - Lv 6: Batu kualitas tinggi ditemukan. 4 pekerja.
  - Lv 7: Gerobak besar. 5 pekerja.
  - Lv 8: Tambang Batu Agung. Hasil terbesar. 6 pekerja.
- Catatan lain: Sengaja lebih lambat dari emas karena batu lebih langka.

### Tukang Kayu (`tukang-kayu`)

> Penebang dan penggergaji kayu, tetap bekerja saat game ditutup.

- Kategori: Produksi · ukuran 2×2 · 8 level · usul terbuka Balai 1, maks sama dengan Penggilingan · maks per Balai Lv1: 1, Lv2: 1, Lv3: 2, Lv4: 2, Lv5: 3, Lv6: 3, Lv7: 3, Lv8: 4
- Sekarang: **belum ada** (objek baru, belum di `data/`).

| Lv  | Biaya                      | Waktu bangun | Butuh Balai | Efek                                                  |
| --- | -------------------------- | ------------ | ----------- | ----------------------------------------------------- |
| 1*  | 400 emas + 100 batu        | 5 mnt        | 1           | 1 slot pekerja, 80 kayu/pekerja/jam (tampung 1.200)   |
| 2*  | 1.500 emas + 400 batu      | 15 mnt       | 2           | 1 slot pekerja, 100 kayu/pekerja/jam (tampung 2.000)  |
| 3*  | 4.500 emas + 1.000 batu    | 30 mnt       | 3           | 2 slot pekerja, 125 kayu/pekerja/jam (tampung 3.500)  |
| 4*  | 12.000 emas + 2.500 batu   | 1 jam        | 4           | 2 slot pekerja, 150 kayu/pekerja/jam (tampung 5.000)  |
| 5*  | 30.000 emas + 6.000 batu   | 3 jam        | 5           | 3 slot pekerja, 180 kayu/pekerja/jam (tampung 6.500)  |
| 6*  | 70.000 emas + 14.000 batu  | 6 jam        | 6           | 4 slot pekerja, 215 kayu/pekerja/jam (tampung 8.500)  |
| 7*  | 160.000 emas + 32.000 batu | 12 jam       | 7           | 5 slot pekerja, 260 kayu/pekerja/jam (tampung 11.000) |
| 8*  | 350.000 emas + 70.000 batu | 24 jam       | 8           | 6 slot pekerja, 320 kayu/pekerja/jam (tampung 14.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, pondok kayu dengan tumpukan gelondong, kuda-kuda dan gergaji besar, serbuk kayu di tanah.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Pekerja di dalam menghasilkan **kayu**; tetap jalan saat game ditutup (menutup temuan 2).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Sama seperti Tambang Emas: hasil cukup langsung dipungut, selain itu kartu hasil + Tambah / Keluarkan pekerja / Pungut.
- Leveling (berapa level, apa yang bertambah tiap level): 8 level; slot pekerja 1 / 1 / 2 / 2 / 3 / 4 / 5 / 6 (keputusan pemilik), hasil per pekerja dan tampungan naik tiap level (lihat tabel).
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Pondok penebang kecil. 1 pekerja.
  - Lv 2: Gergaji tangan baru. 1 pekerja.
  - Lv 3: Kuda-kuda besar. 2 pekerja.
  - Lv 4: Kapak besi. Hasil per pekerja naik. 2 pekerja.
  - Lv 5: Gudang kayu. 3 pekerja.
  - Lv 6: Gergaji air dipasang. 4 pekerja.
  - Lv 7: Bengkel kayu lengkap. 5 pekerja.
  - Lv 8: Penggergajian Agung. Hasil terbesar. 6 pekerja.
- Catatan lain: Id `tukang-kayu`.

### Penggilingan (`penggilingan`)

> Pekerja di dalam menggiling gandum menjadi makanan, tetap bekerja saat game ditutup.

- Kategori: Produksi · ukuran 2×2 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 2, Lv4: 2, Lv5: 3, Lv6: 3, Lv7: 4, Lv8: 4
- Sekarang: Butuh pekerja di dalam; tetap jalan saat game ditutup.
- Sekarang saat diketuk: Bila hasil cukup: **langsung dipungut**. Selain itu kartu: hasil per pekerja, pekerja di dalam, tombol **Tambah pekerja / Keluarkan pekerja / Pungut**.

| Lv  | Biaya                                    | Waktu bangun | Butuh Balai | Efek                                                     |
| --- | ---------------------------------------- | ------------ | ----------- | -------------------------------------------------------- |
| 1*  | 300 emas + 300 kayu                      | 5 mnt        | 1           | 1 slot pekerja, 80 makanan/pekerja/jam (tampung 1.200)   |
| 2*  | 1.200 emas + 700 kayu + 200 batu         | 15 mnt       | 2           | 1 slot pekerja, 100 makanan/pekerja/jam (tampung 2.000)  |
| 3*  | 4.000 emas + 1.500 kayu + 600 batu       | 30 mnt       | 3           | 2 slot pekerja, 130 makanan/pekerja/jam (tampung 3.500)  |
| 4*  | 10.000 emas + 3.000 kayu + 1.500 batu    | 1 jam        | 4           | 2 slot pekerja, 160 makanan/pekerja/jam (tampung 5.000)  |
| 5*  | 25.000 emas + 6.500 kayu + 3.500 batu    | 3 jam        | 5           | 3 slot pekerja, 190 makanan/pekerja/jam (tampung 6.500)  |
| 6*  | 60.000 emas + 14.000 kayu + 8.000 batu   | 6 jam        | 6           | 4 slot pekerja, 230 makanan/pekerja/jam (tampung 8.500)  |
| 7*  | 140.000 emas + 30.000 kayu + 18.000 batu | 12 jam       | 7           | 5 slot pekerja, 280 makanan/pekerja/jam (tampung 11.000) |
| 8*  | 300.000 emas + 65.000 kayu + 40.000 batu | 24 jam       | 8           | 6 slot pekerja, 340 makanan/pekerja/jam (tampung 14.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, kincir angin batu dengan baling-baling kain, karung tepung di pintu; baling-baling berputar saat ada pekerja.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Pekerja di dalam menggiling gandum menjadi makanan; tetap jalan saat game ditutup.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Hasil cukup: langsung dipungut. Selain itu kartu hasil per pekerja, pekerja di dalam, tombol Tambah / Keluarkan pekerja / Pungut.
- Leveling (berapa level, apa yang bertambah tiap level): 8 level; slot pekerja 1 / 1 / 2 / 2 / 3 / 4 / 5 / 6 (keputusan pemilik), hasil per pekerja dan tampungan naik tiap level (lihat tabel).
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Kincir kecil. 1 pekerja menggiling gandum.
  - Lv 2: Baling-baling baru. 1 pekerja.
  - Lv 3: Batu giling besar. 2 pekerja.
  - Lv 4: Gudang tepung. Hasil per pekerja naik. 2 pekerja.
  - Lv 5: Kincir bertingkat. 3 pekerja.
  - Lv 6: Baling-baling ganda. 4 pekerja.
  - Lv 7: Lumbung tepung. 5 pekerja.
  - Lv 8: Penggilingan Agung. Hasil terbesar. 6 pekerja.
- Catatan lain:

### Peternakan (`peternakan`)

> Hewan tangkapan beternak di sini dan menghasilkan makanan.

- Kategori: Produksi · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 2, Lv4: 2, Lv5: 3, Lv6: 3, Lv7: 3, Lv8: 4
- Sekarang: Menampung hewan tangkapan; tiap hewan menghasilkan makanan/jam.
- Sekarang saat diketuk: Bila makanan cukup: **langsung dipungut**. Selain itu kartu: hewan di dalam, makanan/jam, tombol **Pungut**.

| Lv  | Biaya                                 | Waktu bangun | Butuh Balai | Efek                                 |
| --- | ------------------------------------- | ------------ | ----------- | ------------------------------------ |
| 1   | 400 emas + 400 kayu                   | 5 mnt        | 1           | 3 slot hewan, tampung 600 makanan    |
| 2   | 1.500 emas + 900 kayu + 200 batu      | 15 mnt       | 2           | 5 slot hewan, tampung 1.200 makanan  |
| 3   | 4.500 emas + 1.800 kayu + 700 batu    | 30 mnt       | 3           | 7 slot hewan, tampung 2.000 makanan  |
| 4*  | 12.000 emas + 4.000 kayu + 1.800 batu | 1 jam        | 4           | 9 slot hewan, tampung 3.000 makanan  |
| 5*  | 30.000 emas + 9.000 kayu + 4.500 batu | 3 jam        | 5           | 12 slot hewan, tampung 4.500 makanan |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, padang berpagar kayu dengan lumbung kecil dan palung air; hewan tangkapan terlihat berkeliaran di dalam.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Menampung hewan tangkapan; tiap hewan menghasilkan makanan/jam.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Makanan cukup: langsung dipungut. Selain itu kartu: hewan di dalam (bisa dilepas), makanan/jam, tombol **Pungut**.
- Leveling (berapa level, apa yang bertambah tiap level): 5 level. Usulan: Lv4 9 slot hewan (tampung 3.000), Lv5 12 slot (tampung 4.500).
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Padang kecil. 3 hewan.
  - Lv 2: Pagar diperluas. 5 hewan.
  - Lv 3: Lumbung ditambah. 7 hewan.
  - Lv 4: Padang luas. 9 hewan.
  - Lv 5: Peternakan besar. 12 hewan.
- Catatan lain:

### Gudang (`gudang`, menggantikan Kandang Monster `kandang`)

> Gudang desa. Simpan dekorasi dan keajaiban di sini.

- Kategori: Utama · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Kandang Monster (5 level, level tanpa efek) membuka koleksi monster. **Dihapus**; gambarnya dipakai Gudang, fungsi monster pindah ke Sarang Telur Jiwa.
- Rencana saat diketuk: kartu jumlah barang tersimpan, tombol **Buka Gudang**.

| Lv  | Biaya              | Waktu bangun | Butuh Balai | Efek                 |
| --- | ------------------ | ------------ | ----------- | -------------------- |
| 1*  | gratis (desa awal) | langsung     | 1           | membuka panel Gudang |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Dihapus. Gambar kandang dipakai untuk bangunan **Gudang** (3×3, 1 per desa, 1 level).
- Fungsi (apa yang dilakukan pemain dengan objek ini): Gudang: membuka panel Gudang (dekorasi, keajaiban, barang yang disimpan). Fungsi monster pindah ke Sarang Telur Jiwa.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Gudang: kartu jumlah barang tersimpan, tombol **Buka Gudang**.
- Leveling (berapa level, apa yang bertambah tiap level): Gudang 1 level (atau bila ingin batas simpanan, gabungkan dengan usulan Lumbung Penyimpanan).
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Gudang: gratis dan sudah ada di desa awal, tidak perlu dipercepat.
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Gudang desa. Simpan dekorasi dan keajaiban di sini.
- Catatan lain: Pemain lama yang punya kandang: kandang pertama diubah jadi Gudang, sisanya dikembalikan biayanya. Telur awal menetas di Sarang Telur Jiwa.

### Altar (`altar`, dulu Soul Mixer `soul-mixer`)

> Tempat untuk breeding monster. Menggabungkan dua monster dewasa menjadi monster jenis baru.

- Kategori: Monster · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Membuka Soul Mixer (butuh Balai Lv 4). Hanya 1 level.
- Sekarang saat diketuk: Ada hasil campuran siap (gelembung telur): **langsung membuka panel Soul Mixer**. Selain itu kartu dengan tombol **Buka Soul Mixer**.

| Lv  | Biaya                                          | Waktu bangun | Butuh Balai | Efek |
| --- | ---------------------------------------------- | ------------ | ----------- | ---- |
| 1   | 3.000 emas + 500 makanan + 800 kayu + 600 batu | 10 mnt       | 4           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, batu besar berukir rune di atas altar, asap jiwa berwarna berputar, dua lingkaran tempat induk berdiri.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Mencampur dua monster dewasa menjadi telur monster baru (butuh Balai Lv 4). Bila waktu campur selesai, langsung dapat monster baru versi **bayi** (tidak lewat telur / Sarang Telur), lalu dibesarkan seperti monster lain.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Hasil siap: monster bayi baru langsung keluar (masuk koleksi). Sedang mencampur: kartu hitung mundur + **Percepat**. Selain itu kartu dengan tombol **Buka Altar**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Bangun boleh (1 permata per menit). Waktu campur sudah bisa dipercepat.
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Tempat untuk breeding monster. Pilih dua monster dewasa dan lahirkan monster baru.
- Catatan lain: Nama dan id jadi Altar (`altar`); perlu ganti di `text.json`, CLAUDE.md, PLAN.md, dan migrasi simpanan `soul-mixer` → `altar`. CLAUDE.md ("hasil menetas sebagai bayi") perlu disesuaikan: hasil langsung jadi bayi saat waktu campur selesai, butuh slot populasi kosong.

### Kuburan (`kuburan`)

> Monster yang gugur beristirahat di sini dan bisa dihidupkan kembali.

- Kategori: Monster · ukuran 2×2 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Membuka daftar monster gugur untuk dihidupkan kembali. Hanya 1 level.
- Sekarang saat diketuk: Kartu: jumlah monster gugur, tombol **Buka Kuburan**.

| Lv  | Biaya                          | Waktu bangun | Butuh Balai | Efek |
| --- | ------------------------------ | ------------ | ----------- | ---- |
| 1   | 500 emas + 200 kayu + 300 batu | 5 mnt        | 1           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, pemakaman kecil berpagar besi, nisan batu berlumut, kabut ungu tipis dan lentera jiwa; suram tapi tidak menyeramkan.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Monster yang gugur disimpan di sini dan bisa dihidupkan kembali dengan permata.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: jumlah monster gugur, tombol **Buka Kuburan**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Tempat monster gugur beristirahat. Hidupkan mereka kembali.
- Catatan lain: Bila ingin alasan upgrade (temuan 5): 3 level dengan kapasitas monster gugur 5 / 10 / 20 sebelum yang terlama hilang.

### Sarang Telur Jiwa (`sarang-telur`)

> Rawat Telur Jiwa dari hadiah misi/eksplor di sini. Telur menetas menjadi monster langka atau epik.

- Kategori: Monster · ukuran 2×2 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Merawat Telur Jiwa (3 langkah bertimer) lalu menetaskannya. Hanya 1 level.
- Sekarang saat diketuk: Kartu: jumlah Telur Jiwa, langkah rawat & hitung mundur, tombol **Mulai rawat / Rawat / Tetaskan**.

| Lv  | Biaya                            | Waktu bangun | Butuh Balai | Efek            |
| --- | -------------------------------- | ------------ | ----------- | --------------- |
| 1*  | 1.500 emas + 500 kayu + 300 batu | 10 mnt       | 1           | 1 slot inkubasi |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, sarang jerami besar di atas batu datar, telur-telur bercahaya lembut, tiang kayu berkain hangat; bayi monster bermain di sekitarnya.
- Fungsi (apa yang dilakukan pemain dengan objek ini): (1) Merawat Telur Jiwa (3 langkah bertimer) lalu menetaskannya. (2) Inkubasi telur yang didapat (telur awal, hadiah misi / eksplor). Hasil Altar **tidak** lewat sini, langsung jadi bayi. (3) Daftar monster: beri makan bayi → remaja → dewasa, lepas monster (menggantikan Kandang).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Telur siap: langsung menetas. Selain itu kartu: telur di sarang & hitung mundur, tombol **Rawat / Tetaskan**, tombol **Koleksi monster** (panel beri makan, lepas).
- Leveling (berapa level, apa yang bertambah tiap level): 1 level, 1 slot inkubasi.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Bangun boleh (1 permata per menit). Usul langkah rawat & inkubasi juga boleh dipercepat (termasuk "mempercepat waktu" di aturan 7).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Sarang hangat untuk telur jiwa. Rawat telur, tetaskan, dan besarkan monstermu di sini.
- Catatan lain: Bisa dibangun sejak Balai 1 (keputusan pemilik). Telur awal menunggu di Gudang sampai Sarang dibangun; usul jadikan misi pertama "Bangun Sarang Telur Jiwa". Bila ingin upgrade: 3 level dengan 1 / 2 / 3 slot inkubasi.

### Pohon Emas Purba (`pohon-emas-purba`)

> Keajaiban: pohon tua berdaun emas. Menghasilkan emas dalam jumlah besar.

- Kategori: Keajaiban · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Keajaiban: hadiah misi besar, dipasang dari Gudang, tidak bisa dibangun.
- Sekarang saat diketuk: Seperti Pasar: langsung dipungut bila cukup, selain itu kartu hasil + **Pungut**.

| Lv  | Biaya  | Waktu bangun | Butuh Balai | Efek                             |
| --- | ------ | ------------ | ----------- | -------------------------------- |
| 1   | gratis | langsung     | 1           | +3.000 emas/jam (tampung 24.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, pohon raksasa berbatang tua dengan daun emas berkilau, koin jatuh pelan, akar melingkari batu.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Keajaiban: menghasilkan emas dalam jumlah besar. Hadiah misi besar, dipasang dari Gudang.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti Pasar: langsung dipungut bila cukup, selain itu kartu hasil + **Pungut**, **Pindah**, **Simpan ke Gudang**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Pohon tua berdaun emas. Menghasilkan emas dalam jumlah besar.
- Catatan lain:

### Lumbung Abadi (`lumbung-abadi`)

> Keajaiban: lumbung yang tak pernah kosong. Menghasilkan makanan dalam jumlah besar.

- Kategori: Keajaiban · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Keajaiban: hadiah set koleksi, dipasang dari Gudang.
- Sekarang saat diketuk: Seperti Pasar: langsung dipungut bila cukup, selain itu kartu hasil + **Pungut**.

| Lv  | Biaya  | Waktu bangun | Butuh Balai | Efek                                |
| --- | ------ | ------------ | ----------- | ----------------------------------- |
| 1   | gratis | langsung     | 1           | +2.000 makanan/jam (tampung 16.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, lumbung kayu merah besar dengan cahaya keemasan dari pintu, karung gandum menumpuk tak pernah habis.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Keajaiban: menghasilkan makanan dalam jumlah besar. Hadiah set koleksi.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti Pasar: langsung dipungut bila cukup, selain itu kartu hasil + **Pungut**, **Pindah**, **Simpan ke Gudang**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Lumbung yang tak pernah kosong. Menghasilkan makanan dalam jumlah besar.
- Catatan lain:

### Kolam Jiwa (`kolam-jiwa`)

> Keajaiban: kolam bercahaya tempat jiwa monster berkumpul. Menghasilkan emas sangat banyak.

- Kategori: Keajaiban · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Keajaiban: hadiah set koleksi, dipasang dari Gudang.
- Sekarang saat diketuk: Seperti Pasar: langsung dipungut bila cukup, selain itu kartu hasil + **Pungut**.

| Lv  | Biaya  | Waktu bangun | Butuh Balai | Efek                             |
| --- | ------ | ------------ | ----------- | -------------------------------- |
| 1   | gratis | langsung     | 1           | +5.000 emas/jam (tampung 40.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, kolam batu bundar berair biru-ungu bercahaya, gelembung jiwa kecil melayang naik.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Keajaiban: menghasilkan emas sangat banyak. Hadiah set koleksi.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti Pasar: langsung dipungut bila cukup, selain itu kartu hasil + **Pungut**, **Pindah**, **Simpan ke Gudang**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Kolam tempat jiwa monster berkumpul. Menghasilkan emas sangat banyak.
- Catatan lain: Usul juga menghasilkan sedikit Kristal Jiwa (mis. 2/jam) supaya cocok dengan namanya (temuan 3).

### Guild (`guild`, dulu `barak`)

> Guild. Tempat untuk mengatur guild bersama komunitas, ada misi khusus guild untuk menambah experience dan perang guild.

- Kategori: Militer · ukuran 3×3 · terbuka Balai Lv 3 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Membuka layar Serbu. **Level belum berpengaruh apa pun.**
- Sekarang saat diketuk: Kartu: batas kekuatan Serbu, tombol **Buka Serbu** (layar markas musuh).

| Lv  | Biaya                                                 | Waktu bangun | Butuh Balai | Efek                                                       |
| --- | ----------------------------------------------------- | ------------ | ----------- | ---------------------------------------------------------- |
| 1   | 600 emas + 300 kayu                                   | 5 mnt        | 3           | anggota guild maks 10 _(usulan)_                           |
| 2   | 2.000 emas + 300 makanan + 600 kayu + 200 batu        | 20 mnt       | 3           | anggota maks 15, hadiah Serbu & misi guild +5% _(usulan)_  |
| 3   | 6.000 emas + 800 makanan + 1.200 kayu + 600 batu      | 60 mnt       | 4           | anggota maks 20, hadiah Serbu & misi guild +10% _(usulan)_ |
| 4   | 15.000 emas + 2.000 makanan + 2.500 kayu + 1.500 batu | 2 jam        | 5           | anggota maks 25, hadiah Serbu & misi guild +15% _(usulan)_ |
| 5   | 40.000 emas + 5.000 makanan + 5.000 kayu + 3.000 batu | 6 jam        | 6           | anggota maks 30, hadiah Serbu & misi guild +20% _(usulan)_ |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, aula benteng kayu dengan papan misi, bendera desa, dan peta besar di dinding.
- Fungsi (apa yang dilakukan pemain dengan objek ini): (1) Guild komunitas: buat / gabung guild, misi khusus guild yang menambah pengalaman (experience) guild, perang guild. (2) Pintu masuk **Serbu** (menyerang markas musuh).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: nama & level guild, pengalaman guild, batas kekuatan Serbu, tombol **Buka Guild** (anggota, misi, perang guild) dan **Buka Serbu**.
- Leveling (berapa level, apa yang bertambah tiap level): 5 level bangunan; tiap level menaikkan anggota maksimal guild (10 / 15 / 20 / 25 / 30) dan hadiah Serbu & misi guild (+0 / 5 / 10 / 15 / 20%). Level guild (dari pengalaman guild) terpisah dari level bangunan.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Aula kecil para pejuang.
  - Lv 2: Papan misi diperluas.
  - Lv 3: Ruang strategi.
  - Lv 4: Peta wilayah lengkap.
  - Lv 5: Guild termasyhur. Anggota terbanyak, hadiah terbesar.
- Catatan lain: "Menambah Populasi" ditafsirkan sebagai **anggota guild maksimal**, bukan populasi desa; koreksi bila salah. Fitur guild butuh server dan sistem teman (setara tugas Fase 2). Ganti id `barak` → `guild` perlu migrasi simpanan: simpanan lama `barak` = Guild, `petarung` = Barak.

### Barak (`barak`, dulu Barak Prajurit `petarung`)

> Melatih prajurit berpedang dan berperisai (penahan). Level barak membuka pangkat lebih tinggi.

- Kategori: Militer · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Melatih Prajurit; jumlah level ketiga barak menaikkan batas kekuatan Serbu.
- Sekarang saat diketuk: Kartu: antrean latihan, tombol **Buka barak** (panel latih prajurit per pangkat).

| Lv  | Biaya                                                    | Waktu bangun | Butuh Balai | Efek                                      |
| --- | -------------------------------------------------------- | ------------ | ----------- | ----------------------------------------- |
| 1   | 600 emas + 300 kayu                                      | 5 mnt        | 1           | membuka pangkat Rekrut                    |
| 2   | 2.000 emas + 300 makanan + 600 kayu + 200 batu           | 15 mnt       | 3           | membuka pangkat Veteran                   |
| 3   | 6.000 emas + 800 makanan + 1.200 kayu + 600 batu         | 30 mnt       | 4           | membuka pangkat Elit                      |
| 4   | 15.000 emas + 2.000 makanan + 2.500 kayu + 1.500 batu    | 1 jam        | 5           | menambah batas kekuatan Serbu             |
| 5   | 40.000 emas + 5.000 makanan + 5.000 kayu + 3.000 batu    | 2 jam        | 6           | menambah batas kekuatan Serbu             |
| 6*  | 100.000 emas + 12.000 makanan + 12.000 kayu + 7.500 batu | 4 jam        | 7           | menambah batas kekuatan Serbu, antrean +1 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, barak kayu-batu dengan halaman latih, boneka jerami, rak pedang dan perisai.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Melatih Prajurit; level membuka pangkat dan menaikkan batas kekuatan Serbu.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: antrean latihan, tombol **Buka barak** (panel latih prajurit per pangkat).
- Leveling (berapa level, apa yang bertambah tiap level): 6 level: Lv1 Rekrut, Lv2 Veteran, Lv3 Elit, Lv4–6 menambah batas kekuatan Serbu; Lv6 juga +1 slot antrean latihan.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Bangun boleh (1 permata per menit). Usul latih prajurit juga boleh dipercepat.
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Barak sederhana. Latih Prajurit Rekrut.
  - Lv 2: Halaman latih diperluas. Pangkat Veteran terbuka.
  - Lv 3: Pelatih ahli datang. Pangkat Elit terbuka.
  - Lv 4: Barak diperkuat. Batas kekuatan Serbu naik.
  - Lv 5: Barak besar. Batas kekuatan Serbu naik lagi.
  - Lv 6: Benteng prajurit. Batas kekuatan naik, antrean +1.
- Catatan lain:

### Lapangan Pemanah (`lapangan-panah`)

> Melatih pemanah (penembak). Level barak membuka pangkat lebih tinggi.

- Kategori: Militer · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Melatih Pemanah; ikut menaikkan batas kekuatan Serbu.
- Sekarang saat diketuk: Kartu: antrean latihan, tombol **Buka barak**.

| Lv  | Biaya                                                    | Waktu bangun | Butuh Balai | Efek                                      |
| --- | -------------------------------------------------------- | ------------ | ----------- | ----------------------------------------- |
| 1   | 600 emas + 300 kayu                                      | 5 mnt        | 1           | membuka pangkat Rekrut                    |
| 2   | 2.000 emas + 300 makanan + 600 kayu + 200 batu           | 15 mnt       | 3           | membuka pangkat Veteran                   |
| 3   | 6.000 emas + 800 makanan + 1.200 kayu + 600 batu         | 30 mnt       | 4           | membuka pangkat Elit                      |
| 4   | 15.000 emas + 2.000 makanan + 2.500 kayu + 1.500 batu    | 1 jam        | 5           | menambah batas kekuatan Serbu             |
| 5   | 40.000 emas + 5.000 makanan + 5.000 kayu + 3.000 batu    | 2 jam        | 6           | menambah batas kekuatan Serbu             |
| 6*  | 100.000 emas + 12.000 makanan + 12.000 kayu + 7.500 batu | 4 jam        | 7           | menambah batas kekuatan Serbu, antrean +1 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, lapangan terbuka dengan papan sasaran bundar, pagar kayu, menara pengintai kecil, rak busur.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Melatih Pemanah; ikut menaikkan batas kekuatan Serbu.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: antrean latihan, tombol **Buka barak**.
- Leveling (berapa level, apa yang bertambah tiap level): 6 level, sama seperti Barak.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Bangun boleh (1 permata per menit). Usul latih pemanah juga boleh dipercepat.
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Lapangan kecil. Latih Pemanah Rekrut.
  - Lv 2: Sasaran baru. Pangkat Veteran terbuka.
  - Lv 3: Pemanah ahli datang. Pangkat Elit terbuka.
  - Lv 4: Lapangan diperluas. Batas kekuatan Serbu naik.
  - Lv 5: Menara pengintai. Batas kekuatan Serbu naik lagi.
  - Lv 6: Lapangan Pemanah Agung. Batas kekuatan naik, antrean +1.
- Catatan lain:

### Kandang Kuda (`kandang-kuda`, dulu Barak Berkuda `barak-berkuda`)

> Melatih penombak berkuda (petarung) yang cepat dan kuat. Level barak membuka pangkat lebih tinggi.

- Kategori: Militer · ukuran 3×3 · terbuka Balai Lv 3 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Melatih Penombak Berkuda; ikut menaikkan batas kekuatan Serbu.
- Sekarang saat diketuk: Kartu: antrean latihan, tombol **Buka barak**.

| Lv  | Biaya                                                     | Waktu bangun | Butuh Balai | Efek                                      |
| --- | --------------------------------------------------------- | ------------ | ----------- | ----------------------------------------- |
| 1   | 900 emas + 400 kayu + 100 batu                            | 7 mnt 30 dtk | 3           | membuka pangkat Rekrut                    |
| 2   | 3.000 emas + 400 makanan + 900 kayu + 300 batu            | 20 mnt       | 3           | membuka pangkat Veteran                   |
| 3   | 9.000 emas + 1.200 makanan + 1.800 kayu + 900 batu        | 40 mnt       | 4           | membuka pangkat Elit                      |
| 4   | 22.500 emas + 3.000 makanan + 3.750 kayu + 2.250 batu     | 1.5 jam      | 5           | menambah batas kekuatan Serbu             |
| 5   | 60.000 emas + 7.500 makanan + 7.500 kayu + 4.500 batu     | 3 jam        | 6           | menambah batas kekuatan Serbu             |
| 6*  | 150.000 emas + 18.000 makanan + 18.000 kayu + 11.000 batu | 6 jam        | 7           | menambah batas kekuatan Serbu, antrean +1 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, istal kayu dengan palung jerami, kepala kuda terlihat dari pintu, tombak bersandar di dinding.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Melatih Penombak Berkuda; ikut menaikkan batas kekuatan Serbu.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: antrean latihan, tombol **Buka barak**.
- Leveling (berapa level, apa yang bertambah tiap level): 6 level, sama seperti Barak.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Bangun boleh (1 permata per menit). Usul latih penombak juga boleh dipercepat.
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Istal kecil. Latih Penombak Berkuda Rekrut.
  - Lv 2: Kuda pilihan. Pangkat Veteran terbuka.
  - Lv 3: Penunggang ahli datang. Pangkat Elit terbuka.
  - Lv 4: Istal diperluas. Batas kekuatan Serbu naik.
  - Lv 5: Lapangan pacu. Batas kekuatan Serbu naik lagi.
  - Lv 6: Kandang Kuda Agung. Batas kekuatan naik, antrean +1.
- Catatan lain: Ganti id perlu migrasi simpanan.

### Bengkel (`bengkel`)

> Tukang ahli membuat mesin perang untuk merobohkan tembok dan menara musuh.

- Kategori: Militer · ukuran 3×3 · 6 level · terbuka Balai Lv 4 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 0, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: **belum ada** (objek baru, belum di `data/`).

| Lv  | Biaya                                                     | Waktu bangun | Butuh Balai | Efek                                                                                     |
| --- | --------------------------------------------------------- | ------------ | ----------- | ---------------------------------------------------------------------------------------- |
| 1*  | 8.000 emas + 2.000 kayu + 2.000 batu                      | 1 jam        | 4           | Ketapel & Pendobrak Kayu Kecil (statistik ×1)                                            |
| 2*  | 20.000 emas + 2.000 makanan + 5.000 kayu + 5.000 batu     | 2 jam        | 5           | Ketapel Veteran & Pendobrak Kayu Besar (×1,3)                                            |
| 3*  | 45.000 emas + 5.000 makanan + 10.000 kayu + 10.000 batu   | 4 jam        | 6           | Ketapel Elit & Pendobrak Besi (×1,6)                                                     |
| 4*  | 90.000 emas + 10.000 makanan + 20.000 kayu + 20.000 batu  | 8 jam        | 6           | Ketapel Api & Pendobrak Besi Besar (×2,0), batas kekuatan Serbu naik                     |
| 5*  | 180.000 emas + 20.000 makanan + 40.000 kayu + 40.000 batu | 16 jam       | 7           | Double Ketapel Api & Pendobrak Pegas (×2,4), batas kekuatan Serbu naik                   |
| 6*  | 350.000 emas + 40.000 makanan + 80.000 kayu + 80.000 batu | 24 jam       | 8           | Double Ketapel Api Besar & Pendobrak Pegas Cepat (×2,8), batas kekuatan naik, antrean +1 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, bengkel tukang dengan tungku menyala, roda kayu, kerangka ketapel setengah jadi, asap dari cerobong.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Membuat **2 mesin perang** untuk Serbu: **Ketapel** (jangkauan jauh, kuat melawan bangunan & tembok, lambat, HP kecil) dan **Pendobrak** (jarak dekat, hanya menyerang tembok / gerbang / bangunan, HP besar). Tiap level Bengkel meng-upgrade kedua mesin ke versi berikutnya (nama & rupa berubah, statistik naik). Ikut menaikkan batas kekuatan Serbu.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: antrean pembuatan, tombol **Buka bengkel** (panel buat mesin).
- Leveling (berapa level, apa yang bertambah tiap level): 6 level = 6 versi tiap mesin, statistik ×1 / 1,3 / 1,6 / 2,0 / 2,4 / 2,8; mesin yang sudah dibuat ikut naik versi. Lv4–6 juga menaikkan batas kekuatan Serbu. Usulan dasar Ketapel: HP 120, serangan 45, pertahanan 4, jangkauan 7, 3 poin kekuatan, 400 emas + 200 kayu + 150 batu, 4 mnt. Usulan dasar Pendobrak: HP 300, serangan 60 (hanya bangunan), pertahanan 10, jangkauan 1, 3 poin kekuatan, 350 emas + 300 kayu + 100 batu, 4 mnt.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Bangun boleh (1 permata per menit). Usul buat mesin juga boleh dipercepat.
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Bengkel kecil. Buat Ketapel & Pendobrak kayu kecil.
  - Lv 2: Tungku lebih panas. Ketapel Veteran & Pendobrak kayu besar.
  - Lv 3: Tukang ahli datang. Ketapel Elit & Pendobrak besi.
  - Lv 4: Bengkel diperluas. Batas kekuatan Serbu naik. Ketapel Api & Pendobrak besi besar.
  - Lv 5: Gudang suku cadang. Batas kekuatan Serbu naik lagi. Double Ketapel Api & Pendobrak Dengan Pegas.
  - Lv 6: Bengkel Agung. Batas kekuatan naik, antrean +1. Double Ketapel Api Besar & Pendobrak Dengan Pegas lebih cepat.
- Catatan lain: Beda dengan prajurit: prajurit punya pangkat yang dilatih terpisah, mesin perang cukup naik versi bersama level Bengkel. Rumus batas kekuatan sekarang "jumlah level ketiga barak" → jadi empat bangunan, perlu diseimbangkan ulang. Mesin bukan monster, jadi aman untuk aturan 7.

### Gerbang Petualangan (`gerbang-petualangan`)

> Pintu menuju wilayah liar dan para bos. Kalahkan bos untuk membuka tingkat Altar berikutnya.

- Kategori: Militer · ukuran 3×3 · 4 level · maks per Balai Lv1: 0, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: Membuka peta Petualangan (wilayah, titik sumber daya, bos). Hanya 1 level.
- Sekarang saat diketuk: Kartu: kemajuan Petualangan, tombol **Buka Petualangan** (peta wilayah).

| Lv  | Biaya                                 | Waktu bangun | Butuh Balai | Efek                                         |
| --- | ------------------------------------- | ------------ | ----------- | -------------------------------------------- |
| 1   | 1.500 emas + 400 kayu + 300 batu      | 5 mnt        | 2           | membuka wilayah Hutan Berbisik               |
| 2*  | 3.000 emas + 700 kayu + 1.200 batu    | 30 mnt       | 3           | membuka wilayah Rawa Kabut                   |
| 3*  | 10.500 emas + 1.200 kayu + 3.000 batu | 3 jam        | 4           | membuka wilayah Gunung Api                   |
| 4*  | 30.000 emas + 5.000 kayu + 5.000 batu | 6 jam        | 5           | membuka wilayah ke-4 (baru, belum dirancang) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 3×3, gapura batu tua berukir dengan portal berkabut di tengah, obor di kedua sisi, jalan setapak menuju hutan.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Membuka peta Petualangan (wilayah, titik sumber daya, bos). Bos yang dikalahkan menaikkan tingkat hasil Altar.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: kemajuan Petualangan (bos dikalahkan / total), tombol **Buka Petualangan**.
- Leveling (berapa level, apa yang bertambah tiap level): 4 level; tiap level membuka satu wilayah Petualangan berikutnya (sekarang wilayah dibuka oleh level Balai saja).
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Gapura menuju wilayah liar dari kayu. Kalahkan bos untuk membuka monster tingkat lebih tinggi.
  - Lv 2: Gapura menuju wilayah liar dari batu. Kalahkan bos untuk membuka monster tingkat lebih tinggi.
  - Lv 3: Gapura menuju wilayah liar dari besi. Kalahkan bos untuk membuka monster tingkat lebih tinggi.
  - Lv 4: Gapura menuju wilayah liar dari emas. Kalahkan bos untuk membuka monster tingkat lebih tinggi.
- Catatan lain: Biaya Lv4 diturunkan dari 100.500 ke 30.000 emas (lompatan 10× dianggap salah ketik). Wilayah ke-4 perlu dirancang (bos, titik sumber daya) di `data/adventure.json`.

### Arena (`arena`)

> Duel monster 3 lawan 3. Arena segera hadir.

- Kategori: Militer · ukuran 4×4 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: **Belum berfungsi** ("Arena segera hadir", Tugas 2.3).
- Sekarang saat diketuk: Kartu: "Arena segera hadir".

| Lv  | Biaya                                              | Waktu bangun | Butuh Balai | Efek |
| --- | -------------------------------------------------- | ------------ | ----------- | ---- |
| 1   | 5.000 emas + 500 makanan + 1.000 kayu + 1.000 batu | 15 mnt       | 3           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 4×4, arena bundar berlantai pasir, tribun batu, panji enam unsur di sekeliling.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Duel monster 3 lawan 3 (Tugas 2.3).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Sekarang "Arena segera hadir". Nanti: kartu peringkat musim, tombol **Pilih 3 monster** dan **Cari lawan**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Arena duel monster 3 lawan 3.
- Catatan lain: Detail diisi saat Tugas 2.3.

### Menara Jaga (`menara`)

> Menembak penyerang dari jauh.

- Kategori: Militer · ukuran 2×2 · maks per Balai Lv1: 0, Lv2: 1, Lv3: 2, Lv4: 3, Lv5: 4, Lv6: 5, Lv7: 6, Lv8: 7
- Sekarang: Menembak musuh serangan desa dalam jangkauan.
- Sekarang saat diketuk: Kartu: HP, serangan, jangkauan menara.

| Lv  | Biaya                    | Waktu bangun | Butuh Balai | Efek                                    |
| --- | ------------------------ | ------------ | ----------- | --------------------------------------- |
| 1   | 400 emas + 300 batu      | 5 mnt        | 2           | HP 600, serangan 20, jangkauan 6 petak  |
| 2   | 1.500 emas + 800 batu    | 15 mnt       | 3           | HP 1000, serangan 32, jangkauan 6 petak |
| 3   | 4.000 emas + 1.800 batu  | 30 mnt       | 4           | HP 1600, serangan 48, jangkauan 6 petak |
| 4*  | 10.000 emas + 4.000 batu | 1 jam        | 5           | HP 2400, serangan 68, jangkauan 7 petak |
| 5*  | 25.000 emas + 9.000 batu | 3 jam        | 6           | HP 3400, serangan 90, jangkauan 7 petak |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, menara kayu-batu ramping beratap runcing, pemanah terlihat di puncak.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Menembak musuh serangan desa dalam jangkauan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: HP, serangan, jangkauan (lingkaran jangkauan tampil di tanah).
- Leveling (berapa level, apa yang bertambah tiap level): 5 level. Usulan: Lv4 HP 2.400, serangan 68, jangkauan 7; Lv5 HP 3.400, serangan 90, jangkauan 7.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Menara kayu. Menembak penyerang dari jauh.
  - Lv 2: Menara diperkuat. Serangan naik.
  - Lv 3: Menara batu. HP dan serangan naik.
  - Lv 4: Menara tinggi. Jangkauan lebih jauh.
  - Lv 5: Menara Jaga Agung. Tembakan terkuat.
- Catatan lain:

### Menara Sihir (`menara-sihir`)

> Menara penyihir. Jangkauan pendek, tapi ledakannya kuat dan mengenai beberapa musuh.

- Kategori: Militer · ukuran 2×2 · 5 level · usul terbuka Balai Lv 3 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 1, Lv4: 2, Lv5: 2, Lv6: 3, Lv7: 3, Lv8: 4
- Sekarang: **belum ada** (objek baru, belum di `data/`).

| Lv  | Biaya                      | Waktu bangun | Butuh Balai | Efek                                                |
| --- | -------------------------- | ------------ | ----------- | --------------------------------------------------- |
| 1*  | 3.000 emas + 1.500 batu    | 30 mnt       | 3           | HP 500, serangan 45 (area kecil), jangkauan 4 petak |
| 2*  | 8.000 emas + 3.500 batu    | 1 jam        | 4           | HP 800, serangan 70, jangkauan 4 petak              |
| 3*  | 20.000 emas + 8.000 batu   | 3 jam        | 5           | HP 1200, serangan 100, jangkauan 4 petak            |
| 4*  | 50.000 emas + 18.000 batu  | 6 jam        | 6           | HP 1700, serangan 130, jangkauan 4 petak            |
| 5*  | 120.000 emas + 40.000 batu | 12 jam       | 7           | HP 2200, serangan 160, jangkauan 4 petak            |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, menara batu bundar berkubah kristal ungu bercahaya, rune melayang di sekitarnya.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Menembak musuh serangan desa: jangkauan pendek (4 petak), serangan kuat, kerusakan area kecil, tembakan lambat.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: HP, serangan, jangkauan, kecepatan tembak.
- Leveling (berapa level, apa yang bertambah tiap level): 5 level. Usulan: Lv1 HP 500 serangan 45, Lv2 HP 800 serangan 70, Lv3 HP 1.200 serangan 100, Lv4 HP 1.700 serangan 130, Lv5 HP 2.200 serangan 160; jangkauan 4 petak.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Menara sihir kecil. Ledakan jarak dekat.
  - Lv 2: Kristal lebih terang. Serangan naik.
  - Lv 3: Rune baru. Ledakan lebih luas.
  - Lv 4: Kubah kristal besar. Serangan naik lagi.
  - Lv 5: Menara Sihir Agung. Ledakan terkuat.
- Catatan lain: Bisa digabung dengan usulan Menara Elemen (menara punya elemen, memakai keunggulan elemen).

### Pohon Jiwa (`pohon-jiwa`)

> Pohon bercahaya yang menyembuhkan luka pasukan.

- Kategori: Militer · ukuran 2×2 · 5 level · usul terbuka Balai Lv 2 · maks per Balai Lv1: 0, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: **belum ada** (objek baru, belum di `data/`).

| Lv  | Biaya                                    | Waktu bangun | Butuh Balai | Efek                                                 |
| --- | ---------------------------------------- | ------------ | ----------- | ---------------------------------------------------- |
| 1*  | 2.000 emas + 800 kayu + 500 batu         | 15 mnt       | 2           | pulih 2% HP/mnt                                      |
| 2*  | 6.000 emas + 2.000 kayu + 1.500 batu     | 1 jam        | 3           | pulih 3% HP/mnt                                      |
| 3*  | 15.000 emas + 5.000 kayu + 4.000 batu    | 3 jam        | 4           | pulih 4% HP/mnt, menyembuhkan pembela radius 5 petak |
| 4*  | 40.000 emas + 12.000 kayu + 10.000 batu  | 8 jam        | 5           | pulih 5% HP/mnt                                      |
| 5*  | 100.000 emas + 30.000 kayu + 25.000 batu | 16 jam       | 6           | pulih 6% HP/mnt                                      |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, pohon kecil bercahaya hijau-toska dengan daun berbentuk tetesan jiwa, akar memeluk mata air kecil.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Menyembuhkan monster dan prajurit yang terluka setelah bertarung (HP pulih per menit di desa).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: kecepatan penyembuhan, unit yang sedang disembuhkan, tombol **Sembuhkan semua** (bila boleh pakai permata).
- Leveling (berapa level, apa yang bertambah tiap level): 5 level. Usulan pemulihan: 2% / 3% / 4% / 5% / 6% HP per menit. Lv3+: juga menyembuhkan unit pembela dalam radius 5 petak saat serangan desa.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Boleh, harga umum 1 permata per menit sisa (minimal 1).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Tunas jiwa. Pasukan pulih perlahan.
  - Lv 2: Pohon tumbuh. Pemulihan lebih cepat.
  - Lv 3: Daun bercahaya. Menyembuhkan pembela saat diserang.
  - Lv 4: Pohon rindang. Pemulihan cepat.
  - Lv 5: Pohon Jiwa Agung. Pemulihan tercepat.
- Catatan lain: Bedanya dengan Kuburan: Pohon Jiwa untuk yang terluka, Kuburan untuk yang gugur. "Sembuhkan semua" dengan permata tidak ada di daftar aturan 7, perlu keputusan.

### Perpustakaan (`perpustakaan`)

> Tempat para cendekiawan meneliti teknologi dan rahasia jiwa.

- Kategori: Utama · ukuran 2×2 · 5 level · usul terbuka Balai Lv 3 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1, Lv7: 1, Lv8: 1
- Sekarang: **belum ada** (objek baru, belum di `data/`).

| Lv  | Biaya                                    | Waktu bangun | Butuh Balai | Efek                              |
| --- | ---------------------------------------- | ------------ | ----------- | --------------------------------- |
| 1*  | 5.000 emas + 2.000 kayu + 2.000 batu     | 1 jam        | 3           | riset tingkat 1                   |
| 2*  | 15.000 emas + 5.000 kayu + 5.000 batu    | 3 jam        | 4           | riset tingkat 2                   |
| 3*  | 40.000 emas + 12.000 kayu + 12.000 batu  | 8 jam        | 5           | riset tingkat 3                   |
| 4*  | 100.000 emas + 30.000 kayu + 30.000 batu | 16 jam       | 6           | riset tingkat 4                   |
| 5*  | 250.000 emas + 70.000 kayu + 70.000 batu | 32 jam       | 7           | riset tingkat 5, antrean riset +1 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, gedung batu berkubah dengan rak buku terlihat dari jendela, teleskop kecil di atap.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Riset: satu riset berjalan sekaligus, biaya emas + Kristal Jiwa + waktu. Contoh cabang: Produksi (+5% hasil tambang), Militer (+5% HP prajurit), Monster (makanan monster −10%, petunjuk resep rahasia Altar — menyatukan usulan Perpustakaan Jiwa).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: riset yang berjalan & hitung mundur, tombol **Buka Perpustakaan** (panel pohon riset).
- Leveling (berapa level, apa yang bertambah tiap level): 5 level; tiap level membuka riset tingkat berikutnya. Lv5 juga +1 antrean riset.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Bangun boleh (1 permata per menit). Riset juga boleh dipercepat.
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Ruang baca kecil. Riset dasar terbuka.
  - Lv 2: Rak buku bertambah. Riset tingkat 2.
  - Lv 3: Teleskop dipasang. Riset tingkat 3.
  - Lv 4: Arsip kuno. Riset tingkat 4.
  - Lv 5: Perpustakaan Agung. Riset tertinggi, antrean +1.
- Catatan lain: Angka riset ke `rules.json`, efek dihitung server. Pohon riset lengkap perlu dirancang terpisah.

### Tembok (`tembok`)

> Pagar kayu lalu tembok batu. Dibangun sebaris: ketuk titik awal lalu titik akhir.

- Kategori: Militer · ukuran 1×1 · maks per Balai Lv1: 0, Lv2: 40, Lv3: 60, Lv4: 80, Lv5: 100, Lv6: 120, Lv7: 140, Lv8: 160
- Sekarang: Menghalangi jalan musuh serangan desa (musuh memutar atau menjebol).
- Sekarang saat diketuk: Kartu: HP ruas, tombol **Upgrade semua (N ruas)** dan **Pindah semua** untuk tembok yang tersambung.

| Lv  | Biaya               | Waktu bangun | Butuh Balai | Efek          |
| --- | ------------------- | ------------ | ----------- | ------------- |
| 1   | 10 kayu             | langsung     | 2           | HP ruas 400   |
| 2   | 10 kayu + 20 batu   | langsung     | 3           | HP ruas 1000  |
| 3   | 30 emas + 50 batu   | langsung     | 4           | HP ruas 2000  |
| 4*  | 80 emas + 80 batu   | langsung     | 5           | HP ruas 3200  |
| 5*  | 150 emas + 120 batu | langsung     | 6           | HP ruas 4600  |
| 6*  | 300 emas + 180 batu | langsung     | 6           | HP ruas 6200  |
| 7*  | 500 emas + 260 batu | langsung     | 7           | HP ruas 8000  |
| 8*  | 800 emas + 350 batu | langsung     | 8           | HP ruas 10000 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1 per ruas, disambung otomatis: Lv1–2 pagar kayu runcing, Lv3–4 tembok batu, Lv5–6 batu berbenteng, Lv7–8 batu berukir rune bercahaya.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Menghalangi jalan musuh serangan desa (musuh memutar atau menjebol).
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: HP ruas, tombol **Upgrade semua (N ruas)** dan **Pindah semua** untuk tembok yang tersambung.
- Leveling (berapa level, apa yang bertambah tiap level): 8 level, HP ruas 400 / 1.000 / 2.000 / 3.200 / 4.600 / 6.200 / 8.000 / 10.000. Usulan biaya Lv4–8 per ruas: 80 emas + 80 batu, 150 + 120, 300 + 180, 500 + 260, 800 + 350.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Pagar kayu sederhana.
  - Lv 2: Pagar kayu diperkuat batu.
  - Lv 3: Tembok batu.
  - Lv 4: Tembok batu tebal.
  - Lv 5: Tembok berbenteng.
  - Lv 6: Benteng kokoh.
  - Lv 7: Tembok berukir rune.
  - Lv 8: Tembok Jiwa. Paling kuat.
- Catatan lain: Butuh gambar ruas baru untuk Lv4–8 (`pnpm art:wall`).

### Gerbang (`gerbang`)

> Pintu di tembok. Pasukanmu bisa lewat, musuh harus menjebolnya.

- Kategori: Militer · ukuran 1×1 · 8 level · terbuka bersama Tembok (Balai Lv 2) · maks per Balai Lv1: 0, Lv2: 4, Lv3: 4, Lv4: 4, Lv5: 4, Lv6: 4, Lv7: 4, Lv8: 4
- Sekarang: **belum ada** (objek baru, belum di `data/`).

| Lv  | Biaya                   | Waktu bangun | Butuh Balai | Efek     |
| --- | ----------------------- | ------------ | ----------- | -------- |
| 1*  | 30 kayu                 | langsung     | 2           | HP 600   |
| 2*  | 30 kayu + 60 batu       | langsung     | 3           | HP 1500  |
| 3*  | 90 emas + 150 batu      | langsung     | 4           | HP 3000  |
| 4*  | 240 emas + 240 batu     | langsung     | 5           | HP 4800  |
| 5*  | 450 emas + 360 batu     | langsung     | 6           | HP 6900  |
| 6*  | 900 emas + 540 batu     | langsung     | 6           | HP 9300  |
| 7*  | 1.500 emas + 780 batu   | langsung     | 7           | HP 12000 |
| 8*  | 2.400 emas + 1.050 batu | langsung     | 8           | HP 15000 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, pintu kayu berpalang di antara dua tiang tembok; rupanya mengikuti level tembok (kayu → batu → rune).
- Fungsi (apa yang dilakukan pemain dengan objek ini): Dipasang dalam barisan tembok. Terbuka: unit sendiri dan pekerja bisa lewat. Tertutup: tidak ada yang lewat. Musuh tidak bisa lewat dan harus menjebol.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu: HP, keadaan, tombol **Buka / Tutup**, **Upgrade**, **Pindah**. Tutup otomatis saat serangan desa.
- Leveling (berapa level, apa yang bertambah tiap level): 8 level, HP 1,5× tembok setingkat. Biaya 3× ruas tembok setingkat.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Pintu pagar kayu.
  - Lv 2: Pintu kayu diperkuat.
  - Lv 3: Gerbang batu.
  - Lv 4: Gerbang batu tebal.
  - Lv 5: Gerbang berbenteng.
  - Lv 6: Gerbang besi.
  - Lv 7: Gerbang berukir rune.
  - Lv 8: Gerbang Jiwa. Paling kuat.
- Catatan lain: Butuh potongan gerbang di `tembok-pieces.json` dan jalur (pathfinding) yang membedakan unit sendiri dan musuh.

### Pohon Hias (`pohon-hias`)

> Pohon rindang untuk mempercantik desa.

- Kategori: Dekorasi · ukuran 1×1 · maks per Balai Lv1: 30, Lv2: 30, Lv3: 30, Lv4: 30, Lv5: 30, Lv6: 30, Lv7: 30, Lv8: 30
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya    | Waktu bangun | Butuh Balai | Efek                   |
| --- | -------- | ------------ | ----------- | ---------------------- |
| 1   | 100 emas | langsung     | 1           | populasi +2 _(usulan)_ |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, pohon bulat rindang dipangkas rapi, batang pendek.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Dekorasi, tambah populasi 2.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu dekorasi: populasi +2, **Pindah, Putar, Simpan ke Gudang, Jual**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Pohon rindang untuk mempercantik desa. Populasi +2.
- Catatan lain: Maks 30 pohon × 2 = +60 populasi, 40 bunga × 2 = +80: dekorasi bisa mengalahkan Rumah. Usul turunkan maks per Balai atau jadikan populasi dekorasi punya batas total.

### Taman Bunga (`bunga`)

> Bunga warna-warni.

- Kategori: Dekorasi · ukuran 1×1 · maks per Balai Lv1: 40, Lv2: 40, Lv3: 40, Lv4: 40, Lv5: 40, Lv6: 40, Lv7: 40, Lv8: 40
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya   | Waktu bangun | Butuh Balai | Efek                   |
| --- | ------- | ------------ | ----------- | ---------------------- |
| 1   | 50 emas | langsung     | 1           | populasi +2 _(usulan)_ |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, petak bunga warna-warni (merah, kuning, ungu) berpinggiran batu kecil.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Dekorasi, tambah populasi 2.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu dekorasi: populasi +2, **Pindah, Putar, Simpan ke Gudang, Jual**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Bunga warna-warni. Populasi +2.
- Catatan lain: Lihat catatan Pohon Hias soal batas populasi dekorasi.

### Lampu Jalan (`lampu`)

> Lentera jiwa yang menyala lembut.

- Kategori: Dekorasi · ukuran 1×1 · maks per Balai Lv1: 0, Lv2: 20, Lv3: 20, Lv4: 20, Lv5: 20, Lv6: 20, Lv7: 20, Lv8: 20
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya              | Waktu bangun | Butuh Balai | Efek                   |
| --- | ------------------ | ------------ | ----------- | ---------------------- |
| 1   | 150 emas + 20 batu | langsung     | 2           | populasi +2 _(usulan)_ |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, tiang besi dengan lentera jiwa biru yang menyala lembut, lebih terang di malam hari.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Dekorasi, tambah populasi 2.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu dekorasi: populasi +2, **Pindah, Putar, Simpan ke Gudang, Jual**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Lentera jiwa yang menyala lembut. Populasi +2.
- Catatan lain:

### Air Mancur (`air-mancur`)

> Air mancur batu di alun-alun.

- Kategori: Dekorasi · ukuran 2×2 · maks per Balai Lv1: 0, Lv2: 2, Lv3: 3, Lv4: 3, Lv5: 3, Lv6: 3, Lv7: 3, Lv8: 3
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya                 | Waktu bangun | Butuh Balai | Efek                   |
| --- | --------------------- | ------------ | ----------- | ---------------------- |
| 1   | 2.500 emas + 300 batu | langsung     | 2           | populasi +5 _(usulan)_ |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, air mancur batu bertingkat di alun-alun, air biru jernih memercik.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Dekorasi, tambah populasi 5.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu dekorasi: populasi +5, **Pindah, Putar, Simpan ke Gudang, Jual**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Air mancur batu di alun-alun. Populasi +5.
- Catatan lain:

### Patung Naga (`patung`)

> Patung emas sang naga purba.

- Kategori: Dekorasi · ukuran 1×1 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 5, Lv4: 5, Lv5: 5, Lv6: 5, Lv7: 5, Lv8: 5
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya                 | Waktu bangun | Butuh Balai | Efek                    |
| --- | --------------------- | ------------ | ----------- | ----------------------- |
| 1   | 1.000 emas + 200 batu | langsung     | 3           | populasi +10 _(usulan)_ |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, patung naga purba berlapis emas di atas alas batu.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Dekorasi, tambah populasi 10.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu dekorasi: populasi +10, **Pindah, Putar, Simpan ke Gudang, Jual**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Patung emas sang naga purba. Populasi +10.
- Catatan lain:

### Monumen Keajaiban (`monumen-keajaiban`)

> Tugu agung berukir enam unsur. Kebanggaan seluruh desa.

- Kategori: Dekorasi · ukuran 2×2 · 1 level · usul terbuka Balai Lv 5 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 0, Lv4: 0, Lv5: 2, Lv6: 2, Lv7: 2, Lv8: 2
- Sekarang: **belum ada** (objek baru, belum di `data/`).

| Lv  | Biaya                    | Waktu bangun | Butuh Balai | Efek         |
| --- | ------------------------ | ------------ | ----------- | ------------ |
| 1*  | 10.000 emas + 1.500 batu | langsung     | 5           | populasi +15 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 2×2, obelisk batu putih berukir enam unsur dasar (api, air, tanah, angin, cahaya, kegelapan), kristal bercahaya di puncak.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Dekorasi, tambah populasi 15.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu dekorasi: populasi +15, **Pindah, Putar, Simpan ke Gudang, Jual**.
- Leveling (berapa level, apa yang bertambah tiap level): 1 level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak perlu (langsung jadi).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Tugu agung enam unsur. Populasi +15.
- Catatan lain: Usulan biaya: 10.000 emas + 1.500 batu.

## 2. Alam liar (diambil pekerja)

Hanya berjalan selama game dibuka. Ada peluang Kristal Jiwa dan peluang penyergapan musuh saat selesai.

**Saat diketuk** (sekarang): kartu berisi hasil, kemajuan & sisa waktu, pemilih jumlah pekerja (− / +) dengan perkiraan waktu, tombol **Kirim pekerja** atau **Panggil pulang**. Bisa juga dijaga monster/prajurit lewat mode **Pilih**.

| Objek          | id           | Hasil                | Kerja        | Pekerja maks | Kristal Jiwa | Penyergapan | Pulau                                           |
| -------------- | ------------ | -------------------- | ------------ | ------------ | ------------ | ----------- | ----------------------------------------------- |
| Pohon Liar     | `pohon`      | 50 kayu              | 1 mnt        | 3            | 10%          | 4%          | Pulau Utama                                     |
| Batu Besar     | `batu`       | 50 batu              | 1 mnt 30 dtk | 3            | 30%          | 3%          | Pulau Utama                                     |
| Semak Berduri  | `semak`      | 25 makanan           | 30 dtk       | 2            | 5%           | 2%          | Pulau Utama                                     |
| Batu Emas      | `batu-emas`  | 150 emas             | 1 mnt 15 dtk | 2            | 10%          | 5%          | Pulau Utama (urat emas); terisi lagi tiap 6 jam |
| Kaktus Raksasa | `kaktus`     | 50 kayu + 15 makanan | 1 mnt 10 dtk | 3            | 12%          | 5%          | Pulau Gurun                                     |
| Batu Pasir     | `batu-pasir` | 60 batu + 20 emas    | 1 mnt 40 dtk | 3            | 35%          | 4%          | Pulau Gurun                                     |
| Cemara Salju   | `cemara`     | 80 kayu              | 1 mnt 30 dtk | 3            | 15%          | 6%          | Pulau Salju                                     |
| Bongkahan Es   | `batu-es`    | 80 batu              | 2 mnt        | 3            | 45%          | 5%          | Pulau Salju                                     |

### Pohon Liar (`pohon`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, pohon hutan rimbun berbatang coklat, lebih liar dan tak beraturan dari Pohon Hias.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Kirim pekerja untuk mengambil kayu. Hanya berjalan saat game dibuka; ada peluang Kristal Jiwa dan penyergapan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti sekarang: kartu hasil, kemajuan & sisa waktu, pemilih jumlah pekerja, **Kirim pekerja** / **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Pohon hutan. Tebang untuk mendapat kayu.
- Catatan lain:

### Batu Besar (`batu`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, bongkah batu abu-abu retak berlumut, kilau ungu kecil di celahnya (Kristal Jiwa).
- Fungsi (apa yang dilakukan pemain dengan objek ini): Kirim pekerja untuk mengambil batu. Hanya berjalan saat game dibuka; ada peluang Kristal Jiwa dan penyergapan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti sekarang: kartu hasil, kemajuan & sisa waktu, pemilih jumlah pekerja, **Kirim pekerja** / **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Batu besar. Pecahkan untuk mendapat batu.
- Catatan lain:

### Semak Berduri (`semak`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, semak hijau gelap berduri dengan beri merah.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Kirim pekerja untuk mengambil makanan. Hanya berjalan saat game dibuka; ada peluang Kristal Jiwa dan penyergapan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti sekarang: kartu hasil, kemajuan & sisa waktu, pemilih jumlah pekerja, **Kirim pekerja** / **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Semak berbuah. Petik untuk mendapat makanan.
- Catatan lain:

### Batu Emas (`batu-emas`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, batu berurat emas berkilau kecil-kecil yang bertebarang di tanah; setelah diambil jadi batu kusam lalu berkilau lagi.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Kirim pekerja untuk mengambil emas. Hanya berjalan saat game dibuka; ada peluang Kristal Jiwa dan penyergapan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti sekarang: kartu hasil, kemajuan & sisa waktu, pemilih jumlah pekerja, **Kirim pekerja** / **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Urat emas. Terisi lagi setiap 6 jam.
- Catatan lain:

### Kaktus Raksasa (`kaktus`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, kaktus tinggi bercabang dengan bunga merah muda di puncak.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Kirim pekerja untuk mengambil kayu dan makanan. Hanya berjalan saat game dibuka; ada peluang Kristal Jiwa dan penyergapan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti sekarang: kartu hasil, kemajuan & sisa waktu, pemilih jumlah pekerja, **Kirim pekerja** / **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Kaktus gurun. Menghasilkan kayu dan makanan.
- Catatan lain:

### Batu Pasir (`batu-pasir`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, batu pasir oranye berlapis-lapis, terkikis angin.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Kirim pekerja untuk mengambil batu dan sedikit emas. Hanya berjalan saat game dibuka; ada peluang Kristal Jiwa dan penyergapan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti sekarang: kartu hasil, kemajuan & sisa waktu, pemilih jumlah pekerja, **Kirim pekerja** / **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Batu pasir gurun. Menghasilkan batu dan sedikit emas.
- Catatan lain:

### Cemara Salju (`cemara`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, pohon cemara runcing dengan salju di dahan.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Kirim pekerja untuk mengambil kayu. Hanya berjalan saat game dibuka; ada peluang Kristal Jiwa dan penyergapan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti sekarang: kartu hasil, kemajuan & sisa waktu, pemilih jumlah pekerja, **Kirim pekerja** / **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Cemara bersalju. Kayu lebih banyak dari pohon biasa.
- Catatan lain:

### Bongkahan Es (`batu-es`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): 1×1, bongkah es biru bening dengan kristal terperangkap di dalamnya.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Kirim pekerja untuk mengambil batu. Hanya berjalan saat game dibuka; ada peluang Kristal Jiwa dan penyergapan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti sekarang: kartu hasil, kemajuan & sisa waktu, pemilih jumlah pekerja, **Kirim pekerja** / **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Bongkahan es. Peluang Kristal Jiwa tertinggi.
- Catatan lain:

## 3. Hewan liar (diburu atau ditangkap pekerja)

Muncul lagi tiap 24 jam. Diburu (Menggunakan Prajurit) → makanan sekali; ditangkap (Menggunakan Pekerja) → tinggal di Peternakan dan menghasilkan makanan/jam.

**Saat diketuk** (sekarang): kartu hewan, pemilih jumlah pekerja, tombol **Buru (waktu)** dan **Tangkap (waktu)** (tangkap butuh slot kosong di Peternakan), atau **Panggil pulang** bila sedang dikerjakan.

**Rencana:** **Buru** memakai prajurit (pemilih prajurit), **Tangkap** memakai pekerja (pemilih pekerja). Saat serangan desa, prajurit yang sedang berburu ikut bertahan bila jaraknya **≤ 4 petak** dari desa; lebih jauh dari itu tidak ikut. Angka 4 petak masuk `rules.json`.

| Hewan      | id           | Buru                       | Tangkap      | Pekerja maks | Di Peternakan  |
| ---------- | ------------ | -------------------------- | ------------ | ------------ | -------------- |
| Ayam Hutan | `ayam-hutan` | 40 dtk → 30 makanan        | 1 mnt 30 dtk | 1            | 15 makanan/jam |
| Rusa       | `rusa`       | 1 mnt 20 dtk → 80 makanan  | 3 mnt        | 2            | 30 makanan/jam |
| Babi Liar  | `babi-liar`  | 2 mnt → 130 makanan        | 4 mnt        | 3            | 45 makanan/jam |
| Domba      | `domba`      | 1 mnt 10 dtk → 60 makanan  | 2 mnt 30 dtk | 2            | 25 makanan/jam |
| Sapi       | `sapi`       | 2 mnt 30 dtk → 170 makanan | 5 mnt        | 3            | 60 makanan/jam |

### Ayam Hutan (`ayam-hutan`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Ayam berbulu merah-hijau, mengais tanah, lari kecil bila didekati.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Diburu prajurit → makanan sekali; ditangkap pekerja → tinggal di Peternakan dan menghasilkan makanan/jam. Muncul lagi tiap 24 jam.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu hewan, **Buru** (pilih prajurit) dan **Tangkap** (pilih pekerja), atau **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Ayam hutan yang lincah. Mudah ditangkap.
- Catatan lain:

### Rusa (`rusa`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Rusa coklat bertanduk bercabang, berdiri waspada.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Diburu prajurit → makanan sekali; ditangkap pekerja → tinggal di Peternakan dan menghasilkan makanan/jam. Muncul lagi tiap 24 jam.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu hewan, **Buru** (pilih prajurit) dan **Tangkap** (pilih pekerja), atau **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Rusa hutan. Dagingnya banyak.
- Catatan lain:

### Babi Liar (`babi-liar`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Babi hutan berbulu kasar dengan taring kecil.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Diburu prajurit → makanan sekali; ditangkap pekerja → tinggal di Peternakan dan menghasilkan makanan/jam. Muncul lagi tiap 24 jam.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu hewan, **Buru** (pilih prajurit) dan **Tangkap** (pilih pekerja), atau **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Babi liar yang kuat. Butuh banyak pekerja.
- Catatan lain:

### Domba (`domba`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Domba putih berbulu tebal seperti awan.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Diburu prajurit → makanan sekali; ditangkap pekerja → tinggal di Peternakan dan menghasilkan makanan/jam. Muncul lagi tiap 24 jam.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu hewan, **Buru** (pilih prajurit) dan **Tangkap** (pilih pekerja), atau **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Domba jinak. Cocok untuk peternakan.
- Catatan lain:

### Sapi (`sapi`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Sapi belang coklat-putih, mengunyah rumput.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Diburu prajurit → makanan sekali; ditangkap pekerja → tinggal di Peternakan dan menghasilkan makanan/jam. Muncul lagi tiap 24 jam.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Kartu hewan, **Buru** (pilih prajurit) dan **Tangkap** (pilih pekerja), atau **Panggil pulang**.
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Sapi besar. Hasil peternakan terbanyak.
- Catatan lain:

## 4. Musuh liar

Kelompok musuh menunggu di tanah luar desa dan muncul lagi tiap 24 jam; makin tinggi Balai, makin kuat. Pulau Gurun/Salju memakai baris yang lebih tinggi. Musuh mengejar unit yang terlalu dekat, dan sesekali menyerang desa (serangan desa).

**Saat diketuk** (sekarang): kartu kelompok musuh (jumlah & jenis, kekuatan, perkiraan peluang menang tim yang dipilih), tombol **Pilih tim** (panel memilih monster/prajurit) dan **Kirim tim**. Musuh serangan desa menampilkan hitung mundur dan jalurnya.

| Baris | Mulai Balai | Kelompok                                      |
| ----- | ----------- | --------------------------------------------- |
| 1     | Lv 1        | 2–3 bandit / 2-3 goblin                       |
| 2     | Lv 2        | 3–4 bandit; 2-3 goblin; 2–3 monster tingkat 1 |
| 3     | Lv 3        | 3–5 monster tingkat 1; 1–1 monster tingkat 2  |
| 4     | Lv 4        | 3–5 monster tingkat 2; 1–1 monster tingkat 3  |
| 5     | Lv 5        | 4–6 monster tingkat 2; 1–1 monster tingkat 4  |

### Bandit

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Orang bertopeng kain dengan golok atau pentungan; berkumpul di kemah kecil dengan api unggun.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Musuh liar di luar desa: kalahkan untuk mendapat jarahan (emas, makanan). Kadang menyerang desa.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Seperti sekarang: kartu kelompok, kekuatan, perkiraan peluang menang, **Pilih tim** dan **Kirim tim**.
- Leveling (berapa level, apa yang bertambah tiap level): Kekuatan naik mengikuti baris Balai (lihat tabel).
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Gerombolan bandit. Kalahkan untuk merebut jarahan mereka.
- Catatan lain: Usul variasi Bandit Pemanah mulai baris 2.

### Goblin (`goblin`)

- Baru: musuh liar baris 1–2, bersama bandit. Belum ada di `data/`.

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Makhluk kecil berkulit hijau kebiruan, telinga runcing, membawa belati tulang dan perisai kayu bulat; tinggal di gubuk ranting. Rupa orisinal (bukan goblin game lain), ikuti `soul-monster-art-style`.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Musuh liar lincah tapi rapuh; kalahkan untuk mendapat jarahan (emas, kayu, kadang Kristal Jiwa kecil). Kadang ikut menyerang desa.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Sama seperti bandit: kartu kelompok, kekuatan, perkiraan peluang menang, **Pilih tim** dan **Kirim tim**.
- Leveling (berapa level, apa yang bertambah tiap level): Kekuatan naik mengikuti baris Balai. Usulan statistik (dibanding bandit HP 120, serangan 10, pertahanan 8, kecepatan 9): HP 80, serangan 9, pertahanan 4, kecepatan 13, jangkauan 1. Lebih cepat dan rapuh: cocok dilawan menara dan pemanah.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Tidak (bukan bangunan).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Gerombolan goblin. Cepat dan licik, tapi mudah dikalahkan.
- Catatan lain: Statistik masuk `rules.json` (seperti `battle.bandit`), jenis musuh baru di `wilds.json`.

## 5. Unit

- **Pekerja**: dilatih di Balai Utama (50 makanan, 1 mnt); membangun, mengambil alam liar, berburu, bekerja di Tambang/Penggilingan. Mulai dengan 2. HP 20, serangan 1, pertahanan 5, jangkauan 1;
- **Prajurit** (penahan): HP 140, serangan 10, pertahanan 13, jangkauan 1; 1 poin kekuatan; latih 80 emas + 60 makanan + 60 undefined dalam 1 mnt.
- **Pemanah** (penembak): HP 70, serangan 16, pertahanan 5, jangkauan 4; 1 poin kekuatan; latih 100 emas + 60 makanan + 75 undefined dalam 1 mnt 15 dtk.
- **Penombak Berkuda** (petarung): HP 170, serangan 28, pertahanan 12, jangkauan 2; 2 poin kekuatan; latih 180 emas + 120 makanan + 150 undefined dalam 2 mnt 30 dtk.
- **Pangkat prajurit**: Rekrut (statistik ×1, biaya ×1), Veteran (statistik ×1.6, biaya ×2), Elit (statistik ×2.4, biaya ×4); pangkat ke-n terbuka di level barak ke-n.
- **Monster**: wujud + elemen + tahap tumbuh (bayi → remaja → dewasa); lihat `data/forms.json` dan `data/elements.json`.
- **Saat diketuk** (sekarang): unit di desa dipilih lewat tombol **Pilih** (ketuk atau tarik kotak), lalu ketuk tanah untuk berjalan, ketuk musuh untuk menyerang, atau ketuk pohon/batu untuk menjaga. Detail monster (beri makan, lepas) ada di panel Kandang (rencana: pindah ke Sarang Telur Jiwa).

### Pekerja

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Warga kecil bertopi caping, membawa kapak dan beliung; animasi jalan, menebang, memikul.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Membangun, mengambil alam liar, bekerja di Tambang / Penggilingan / Tukang Kayu.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Hanya terpilih seperti prajurit tapi tidak ada aksi apapun
- Leveling (berapa level, apa yang bertambah tiap level): Tidak ada level per pekerja; waktu latih makin cepat seiring level Balai.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Usul latih pekerja boleh dipercepat (1 permata per menit).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Warga desa yang rajin. Membangun, menebang, menambang, dan berburu.
- Catatan lain: Saat serangan desa, pekerja di luar lari ke Balai Utama.

### Prajurit

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Pedang dan perisai bundar, seragam warna desa; pangkat terlihat dari helm (kain → besi → berjambul).
- Fungsi (apa yang dilakukan pemain dengan objek ini): Penahan di barisan depan (Serbu, musuh liar, bertahan di desa). Berburu hewan liar; saat serangan desa ikut bertahan bila ≤ 4 petak dari desa.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Pilih lewat tombol **Pilih**; usul kartu kecil HP, pangkat, statistik.
- Leveling (berapa level, apa yang bertambah tiap level): Pangkat Rekrut / Veteran / Elit dari level Barak.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Usul latih boleh dipercepat (1 permata per menit).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Rekrut: prajurit pemula berpedang.
  - Lv 2: Veteran: lebih tangguh dan terlatih.
  - Lv 3: Elit: penahan terkuat desa.
- Catatan lain: Bagian 5 menulis biaya latih "60 undefined" — kemungkinan kayu; generator dokumen perlu diperbaiki.

### Pemanah

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Busur panjang, tabung panah di punggung, tudung hijau; pangkat terlihat dari jubah.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Penembak jarak jauh, HP rendah.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Pilih lewat tombol **Pilih**; usul kartu kecil HP, pangkat, statistik.
- Leveling (berapa level, apa yang bertambah tiap level): Pangkat Rekrut / Veteran / Elit dari level Lapangan Pemanah.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Usul latih boleh dipercepat (1 permata per menit).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Rekrut: pemanah pemula.
  - Lv 2: Veteran: bidikan lebih tajam.
  - Lv 3: Elit: pemanah jitu.
- Catatan lain:

### Penombak Berkuda

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana): Penunggang kuda coklat bertombak panjang, panji kecil di tombak.
- Fungsi (apa yang dilakukan pemain dengan objek ini): Petarung cepat dan kuat, 2 poin kekuatan.
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja): Pilih lewat tombol **Pilih**; usul kartu kecil HP, pangkat, statistik.
- Leveling (berapa level, apa yang bertambah tiap level): Pangkat Rekrut / Veteran / Elit dari level Kandang Kuda.
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga): Usul latih boleh dipercepat (1 permata per menit).
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1: Rekrut: penunggang pemula.
  - Lv 2: Veteran: serbuan lebih kuat.
  - Lv 3: Elit: ksatria berkuda terkuat.
- Catatan lain:

## 6. Usulan objek baru

Usulan untuk menambah pengalaman bermain; coret yang tidak diinginkan, lalu isi bagiannya. Yang bertanda ★ menutup temuan di bagian 0.

| Usulan                                     | Kategori  | Gagasan fungsi                                                                                  | Kenapa membantu                                          |
| ------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| ~~★ Penggergajian~~ (jadi Tukang Kayu)     | Produksi  | Pekerja di dalam menghasilkan **kayu** (seperti Penggilingan).                                  | Kayu tidak lagi hanya dari alam liar (temuan 2).         |
| ~~★ Tambang Batu~~ (sudah ditambah)        | Produksi  | Pekerja di dalam menghasilkan **batu**.                                                         | Batu untuk Balai tinggi & tembok (temuan 2).             |
| ★ Penyuling Kristal                        | Monster   | Mengubah emas/makanan menjadi **Kristal Jiwa** perlahan.                                        | Sumber Kristal Jiwa yang bisa direncanakan (temuan 3).   |
| ★ Tempat Latihan Monster                   | Monster   | Monster dewasa berlatih (makanan + waktu) untuk naik **level monster** (+statistik).            | Monster dewasa tetap punya tujuan (temuan 7).            |
| ~~Perpustakaan Jiwa~~ (masuk Perpustakaan) | Monster   | Memberi petunjuk resep rahasia secara berkala (mis. satu induk dari resep).                     | Membuat Monsterpedia & resep terasa bisa dikejar.        |
| Menara Elemen                              | Militer   | Menara bertahan dengan elemen (api/air/…): unggul melawan musuh tertentu.                       | Pertahanan desa yang lebih taktis.                       |
| Pos Penjaga                                | Militer   | Prajurit di dalam ikut bertahan otomatis saat serangan desa.                                    | Prajurit berguna juga untuk bertahan.                    |
| Lumbung Penyimpanan                        | Utama     | Membatasi/menyimpan sumber daya maksimal; level menaikkan batas.                                | Memberi tujuan upgrade (bila batas simpanan diinginkan). |
| Tugu Persahabatan                          | Sosial    | Menampilkan bantuan teman hari ini; hadiah kecil bila dibantu banyak teman.                     | Mendorong fitur teman (Tugas 2.1).                       |
| Pedagang Keliling                          | Acara     | Muncul sesekali di desa; menukar sumber daya (mis. kayu → batu).                                | Mengatasi kekurangan satu jenis sumber daya.             |
| Dekorasi berefek                           | Dekorasi  | Dekorasi memberi bonus kecil ke bangunan produksi di dekatnya (mis. +5%).                       | Dekorasi jadi pilihan, bukan hiasan saja (temuan 4).     |
| Peti Harta                                 | Alam liar | Kadang muncul di tanah terkunci; dibuka pekerja → hadiah acak (sumber daya, kadang Telur Jiwa). | Kejutan kecil saat menjelajah.                           |
| Jamur Hutan / Pohon Buah                   | Alam liar | Simpul makanan baru di Pulau Utama.                                                             | Variasi alam liar.                                       |
| Kristal Liar                               | Alam liar | Simpul langka yang pasti memberi Kristal Jiwa.                                                  | Alasan menjelajah tanah terkunci (temuan 3).             |
| Sarang Monster Liar                        | Alam liar | Sarang musuh yang terus memunculkan musuh sampai dihancurkan; hadiah besar.                     | Tujuan pertarungan di desa sendiri.                      |

### Usulan: (nama)

**Isian pemilik:**

- Bentuk:
- Fungsi:
- Saat diketuk:
- Leveling:
- Percepat dengan permata:
- Deskripsi tiap level:
  - Lv 1:
- Catatan lain:

(Salin blok di atas untuk tiap usulan yang dipakai.)
