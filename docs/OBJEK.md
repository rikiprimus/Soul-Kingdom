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

| Kategori  | Bangunan            | id                    | Ukuran | Level | Fungsi sekarang                                                                                             |
| --------- | ------------------- | --------------------- | ------ | ----- | ----------------------------------------------------------------------------------------------------------- |
| Utama     | Balai Utama         | `balai-utama`         | 4×4    | 6     | Membuka bangunan & level baru; melatih pekerja; dijadikan sasaran serangan desa.                            |
| Utama     | Rumah               | `rumah`               | 2×2    | 5     | Hanya menambah populasi.                                                                                    |
| Produksi  | Pasar               | `pasar`               | 2×2    | 5     | Menghasilkan emas sendiri, dipungut dengan ketukan.                                                         |
| Produksi  | Ladang              | `ladang`              | 2×2    | 5     | Tanam → tunggu → panen makanan.                                                                             |
| Produksi  | Tambang Emas        | `tambang-emas`        | 2×2    | 3     | Butuh pekerja di dalam; tetap jalan saat game ditutup.                                                      |
| Produksi  | Penggilingan        | `penggilingan`        | 2×2    | 3     | Butuh pekerja di dalam; tetap jalan saat game ditutup.                                                      |
| Produksi  | Peternakan          | `peternakan`          | 3×3    | 3     | Menampung hewan tangkapan; tiap hewan menghasilkan makanan/jam.                                             |
| Monster   | Kandang Monster     | `kandang`             | 3×3    | 5     | Membuka daftar monster (beri makan, lepas), tempat telur awal menetas. **Level belum berpengaruh apa pun.** |
| Monster   | Soul Mixer          | `soul-mixer`          | 3×3    | 1     | Membuka Soul Mixer (butuh Balai Lv 4). Hanya 1 level.                                                       |
| Monster   | Kuburan             | `kuburan`             | 2×2    | 1     | Membuka daftar monster gugur untuk dihidupkan kembali. Hanya 1 level.                                       |
| Monster   | Sarang Telur Jiwa   | `sarang-telur`        | 2×2    | 1     | Merawat Telur Jiwa (3 langkah bertimer) lalu menetaskannya. Hanya 1 level.                                  |
| Keajaiban | Pohon Emas Purba    | `pohon-emas-purba`    | 3×3    | 1     | Keajaiban: hadiah misi besar, dipasang dari Gudang, tidak bisa dibangun.                                    |
| Keajaiban | Lumbung Abadi       | `lumbung-abadi`       | 3×3    | 1     | Keajaiban: hadiah set koleksi, dipasang dari Gudang.                                                        |
| Keajaiban | Kolam Jiwa          | `kolam-jiwa`          | 3×3    | 1     | Keajaiban: hadiah set koleksi, dipasang dari Gudang.                                                        |
| Militer   | Guild               | `barak`               | 3×3    | 5     | Membuka layar Serbu. **Level belum berpengaruh apa pun.**                                                   |
| Militer   | Barak Prajurit      | `petarung`            | 3×3    | 5     | Melatih Prajurit; jumlah level ketiga barak menaikkan batas kekuatan Serbu.                                 |
| Militer   | Barak Panahan       | `lapangan-panah`      | 3×3    | 5     | Melatih Pemanah; ikut menaikkan batas kekuatan Serbu.                                                       |
| Militer   | Barak Berkuda       | `barak-berkuda`       | 3×3    | 5     | Melatih Penombak Berkuda; ikut menaikkan batas kekuatan Serbu.                                              |
| Militer   | Gerbang Petualangan | `gerbang-petualangan` | 3×3    | 1     | Membuka peta Petualangan (wilayah, titik sumber daya, bos). Hanya 1 level.                                  |
| Militer   | Arena               | `arena`               | 4×4    | 1     | **Belum berfungsi** ("Arena segera hadir", Tugas 2.3).                                                      |
| Militer   | Menara Jaga         | `menara`              | 2×2    | 3     | Menembak musuh serangan desa dalam jangkauan.                                                               |
| Militer   | Tembok              | `tembok`              | 1×1    | 3     | Menghalangi jalan musuh serangan desa (musuh memutar atau menjebol).                                        |
| Dekorasi  | Pohon Hias          | `pohon-hias`          | 1×1    | 1     | Dekorasi, **tanpa efek**.                                                                                   |
| Dekorasi  | Taman Bunga         | `bunga`               | 1×1    | 1     | Dekorasi, **tanpa efek**.                                                                                   |
| Dekorasi  | Lampu Jalan         | `lampu`               | 1×1    | 1     | Dekorasi, **tanpa efek**.                                                                                   |
| Dekorasi  | Air Mancur          | `air-mancur`          | 2×2    | 1     | Dekorasi, **tanpa efek**.                                                                                   |
| Dekorasi  | Patung Naga         | `patung`              | 1×1    | 1     | Dekorasi, **tanpa efek**.                                                                                   |

### Balai Utama (`balai-utama`)

> Jantung desa. Level Balai Utama membuka bangunan dan level baru.

- Kategori: Utama · ukuran 4×4 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Membuka bangunan & level baru; melatih pekerja; dijadikan sasaran serangan desa.
- Sekarang saat diketuk: Kartu: populasi & pekerja, tombol **Latih pekerja**.

| Lv  | Biaya                                                     | Waktu bangun | Butuh Balai | Efek         |
| --- | --------------------------------------------------------- | ------------ | ----------- | ------------ |
| 1   | gratis                                                    | langsung     | —           | populasi +8  |
| 2   | 1.000 emas + 400 kayu + 100 batu                          | 10 mnt       | 1           | populasi +10 |
| 3   | 5.000 emas + 1.000 makanan + 2.500 kayu + 1.200 batu      | 1 jam        | 2           | populasi +12 |
| 4   | 20.000 emas + 5.000 makanan + 7.000 kayu + 7.000 batu     | 4 jam        | 3           | populasi +14 |
| 5   | 100.000 emas + 20.000 makanan + 20.000 kayu + 12.000 batu | 12 jam       | 4           | populasi +16 |
| 6   | 250.000 emas + 60.000 makanan + 45.000 kayu + 30.000 batu | 24 jam       | 5           | populasi +18 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Rumah (`rumah`)

> Tempat tinggal. Menambah populasi untuk pekerja, prajurit, dan monster.

- Kategori: Utama · ukuran 2×2 · maks per Balai Lv1: 2, Lv2: 4, Lv3: 6, Lv4: 8, Lv5: 10, Lv6: 12
- Sekarang: Hanya menambah populasi.
- Sekarang saat diketuk: Kartu: populasi yang ditambahkan rumah ini dan populasi desa.

| Lv  | Biaya                                 | Waktu bangun | Butuh Balai | Efek         |
| --- | ------------------------------------- | ------------ | ----------- | ------------ |
| 1   | 150 emas + 150 kayu                   | 1 mnt        | 1           | populasi +10 |
| 2   | 500 emas + 400 kayu + 100 batu        | 5 mnt        | 2           | populasi +15 |
| 3   | 1.500 emas + 900 kayu + 300 batu      | 15 mnt       | 3           | populasi +20 |
| 4   | 4.000 emas + 1.800 kayu + 800 batu    | 30 mnt       | 4           | populasi +25 |
| 5   | 10.000 emas + 3.500 kayu + 1.800 batu | 1 jam        | 5           | populasi +30 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Pasar (`pasar`)

> Pedagang membayar pajak emas. Ketuk untuk memungut emas.

- Kategori: Produksi · ukuran 2×2 · maks per Balai Lv1: 1, Lv2: 2, Lv3: 2, Lv4: 3, Lv5: 3, Lv6: 4
- Sekarang: Menghasilkan emas sendiri, dipungut dengan ketukan.
- Sekarang saat diketuk: Bila emas sudah cukup terkumpul: **langsung dipungut** (ikon emas terbang ke HUD). Selain itu kartu: emas tersimpan/kapasitas, tombol **Pungut**.

| Lv  | Biaya                                               | Waktu bangun | Butuh Balai | Efek                            |
| --- | --------------------------------------------------- | ------------ | ----------- | ------------------------------- |
| 1   | 300 emas + 100 kayu                                 | 1 mnt        | 1           | +600 emas/jam (tampung 2.400)   |
| 2   | 800 emas + 250 kayu                                 | 5 mnt        | 2           | +900 emas/jam (tampung 3.600)   |
| 3   | 2.000 emas + 200 makanan + 500 kayu + 100 batu      | 15 mnt       | 3           | +1.300 emas/jam (tampung 5.200) |
| 4   | 5.000 emas + 500 makanan + 1.000 kayu + 300 batu    | 30 mnt       | 4           | +1.800 emas/jam (tampung 7.200) |
| 5   | 12.000 emas + 1.500 makanan + 2.000 kayu + 800 batu | 1 jam        | 5           | +2.400 emas/jam (tampung 9.600) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Ladang (`ladang`)

> Tanam bibit dengan emas, tunggu tumbuh, lalu panen makanan untuk monster.

- Kategori: Produksi · ukuran 2×2 · maks per Balai Lv1: 2, Lv2: 3, Lv3: 4, Lv4: 5, Lv5: 6, Lv6: 7
- Sekarang: Tanam → tunggu → panen makanan.
- Sekarang saat diketuk: Kosong: kartu dengan tombol **Tanam**. Sedang tumbuh: kartu dengan hitung mundur. Siap: **langsung dipanen**.

| Lv  | Biaya                              | Waktu bangun | Butuh Balai | Efek                                        |
| --- | ---------------------------------- | ------------ | ----------- | ------------------------------------------- |
| 1   | 100 emas + 80 kayu                 | 30 dtk       | 1           | tanam 50 emas → 150 makanan dalam 5 mnt     |
| 2   | 400 emas + 200 kayu                | 5 mnt        | 2           | tanam 80 emas → 250 makanan dalam 5 mnt     |
| 3   | 1.000 emas + 400 kayu              | 15 mnt       | 3           | tanam 120 emas → 450 makanan dalam 10 mnt   |
| 4   | 2.500 emas + 800 kayu + 200 batu   | 30 mnt       | 4           | tanam 180 emas → 700 makanan dalam 15 mnt   |
| 5   | 6.000 emas + 1.500 kayu + 500 batu | 1 jam        | 5           | tanam 250 emas → 1.000 makanan dalam 20 mnt |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Tambang Emas (`tambang-emas`)

> Pekerja di dalam menggali emas, tetap bekerja saat game ditutup.

- Kategori: Produksi · ukuran 2×2 · maks per Balai Lv1: 0, Lv2: 1, Lv3: 1, Lv4: 2, Lv5: 2, Lv6: 3
- Sekarang: Butuh pekerja di dalam; tetap jalan saat game ditutup.
- Sekarang saat diketuk: Bila hasil cukup: **langsung dipungut**. Selain itu kartu: hasil per pekerja, pekerja di dalam, tombol **Tambah pekerja / Keluarkan pekerja / Pungut**.

| Lv  | Biaya                                | Waktu bangun | Butuh Balai | Efek                                                 |
| --- | ------------------------------------ | ------------ | ----------- | ---------------------------------------------------- |
| 1   | 800 emas + 300 kayu + 200 batu       | 10 mnt       | 2           | 2 slot pekerja, 120 emas/pekerja/jam (tampung 2.000) |
| 2   | 2.500 emas + 800 kayu + 600 batu     | 30 mnt       | 3           | 3 slot pekerja, 150 emas/pekerja/jam (tampung 3.500) |
| 3   | 7.000 emas + 1.800 kayu + 1.500 batu | 1 jam        | 4           | 4 slot pekerja, 190 emas/pekerja/jam (tampung 6.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Penggilingan (`penggilingan`)

> Pekerja di dalam menggiling gandum menjadi makanan, tetap bekerja saat game ditutup.

- Kategori: Produksi · ukuran 2×2 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 2, Lv4: 2, Lv5: 3, Lv6: 3
- Sekarang: Butuh pekerja di dalam; tetap jalan saat game ditutup.
- Sekarang saat diketuk: Bila hasil cukup: **langsung dipungut**. Selain itu kartu: hasil per pekerja, pekerja di dalam, tombol **Tambah pekerja / Keluarkan pekerja / Pungut**.

| Lv  | Biaya                              | Waktu bangun | Butuh Balai | Efek                                                    |
| --- | ---------------------------------- | ------------ | ----------- | ------------------------------------------------------- |
| 1   | 300 emas + 300 kayu                | 5 mnt        | 1           | 2 slot pekerja, 80 makanan/pekerja/jam (tampung 1.200)  |
| 2   | 1.200 emas + 700 kayu + 200 batu   | 15 mnt       | 2           | 3 slot pekerja, 100 makanan/pekerja/jam (tampung 2.000) |
| 3   | 4.000 emas + 1.500 kayu + 600 batu | 30 mnt       | 3           | 4 slot pekerja, 130 makanan/pekerja/jam (tampung 3.500) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Peternakan (`peternakan`)

> Hewan tangkapan beternak di sini dan menghasilkan makanan.

- Kategori: Produksi · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 2, Lv4: 2, Lv5: 3, Lv6: 3
- Sekarang: Menampung hewan tangkapan; tiap hewan menghasilkan makanan/jam.
- Sekarang saat diketuk: Bila makanan cukup: **langsung dipungut**. Selain itu kartu: hewan di dalam, makanan/jam, tombol **Pungut**.

| Lv  | Biaya                              | Waktu bangun | Butuh Balai | Efek                                |
| --- | ---------------------------------- | ------------ | ----------- | ----------------------------------- |
| 1   | 400 emas + 400 kayu                | 5 mnt        | 1           | 3 slot hewan, tampung 600 makanan   |
| 2   | 1.500 emas + 900 kayu + 200 batu   | 15 mnt       | 2           | 5 slot hewan, tampung 1.200 makanan |
| 3   | 4.500 emas + 1.800 kayu + 700 batu | 30 mnt       | 3           | 7 slot hewan, tampung 2.000 makanan |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Kandang Monster (`kandang`)

> Rumah para monster. Di sini kamu melihat, memberi makan, dan melepas monster.

- Kategori: Monster · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 2, Lv4: 2, Lv5: 3, Lv6: 3
- Sekarang: Membuka daftar monster (beri makan, lepas), tempat telur awal menetas. **Level belum berpengaruh apa pun.**
- Sekarang saat diketuk: Ada telur siap: **langsung menetas**. Selain itu kartu: populasi, telur & hitung mundurnya, tombol **Buka koleksi monster**.

| Lv  | Biaya                                                 | Waktu bangun | Butuh Balai | Efek |
| --- | ----------------------------------------------------- | ------------ | ----------- | ---- |
| 1   | 300 emas + 200 kayu                                   | 1 mnt        | 1           | —    |
| 2   | 1.000 emas + 200 makanan + 500 kayu                   | 10 mnt       | 2           | —    |
| 3   | 3.000 emas + 500 makanan + 1.000 kayu + 300 batu      | 30 mnt       | 3           | —    |
| 4   | 8.000 emas + 1.500 makanan + 2.000 kayu + 800 batu    | 1 jam        | 4           | —    |
| 5   | 20.000 emas + 4.000 makanan + 4.000 kayu + 2.000 batu | 2 jam        | 5           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Soul Mixer (`soul-mixer`)

> Kuali jiwa kuno. Campur dua monster dewasa menjadi monster baru.

- Kategori: Monster · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Membuka Soul Mixer (butuh Balai Lv 4). Hanya 1 level.
- Sekarang saat diketuk: Ada hasil campuran siap (gelembung telur): **langsung membuka panel Soul Mixer**. Selain itu kartu dengan tombol **Buka Soul Mixer**.

| Lv  | Biaya                                          | Waktu bangun | Butuh Balai | Efek |
| --- | ---------------------------------------------- | ------------ | ----------- | ---- |
| 1   | 3.000 emas + 500 makanan + 800 kayu + 600 batu | 10 mnt       | 4           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Kuburan (`kuburan`)

> Monster yang gugur beristirahat di sini dan bisa dihidupkan kembali.

- Kategori: Monster · ukuran 2×2 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Membuka daftar monster gugur untuk dihidupkan kembali. Hanya 1 level.
- Sekarang saat diketuk: Kartu: jumlah monster gugur, tombol **Buka Kuburan**.

| Lv  | Biaya                          | Waktu bangun | Butuh Balai | Efek |
| --- | ------------------------------ | ------------ | ----------- | ---- |
| 1   | 500 emas + 200 kayu + 300 batu | 5 mnt        | 1           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Sarang Telur Jiwa (`sarang-telur`)

> Rawat Telur Jiwa dari hadiah misi di sini. Telur menetas menjadi monster langka atau epik.

- Kategori: Monster · ukuran 2×2 · maks per Balai Lv1: 0, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Merawat Telur Jiwa (3 langkah bertimer) lalu menetaskannya. Hanya 1 level.
- Sekarang saat diketuk: Kartu: jumlah Telur Jiwa, langkah rawat & hitung mundur, tombol **Mulai rawat / Rawat / Tetaskan**.

| Lv  | Biaya                            | Waktu bangun | Butuh Balai | Efek |
| --- | -------------------------------- | ------------ | ----------- | ---- |
| 1   | 1.500 emas + 500 kayu + 300 batu | 10 mnt       | 2           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Pohon Emas Purba (`pohon-emas-purba`)

> Keajaiban: pohon tua berdaun emas. Menghasilkan emas dalam jumlah besar.

- Kategori: Keajaiban · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Keajaiban: hadiah misi besar, dipasang dari Gudang, tidak bisa dibangun.
- Sekarang saat diketuk: Seperti Pasar: langsung dipungut bila cukup, selain itu kartu hasil + **Pungut**.

| Lv  | Biaya  | Waktu bangun | Butuh Balai | Efek                             |
| --- | ------ | ------------ | ----------- | -------------------------------- |
| 1   | gratis | langsung     | 1           | +3.000 emas/jam (tampung 24.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Lumbung Abadi (`lumbung-abadi`)

> Keajaiban: lumbung yang tak pernah kosong. Menghasilkan makanan dalam jumlah besar.

- Kategori: Keajaiban · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Keajaiban: hadiah set koleksi, dipasang dari Gudang.
- Sekarang saat diketuk: Seperti Pasar: langsung dipungut bila cukup, selain itu kartu hasil + **Pungut**.

| Lv  | Biaya  | Waktu bangun | Butuh Balai | Efek                                |
| --- | ------ | ------------ | ----------- | ----------------------------------- |
| 1   | gratis | langsung     | 1           | +2.000 makanan/jam (tampung 16.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Kolam Jiwa (`kolam-jiwa`)

> Keajaiban: kolam bercahaya tempat jiwa monster berkumpul. Menghasilkan emas sangat banyak.

- Kategori: Keajaiban · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Keajaiban: hadiah set koleksi, dipasang dari Gudang.
- Sekarang saat diketuk: Seperti Pasar: langsung dipungut bila cukup, selain itu kartu hasil + **Pungut**.

| Lv  | Biaya  | Waktu bangun | Butuh Balai | Efek                             |
| --- | ------ | ------------ | ----------- | -------------------------------- |
| 1   | gratis | langsung     | 1           | +5.000 emas/jam (tampung 40.000) |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Guild (`barak`)

> Markas para pejuang desa. Dari sini pasukan berangkat Serbu ke markas musuh.

- Kategori: Militer · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Membuka layar Serbu. **Level belum berpengaruh apa pun.**
- Sekarang saat diketuk: Kartu: batas kekuatan Serbu, tombol **Buka Serbu** (layar markas musuh).

| Lv  | Biaya                                                 | Waktu bangun | Butuh Balai | Efek |
| --- | ----------------------------------------------------- | ------------ | ----------- | ---- |
| 1   | 600 emas + 300 kayu                                   | 5 mnt        | 1           | —    |
| 2   | 2.000 emas + 300 makanan + 600 kayu + 200 batu        | 15 mnt       | 3           | —    |
| 3   | 6.000 emas + 800 makanan + 1.200 kayu + 600 batu      | 30 mnt       | 4           | —    |
| 4   | 15.000 emas + 2.000 makanan + 2.500 kayu + 1.500 batu | 1 jam        | 5           | —    |
| 5   | 40.000 emas + 5.000 makanan + 5.000 kayu + 3.000 batu | 2 jam        | 6           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Barak Prajurit (`petarung`)

> Melatih prajurit berpedang dan berperisai (penahan). Level barak membuka pangkat lebih tinggi.

- Kategori: Militer · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Melatih Prajurit; jumlah level ketiga barak menaikkan batas kekuatan Serbu.
- Sekarang saat diketuk: Kartu: antrean latihan, tombol **Buka barak** (panel latih prajurit per pangkat).

| Lv  | Biaya                                                 | Waktu bangun | Butuh Balai | Efek                          |
| --- | ----------------------------------------------------- | ------------ | ----------- | ----------------------------- |
| 1   | 600 emas + 300 kayu                                   | 5 mnt        | 1           | membuka pangkat Rekrut        |
| 2   | 2.000 emas + 300 makanan + 600 kayu + 200 batu        | 15 mnt       | 3           | membuka pangkat Veteran       |
| 3   | 6.000 emas + 800 makanan + 1.200 kayu + 600 batu      | 30 mnt       | 4           | membuka pangkat Elit          |
| 4   | 15.000 emas + 2.000 makanan + 2.500 kayu + 1.500 batu | 1 jam        | 5           | menambah batas kekuatan Serbu |
| 5   | 40.000 emas + 5.000 makanan + 5.000 kayu + 3.000 batu | 2 jam        | 6           | menambah batas kekuatan Serbu |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Barak Panahan (`lapangan-panah`)

> Melatih pemanah (penembak). Level barak membuka pangkat lebih tinggi.

- Kategori: Militer · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Melatih Pemanah; ikut menaikkan batas kekuatan Serbu.
- Sekarang saat diketuk: Kartu: antrean latihan, tombol **Buka barak**.

| Lv  | Biaya                                                 | Waktu bangun | Butuh Balai | Efek                          |
| --- | ----------------------------------------------------- | ------------ | ----------- | ----------------------------- |
| 1   | 600 emas + 300 kayu                                   | 5 mnt        | 1           | membuka pangkat Rekrut        |
| 2   | 2.000 emas + 300 makanan + 600 kayu + 200 batu        | 15 mnt       | 3           | membuka pangkat Veteran       |
| 3   | 6.000 emas + 800 makanan + 1.200 kayu + 600 batu      | 30 mnt       | 4           | membuka pangkat Elit          |
| 4   | 15.000 emas + 2.000 makanan + 2.500 kayu + 1.500 batu | 1 jam        | 5           | menambah batas kekuatan Serbu |
| 5   | 40.000 emas + 5.000 makanan + 5.000 kayu + 3.000 batu | 2 jam        | 6           | menambah batas kekuatan Serbu |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Barak Berkuda (`barak-berkuda`)

> Melatih penombak berkuda (petarung) yang cepat dan kuat. Level barak membuka pangkat lebih tinggi.

- Kategori: Militer · ukuran 3×3 · maks per Balai Lv1: 1, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Melatih Penombak Berkuda; ikut menaikkan batas kekuatan Serbu.
- Sekarang saat diketuk: Kartu: antrean latihan, tombol **Buka barak**.

| Lv  | Biaya                                                 | Waktu bangun | Butuh Balai | Efek                          |
| --- | ----------------------------------------------------- | ------------ | ----------- | ----------------------------- |
| 1   | 900 emas + 400 kayu + 100 batu                        | 7 mnt 30 dtk | 2           | membuka pangkat Rekrut        |
| 2   | 3.000 emas + 400 makanan + 900 kayu + 300 batu        | 20 mnt       | 3           | membuka pangkat Veteran       |
| 3   | 9.000 emas + 1.200 makanan + 1.800 kayu + 900 batu    | 40 mnt       | 4           | membuka pangkat Elit          |
| 4   | 22.500 emas + 3.000 makanan + 3.750 kayu + 2.250 batu | 1.5 jam      | 5           | menambah batas kekuatan Serbu |
| 5   | 60.000 emas + 7.500 makanan + 7.500 kayu + 4.500 batu | 3 jam        | 6           | menambah batas kekuatan Serbu |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Gerbang Petualangan (`gerbang-petualangan`)

> Pintu menuju wilayah liar dan para bos. Kalahkan bos untuk membuka tingkat Soul Mixer berikutnya.

- Kategori: Militer · ukuran 3×3 · maks per Balai Lv1: 0, Lv2: 1, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: Membuka peta Petualangan (wilayah, titik sumber daya, bos). Hanya 1 level.
- Sekarang saat diketuk: Kartu: kemajuan Petualangan, tombol **Buka Petualangan** (peta wilayah).

| Lv  | Biaya                            | Waktu bangun | Butuh Balai | Efek |
| --- | -------------------------------- | ------------ | ----------- | ---- |
| 1   | 1.500 emas + 400 kayu + 300 batu | 5 mnt        | 2           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Arena (`arena`)

> Duel monster 3 lawan 3. Arena segera hadir.

- Kategori: Militer · ukuran 4×4 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 1, Lv4: 1, Lv5: 1, Lv6: 1
- Sekarang: **Belum berfungsi** ("Arena segera hadir", Tugas 2.3).
- Sekarang saat diketuk: Kartu: "Arena segera hadir".

| Lv  | Biaya                                              | Waktu bangun | Butuh Balai | Efek |
| --- | -------------------------------------------------- | ------------ | ----------- | ---- |
| 1   | 5.000 emas + 500 makanan + 1.000 kayu + 1.000 batu | 15 mnt       | 3           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Menara Jaga (`menara`)

> Menembak penyerang dari jauh.

- Kategori: Militer · ukuran 2×2 · maks per Balai Lv1: 0, Lv2: 1, Lv3: 2, Lv4: 3, Lv5: 4, Lv6: 5
- Sekarang: Menembak musuh serangan desa dalam jangkauan.
- Sekarang saat diketuk: Kartu: HP, serangan, jangkauan menara.

| Lv  | Biaya                   | Waktu bangun | Butuh Balai | Efek                                    |
| --- | ----------------------- | ------------ | ----------- | --------------------------------------- |
| 1   | 400 emas + 300 batu     | 5 mnt        | 2           | HP 600, serangan 20, jangkauan 6 petak  |
| 2   | 1.500 emas + 800 batu   | 15 mnt       | 3           | HP 1000, serangan 32, jangkauan 6 petak |
| 3   | 4.000 emas + 1.800 batu | 30 mnt       | 4           | HP 1600, serangan 48, jangkauan 6 petak |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Tembok (`tembok`)

> Pagar kayu lalu tembok batu. Dibangun sebaris: ketuk titik awal lalu titik akhir.

- Kategori: Militer · ukuran 1×1 · maks per Balai Lv1: 0, Lv2: 40, Lv3: 60, Lv4: 80, Lv5: 100, Lv6: 120
- Sekarang: Menghalangi jalan musuh serangan desa (musuh memutar atau menjebol).
- Sekarang saat diketuk: Kartu: HP ruas, tombol **Upgrade semua (N ruas)** dan **Pindah semua** untuk tembok yang tersambung.

| Lv  | Biaya             | Waktu bangun | Butuh Balai | Efek         |
| --- | ----------------- | ------------ | ----------- | ------------ |
| 1   | 10 kayu           | langsung     | 2           | HP ruas 400  |
| 2   | 10 kayu + 20 batu | langsung     | 3           | HP ruas 1000 |
| 3   | 30 emas + 50 batu | langsung     | 4           | HP ruas 2000 |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Pohon Hias (`pohon-hias`)

> Pohon rindang untuk mempercantik desa.

- Kategori: Dekorasi · ukuran 1×1 · maks per Balai Lv1: 30, Lv2: 30, Lv3: 30, Lv4: 30, Lv5: 30, Lv6: 30
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya    | Waktu bangun | Butuh Balai | Efek |
| --- | -------- | ------------ | ----------- | ---- |
| 1   | 100 emas | langsung     | 1           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Taman Bunga (`bunga`)

> Bunga warna-warni.

- Kategori: Dekorasi · ukuran 1×1 · maks per Balai Lv1: 40, Lv2: 40, Lv3: 40, Lv4: 40, Lv5: 40, Lv6: 40
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya   | Waktu bangun | Butuh Balai | Efek |
| --- | ------- | ------------ | ----------- | ---- |
| 1   | 50 emas | langsung     | 1           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Lampu Jalan (`lampu`)

> Lentera jiwa yang menyala lembut.

- Kategori: Dekorasi · ukuran 1×1 · maks per Balai Lv1: 0, Lv2: 20, Lv3: 20, Lv4: 20, Lv5: 20, Lv6: 20
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya              | Waktu bangun | Butuh Balai | Efek |
| --- | ------------------ | ------------ | ----------- | ---- |
| 1   | 150 emas + 20 batu | langsung     | 2           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Air Mancur (`air-mancur`)

> Air mancur batu di alun-alun.

- Kategori: Dekorasi · ukuran 2×2 · maks per Balai Lv1: 0, Lv2: 2, Lv3: 3, Lv4: 3, Lv5: 3, Lv6: 3
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya                 | Waktu bangun | Butuh Balai | Efek |
| --- | --------------------- | ------------ | ----------- | ---- |
| 1   | 2.500 emas + 300 batu | langsung     | 2           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Patung Naga (`patung`)

> Patung emas sang naga purba.

- Kategori: Dekorasi · ukuran 1×1 · maks per Balai Lv1: 0, Lv2: 0, Lv3: 5, Lv4: 5, Lv5: 5, Lv6: 5
- Sekarang: Dekorasi, **tanpa efek**.
- Sekarang saat diketuk: Kartu dekorasi: **Pindah, Putar, Simpan ke Gudang, Jual**.

| Lv  | Biaya                 | Waktu bangun | Butuh Balai | Efek |
| --- | --------------------- | ------------ | ----------- | ---- |
| 1   | 1.000 emas + 200 batu | langsung     | 3           | —    |

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

## 2. Alam liar (diambil pekerja)

Hanya berjalan selama game dibuka. Ada peluang Kristal Jiwa dan peluang penyergapan musuh saat selesai.

**Saat diketuk** (sekarang): kartu berisi hasil, kemajuan & sisa waktu, pemilih jumlah pekerja (− / +) dengan perkiraan waktu, tombol **Kirim pekerja** atau **Panggil pulang**. Bisa juga dijaga monster/prajurit lewat mode **Pilih**.

| Objek          | id           | Hasil                | Kerja        | Pekerja maks | Kristal Jiwa | Penyergapan | Pulau                                           |
| -------------- | ------------ | -------------------- | ------------ | ------------ | ------------ | ----------- | ----------------------------------------------- |
| Pohon Liar     | `pohon`      | 40 kayu              | 1 mnt        | 3            | 10%          | 4%          | Pulau Utama                                     |
| Batu Besar     | `batu`       | 40 batu              | 1 mnt 30 dtk | 3            | 30%          | 3%          | Pulau Utama                                     |
| Semak Berduri  | `semak`      | 25 makanan           | 30 dtk       | 2            | 5%           | 2%          | Pulau Utama                                     |
| Batu Emas      | `batu-emas`  | 150 emas             | 1 mnt 15 dtk | 2            | 10%          | 5%          | Pulau Utama (urat emas); terisi lagi tiap 6 jam |
| Kaktus Raksasa | `kaktus`     | 50 kayu + 15 makanan | 1 mnt 10 dtk | 3            | 12%          | 5%          | Pulau Gurun                                     |
| Batu Pasir     | `batu-pasir` | 60 batu + 20 emas    | 1 mnt 40 dtk | 3            | 35%          | 4%          | Pulau Gurun                                     |
| Cemara Salju   | `cemara`     | 80 kayu              | 1 mnt 30 dtk | 3            | 15%          | 6%          | Pulau Salju                                     |
| Bongkahan Es   | `batu-es`    | 80 batu              | 2 mnt        | 3            | 45%          | 5%          | Pulau Salju                                     |

### Pohon Liar (`pohon`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Batu Besar (`batu`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Semak Berduri (`semak`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Batu Emas (`batu-emas`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Kaktus Raksasa (`kaktus`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Batu Pasir (`batu-pasir`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Cemara Salju (`cemara`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Bongkahan Es (`batu-es`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

## 3. Hewan liar (diburu atau ditangkap pekerja)

Muncul lagi tiap 24 jam. Diburu → makanan sekali; ditangkap → tinggal di Peternakan dan menghasilkan makanan/jam.

**Saat diketuk** (sekarang): kartu hewan, pemilih jumlah pekerja, tombol **Buru (waktu)** dan **Tangkap (waktu)** (tangkap butuh slot kosong di Peternakan), atau **Panggil pulang** bila sedang dikerjakan.

| Hewan      | id           | Buru                       | Tangkap      | Pekerja maks | Di Peternakan  |
| ---------- | ------------ | -------------------------- | ------------ | ------------ | -------------- |
| Ayam Hutan | `ayam-hutan` | 40 dtk → 30 makanan        | 1 mnt 30 dtk | 1            | 15 makanan/jam |
| Rusa       | `rusa`       | 1 mnt 20 dtk → 80 makanan  | 3 mnt        | 2            | 30 makanan/jam |
| Babi Liar  | `babi-liar`  | 2 mnt → 130 makanan        | 4 mnt        | 3            | 45 makanan/jam |
| Domba      | `domba`      | 1 mnt 10 dtk → 60 makanan  | 2 mnt 30 dtk | 2            | 25 makanan/jam |
| Sapi       | `sapi`       | 2 mnt 30 dtk → 170 makanan | 5 mnt        | 3            | 60 makanan/jam |

### Ayam Hutan (`ayam-hutan`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Rusa (`rusa`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Babi Liar (`babi-liar`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Domba (`domba`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Sapi (`sapi`)

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

## 4. Musuh liar

Kelompok musuh menunggu di tanah luar desa dan muncul lagi tiap 24 jam; makin tinggi Balai, makin kuat. Pulau Gurun/Salju memakai baris yang lebih tinggi. Musuh mengejar unit yang terlalu dekat, dan sesekali menyerang desa (serangan desa).

**Saat diketuk** (sekarang): kartu kelompok musuh (jumlah & jenis, kekuatan, perkiraan peluang menang tim yang dipilih), tombol **Pilih tim** (panel memilih monster/prajurit) dan **Kirim tim**. Musuh serangan desa menampilkan hitung mundur dan jalurnya.

| Baris | Mulai Balai | Kelompok                                     |
| ----- | ----------- | -------------------------------------------- |
| 1     | Lv 1        | 2–3 bandit                                   |
| 2     | Lv 2        | 3–4 bandit; 2–3 monster tingkat 1            |
| 3     | Lv 3        | 3–5 monster tingkat 1; 1–1 monster tingkat 2 |
| 4     | Lv 4        | 3–5 monster tingkat 2; 1–1 monster tingkat 3 |
| 5     | Lv 5        | 4–6 monster tingkat 2; 1–1 monster tingkat 4 |

### Bandit

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

## 5. Unit

- **Pekerja**: dilatih di Balai Utama (50 makanan, 1 mnt); membangun, mengambil alam liar, berburu, bekerja di Tambang/Penggilingan. Mulai dengan 2.
- **Prajurit** (penahan): HP 140, serangan 10, pertahanan 13, jangkauan 1; 1 poin kekuatan; latih 80 emas + 60 makanan + 60 undefined dalam 1 mnt.
- **Pemanah** (penembak): HP 70, serangan 16, pertahanan 5, jangkauan 4; 1 poin kekuatan; latih 100 emas + 60 makanan + 75 undefined dalam 1 mnt 15 dtk.
- **Penombak Berkuda** (petarung): HP 170, serangan 28, pertahanan 12, jangkauan 2; 2 poin kekuatan; latih 180 emas + 120 makanan + 150 undefined dalam 2 mnt 30 dtk.
- **Pangkat prajurit**: Rekrut (statistik ×1, biaya ×1), Veteran (statistik ×1.6, biaya ×2), Elit (statistik ×2.4, biaya ×4); pangkat ke-n terbuka di level barak ke-n.
- **Monster**: wujud + elemen + tahap tumbuh (bayi → remaja → dewasa); lihat `data/forms.json` dan `data/elements.json`.
- **Saat diketuk** (sekarang): unit di desa dipilih lewat tombol **Pilih** (ketuk atau tarik kotak), lalu ketuk tanah untuk berjalan, ketuk musuh untuk menyerang, atau ketuk pohon/batu untuk menjaga. Detail monster (beri makan, lepas) ada di panel Kandang.

### Pekerja

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Prajurit

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Pemanah

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

### Penombak Berkuda

**Isian pemilik:**

- Bentuk (rupa, ukuran petak, suasana):
- Fungsi (apa yang dilakukan pemain dengan objek ini):
- Saat diketuk (apa yang muncul: kartu, panel, aksi langsung, tombol apa saja):
- Leveling (berapa level, apa yang bertambah tiap level):
- Percepat dengan permata saat dibangun / naik level (boleh atau tidak, harga):
- Deskripsi tiap level (teks yang dilihat pemain):
  - Lv 1:
- Catatan lain:

## 6. Usulan objek baru

Usulan untuk menambah pengalaman bermain; coret yang tidak diinginkan, lalu isi bagiannya. Yang bertanda ★ menutup temuan di bagian 0.

| Usulan                   | Kategori  | Gagasan fungsi                                                                                  | Kenapa membantu                                          |
| ------------------------ | --------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| ★ Penggergajian          | Produksi  | Pekerja di dalam menghasilkan **kayu** (seperti Penggilingan).                                  | Kayu tidak lagi hanya dari alam liar (temuan 2).         |
| ★ Tambang Batu           | Produksi  | Pekerja di dalam menghasilkan **batu**.                                                         | Batu untuk Balai tinggi & tembok (temuan 2).             |
| ★ Penyuling Kristal      | Monster   | Mengubah emas/makanan menjadi **Kristal Jiwa** perlahan.                                        | Sumber Kristal Jiwa yang bisa direncanakan (temuan 3).   |
| ★ Tempat Latihan Monster | Monster   | Monster dewasa berlatih (makanan + waktu) untuk naik **level monster** (+statistik).            | Monster dewasa tetap punya tujuan (temuan 7).            |
| Altar Elemen             | Monster   | Pilih satu unsur; Soul Mixer sedikit lebih sering memberi elemen berunsur itu.                  | Pemain bisa mengarahkan koleksi elemen.                  |
| Perpustakaan Jiwa        | Monster   | Memberi petunjuk resep rahasia secara berkala (mis. satu induk dari resep).                     | Membuat Monsterpedia & resep terasa bisa dikejar.        |
| Menara Elemen            | Militer   | Menara bertahan dengan elemen (api/air/…): unggul melawan musuh tertentu.                       | Pertahanan desa yang lebih taktis.                       |
| Pos Penjaga              | Militer   | Prajurit di dalam ikut bertahan otomatis saat serangan desa.                                    | Prajurit berguna juga untuk bertahan.                    |
| Rumah Sakit Prajurit     | Militer   | Prajurit yang gugur bisa dipulihkan dengan emas/makanan (seperti Kuburan untuk monster).        | Kekalahan tidak terlalu menghukum.                       |
| Lumbung Penyimpanan      | Utama     | Membatasi/menyimpan sumber daya maksimal; level menaikkan batas.                                | Memberi tujuan upgrade (bila batas simpanan diinginkan). |
| Tugu Persahabatan        | Sosial    | Menampilkan bantuan teman hari ini; hadiah kecil bila dibantu banyak teman.                     | Mendorong fitur teman (Tugas 2.1).                       |
| Pedagang Keliling        | Acara     | Muncul sesekali di desa; menukar sumber daya (mis. kayu → batu).                                | Mengatasi kekurangan satu jenis sumber daya.             |
| Dekorasi berefek         | Dekorasi  | Dekorasi memberi bonus kecil ke bangunan produksi di dekatnya (mis. +5%).                       | Dekorasi jadi pilihan, bukan hiasan saja (temuan 4).     |
| Peti Harta               | Alam liar | Kadang muncul di tanah terkunci; dibuka pekerja → hadiah acak (sumber daya, kadang Telur Jiwa). | Kejutan kecil saat menjelajah.                           |
| Jamur Hutan / Pohon Buah | Alam liar | Simpul makanan baru di Pulau Utama.                                                             | Variasi alam liar.                                       |
| Kristal Liar             | Alam liar | Simpul langka yang pasti memberi Kristal Jiwa.                                                  | Alasan menjelajah tanah terkunci (temuan 3).             |
| Sarang Monster Liar      | Alam liar | Sarang musuh yang terus memunculkan musuh sampai dihancurkan; hadiah besar.                     | Tujuan pertarungan di desa sendiri.                      |

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
