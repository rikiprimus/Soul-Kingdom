# Kumpulan Fitur Soul Monster

> **2026-10-18: daftar dinyatakan lengkap oleh pengguna.** Semua fitur 📌 dan keputusan di bagian 4–5 sudah dijadwalkan ke `docs/PLAN.md` (Fase 1A, 1B, dan Fase 1 lanjutan). Bila ada fitur baru, tambahkan di sini dulu.

Daftar fitur yang sedang dikumpulkan sebelum dijadwalkan ke `docs/PLAN.md`. **Belum ada yang dikerjakan dari daftar ini** kecuali yang bertanda ✅.

Status:

- ✅ sudah ada di game
- 📋 sudah masuk rencana (`PLAN.md`, Fase 1A atau fase lain)
- 💡 usulan baru dari referensi, menunggu keputusan pengguna
- 📌 dipilih pengguna (2026-10-18), belum dijadwalkan ke `PLAN.md`
- ❌ tidak dipilih untuk sekarang
- ⏸ ditunda (pertarungan, online)

Referensi utama: **Social Empires** (Social Point, 2011). Proyek pelestariannya di <https://github.com/AcidCaos/socialemperors> berisi server pengganti dan berkas `game_config.json` milik game aslinya. Server di repo itu tipis; aturan simulasinya ada di klien Flash dan diatur oleh konfigurasi tersebut. Ringkasan di bawah adalah **cara kerja (mekanik)** yang dipelajari dari konfigurasi itu, ditulis ulang dengan kata-kata sendiri. Angka, nama, gambar, dan aset Social Empires **tidak dipakai** (aturan CLAUDE.md no. 8); angka Soul Monster dibuat sendiri di `data/`.

---

## 1. Cara kerja simulasi Social Empires (ringkasan)

### Sumber daya

- **Lima sumber daya:**
  - **emas**;
  - **kayu**;
  - **batu**;
  - **makanan**;
  - **uang premium**.
- Ditambah:
  - **XP** (pengalaman pemain);
  - **mana** (untuk sihir).
- Setiap item punya **satu jenis biaya** (emas, kayu, batu, makanan, atau premium). Item yang menghasilkan sesuatu punya **satu jenis hasil**.
- Hampir setiap aksi memberi XP: membangun, memanen, membunuh, dan menyelesaikan misi.

### Level pemain

- Ada 100 level pemain dengan kebutuhan XP yang naik tajam.
- Naik level memberi hadiah kecil (sumber daya atau premium) dan mana.
- **Hampir semua item dikunci dengan level pemain minimum**, bukan dengan level Balai.

### Populasi & rumah

- **Rumah** menambah **populasi maksimum**. Rumah bisa di-upgrade dan setiap tingkat memberi lebih banyak populasi.
- **Semua unit memakai populasi**, baik penduduk desa maupun tentara.
- Balai Kota juga memberi sedikit populasi.

### Penduduk desa (pekerja)

- Dilatih di **Balai Kota** dengan biaya makanan. Mereka adalah unit yang berjalan di peta.
- Pekerja **"dimasukkan" ke sebuah objek** untuk bekerja di sana:
  - pohon;
  - batu;
  - bongkahan emas;
  - tambang;
  - penggilingan.
- Setiap objek punya **kapasitas pekerja**. Makin banyak pekerja di dalam, makin cepat atau makin besar hasilnya.
- Setelah selesai, pekerja keluar lagi ke peta.

### Sumber daya alam di peta

- Pohon (kayu), batu, dan bongkahan emas tersebar di peta. Habis setelah diambil.
- Ada juga **endapan yang tumbuh lagi** sendiri setiap beberapa jam.
- **Hewan liar** muncul sejumlah tetap per hari.

### Bangunan produksi

- **Penggilingan** (makanan) dan **tambang emas** menghasilkan setiap beberapa jam. Hasilnya dipungut dengan klik dan dibantu pekerja di dalamnya.
- **Ladang** ditanam lalu dipanen, dengan rantai upgrade jenis tanaman.
- **Peternakan** (domba, sapi) diisi hewan dan menghasilkan makanan.
- **Keajaiban** (wonder) menghasilkan sumber daya besar secara berkala.

### Militer

- Tiap jenis unit dilatih di bangunannya sendiri:
  - **Barak**: infanteri;
  - **Panahan**: pemanah;
  - **Kandang kuda**: kavaleri;
  - **Bengkel**: senjata pengepung;
  - **Gereja**: penyembuh;
  - **Kastil**: pahlawan.
- Level bangunan membuka unit yang lebih kuat.
- Unit punya:
  - nyawa, serangan, pertahanan, kecepatan, jangkauan, jeda serang;
  - kelompok (kecil/sedang, jarak dekat/jauh, terbang).

### Pertahanan

- Menara, tembok, gerbang tembok, kastil, perlindungan unit, dan kubah pelindung.
- **Strategi pertahanan** bisa dipilih: bertahan ↔ agresif.

### Wilayah

- Peta dibuka dengan **membeli ekspansi** satu per satu.
- Harganya naik tajam. Bisa dibayar dengan emas, premium, atau jumlah teman.
- Ada juga **pulau atau kota tambahan** yang dibuka di level tertentu.

### Ekonomi lain

- **Pasar**:
  - tukar kayu, batu, dan makanan dengan emas;
  - harga naik setiap kali membeli dan pulih seiring waktu;
  - menjual hanya mendapat sebagian harga.
- **Gudang/inventaris**:
  - item (dekorasi, unit hadiah) bisa disimpan lalu ditempatkan lagi;
  - kapasitas gudang bisa ditambah.
- **Jual** item mengembalikan sebagian kecil biaya.
- **Putar** bangunan dan dekorasi (orientasi).

### Konten & retensi

- **Misi** dengan hadiah, dan tutorial bertahap.
- **Bonus harian** berupa siklus hadiah, plus bonus kembali bermain.
- **Koleksi unit**: lengkapi satu set untuk mendapat hadiah.
- **Sarang naga/monster**: rawat telur atau bayi lewat beberapa langkah bertimer (memberi makan, merawat) sampai menjadi unit kuat.

### Pertarungan & PvE

- **Pulau quest NPC** dengan tingkat kesulitan.
- **Mode bertahan hidup** dengan nyawa.
- **Serang pemain lain**: dibatasi energi atau jumlah serangan per periode.
- Sebagian unit **pulih** setelah bertarung, sisanya mati.
- **Kuburan + ramuan** untuk membangkitkan pahlawan.
- **Sihir** memakai mana.
- Turnamen.

### Sosial

- Tetangga dan bantuan.
- Sekutu.
- Hadiah ke teman.
- Undang teman.

---

## 2. Pemetaan ke Soul Monster

| Mekanik Social Empires                                 | Versi Soul Monster                                                      | Status                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------- |
| Emas, makanan                                          | Emas, makanan                                                           | ✅                        |
| Kayu, batu                                             | Kayu, batu dari alam liar, untuk biaya bangunan                         | 📋 1A.2                   |
| Uang premium                                           | Permata (hanya slot, percepat, Ramalan Jiwa — tidak ada monster dijual) | ✅                        |
| Mana & sihir                                           | Jurus elemen di pertarungan                                             | ⏸ 1.3                     |
| Bangunan bertingkat, upgrade, pindah, jual             | Sama                                                                    | ✅                        |
| Pembatas item                                          | Level Balai Utama (bukan level pemain)                                  | ✅ — lihat 📌 A1          |
| Rumah → populasi                                       | Rumah → slot pekerja                                                    | 📋 1A.4 — lihat 📌 A2     |
| Penduduk dimasukkan ke pohon/batu/tambang              | Pekerja dikirim ke node alam, butuh waktu                               | 📋 1A.4–1A.5              |
| Kapasitas pekerja per objek, makin banyak makin cepat  | —                                                                       | 📌 A3                     |
| Endapan yang tumbuh lagi                               | Pohon/batu/semak tumbuh lagi                                            | 📋 1A.5                   |
| Hewan liar per hari, peternakan                        | Hewan: buru atau tangkap → Peternakan                                   | 📋 1A.6                   |
| Ladang tanam/panen                                     | Ladang                                                                  | ✅                        |
| Penggilingan/tambang dengan pekerja                    | Pasar (emas pasif)                                                      | ✅ — lihat 📌 A3          |
| Keajaiban                                              | —                                                                       | 📌 B4                     |
| Barak, panahan, kandang kuda (satu bangunan per jenis) | Barak melatih prajurit dasar Dewasa                                     | 📋 1A.8 — lihat 📌 C3     |
| Pahlawan                                               | Monster legenda dari Soul Mixer                                         | ✅ (lewat mixer)          |
| Ekspansi wilayah berbayar                              | Plot terkunci dibeli dengan emas                                        | 📋 1A.3                   |
| Pulau/kota tambahan                                    | —                                                                       | 📌 B2                     |
| Pasar tukar sumber daya                                | —                                                                       | ❌ A4                     |
| Gudang/inventaris                                      | —                                                                       | 📌 B3                     |
| Putar bangunan                                         | —                                                                       | 📌 B1                     |
| Misi & tutorial                                        | —                                                                       | 📌 B5                     |
| Bonus harian                                           | —                                                                       | 📌 B6                     |
| Koleksi unit → hadiah                                  | Monsterpedia (tanpa hadiah)                                             | ✅ — lihat 📌 C2          |
| Sarang naga/monster (rawat bertahap)                   | —                                                                       | 📌 C1                     |
| Musuh/kemah NPC di sekitar desa                        | Musuh liar harian (bandit → monster kecil → acak)                       | 📋 1A.7                   |
| Quest NPC / Petualangan                                | Mode Petualangan dengan bos                                             | ⏸ 1.5                     |
| Serang pemain, energi serangan                         | Serbu                                                                   | ⏸ 1.4, 2.2 — lihat 💡 D3  |
| Menara, tembok, strategi pertahanan                    | Menara & tembok (tanpa fungsi)                                          | ✅ bangunan — lihat 💡 D1 |
| Unit pulih sebagian setelah bertarung, kuburan         | —                                                                       | 💡 D2                     |
| Tetangga, sekutu, hadiah                               | Teman, pinjam monster                                                   | ⏸ 2.1                     |

---

## 3. Usulan dari referensi

Dipilih pengguna pada 2026-10-18: semua usulan A–C kecuali **A4 Pasar tukar**. Kelompok D (pertarungan) belum ditanyakan karena pertarungan ditunda.

### A. Ekonomi

- 📌 **A1. Level & XP pemain.** Membangun, memanen, mengalahkan musuh, dan menetaskan memberi XP. Naik level memberi hadiah. Level Balai tetap menjadi pembatas bangunan, sedangkan XP memberi rasa maju terus.
- 📌 **A2. Rumah sebagai populasi.** Slot Rumah menjadi **populasi** yang dipakai pekerja **dan** prajurit dari Barak (menggantikan rancangan awal di Fase 1A yang hanya untuk pekerja).
- 📌 **A3. Kapasitas pekerja per node & bangunan berpekerja.**
  - Sebuah pohon atau batu bisa dikerjakan beberapa pekerja sekaligus, jadi lebih cepat.
  - Ada bangunan **Tambang Emas** dan **Penggilingan** yang diisi pekerja untuk produksi berkala.
- ❌ **A4. Pasar tukar.** Tukar kayu, batu, dan makanan ↔ emas dengan harga yang bergerak (naik saat sering dibeli, pulih seiring waktu).

### B. Desa

- 📌 **B1. Putar bangunan & dekorasi** (4 arah).
- 📌 **B2. Pulau tambahan.** Desa kedua atau wilayah bertema (gurun, salju) dibuka di level tinggi.
- 📌 **B3. Gudang.** Simpan dekorasi ke inventaris lalu pasang lagi; hadiah dekorasi masuk gudang.
- 📌 **B4. Keajaiban.** Bangunan langka yang menghasilkan sumber daya besar berkala. Bisa dijadikan hadiah, bukan dijual.
- 📌 **B5. Misi & tutorial bertahap** dengan hadiah.
- 📌 **B6. Bonus harian.** Siklus hadiah masuk harian, plus bonus kembali bermain.

### C. Monster

- 📌 **C1. Sarang Telur Jiwa.** Rawat telur monster istimewa lewat beberapa langkah bertimer (beri makan, hangatkan, bersihkan) sampai menetas.
- 📌 **C2. Koleksi set.** Lengkapi satu set di Monsterpedia (mis. semua wujud tingkat 1, semua elemen api) untuk mendapat hadiah.
- 📌 **C3. Barak per peran.** Tiga bangunan latihan sesuai peran di `forms.json`:
  - Barak untuk penahan;
  - Petarung untuk petarung;
  - Lapangan Panah untuk penembak.
  - Masing-masing membuka wujud dan elemen sendiri.

### D. Pertarungan (untuk nanti)

- **D1. Strategi pertahanan** dan fungsi menara/tembok saat diserang.
- **D2. Pemulihan setelah bertarung.** Monster yang kalah tidak mati: masuk masa pemulihan, atau dirawat di bangunan penyembuh.
- **D3. Energi serangan.** Batas jumlah Serbu per periode waktu.

---

## 4. Keputusan dari pilihan ini (dijawab pengguna 2026-10-18)

1. **Populasi (A2).**
   - Populasi dari Rumah dipakai **pekerja dan semua monster**, baik hasil Barak maupun Soul Mixer.
   - Monster bisa memakai **lebih dari satu slot populasi**, tergantung seberapa bagus monsternya.
2. **Pembatas bangunan (A1).** Bangunan tetap dikunci dengan **level Balai Utama**. Level dan XP pemain hanya memberi hadiah dan rasa maju.
3. **Batas kekuatan Serbu (C3).** Mengikuti **gabungan ketiga barak** (penahan, petarung, penembak).
4. **Pulau tambahan (B2).** Untuk saat ini **berbagi sumber daya** dengan desa utama.

### Keputusan lanjutan (disetujui pengguna 2026-10-18)

- **Slot populasi monster** dihitung dari **tingkat wujud**, memakai `rules.battle.powerPoints` (tingkat 1 = 1 slot, 2 = 2, 3 = 4, 4 = 8, 5 = 15).
- **Kandang** tidak lagi membatasi jumlah monster. Kandang menjadi tempat mengelola monster (daftar, beri makan, pilih tim). Levelnya memberi bonus kecil, mis. makanan lebih hemat (angka di data).
- **Tahap tumbuh** tidak mengubah slot: bayi dan dewasa dengan wujud sama memakai slot yang sama. Ini usulan bawaan, karena belum ada jawaban khusus; ubah bila perlu.

---

## 5. Detail fitur (dijawab pengguna 2026-10-18)

### Pekerja

- Pekerja **dilatih** di Balai Utama dan memakai 1 slot populasi.
- **Tukang dan pekerja adalah orang yang sama.** Membangun dan meng-upgrade juga memakai pekerja. Ini menggantikan `village.builders` yang terpisah dan usulan bawaan 1 di PLAN Fase 1A.
- Pekerja di **Tambang Emas / Penggilingan** tinggal di sana sampai dikeluarkan, dan **tetap bekerja saat game ditutup**.
- Pekerja yang **mengambil sumber daya alam** (pohon, batu, semak, hewan) **tidak bekerja saat game ditutup**. Waktunya hanya berjalan selama bermain.
- Pekerja boleh mengambil sumber daya di mana saja selama sumber dayanya muncul, **termasuk di wilayah terkunci** (menggantikan usulan bawaan 2).

### Alam, hewan, hari

- Musuh liar dan hewan muncul lagi **24 jam sejak terakhir muncul** (bukan tengah malam).
- Hewan ternak memakai **slot Peternakan**, bukan populasi.

### Monster

- **Awal permainan: hanya 1 monster.** Monster berikutnya dari:
  - **Barak** (prajurit dasar);
  - **Sarang Telur Jiwa**: menunggu, bertahap, dan sulit;
  - **Soul Mixer**.
- **Monster bisa mati** saat kalah, lalu tidak bisa dipakai lagi.
- **Kuburan** menghidupkan kembali monster yang mati. Biayanya sumber daya besar (sesuai kekuatan monster) atau permata.
- **Musuh bisa menyerang desa.** Monster pemain melawan balik bila musuh masuk wilayah atau mendekat. Butuh mesin pertarungan (Tugas 1.3).
- **Telur di Sarang** menetas acak, minimal langka, kadang epik.
- **Monster tidak bisa disimpan di gudang.** Bila populasi penuh, pemain harus **melepas/menghapus** monster untuk membuka slot.

### Desa & konten

- Keajaiban: didapat dari hadiah koleksi set dan misi besar, maksimal 1 per jenis.
- Putar bangunan: **2 arah** (cermin).
- **Permata gratis** didapat sedikit dari **dungeon**.
- **Bonus harian:** bila ada hari terlewat, siklus **tidak kembali ke awal tetapi juga tidak maju**. Pemain melanjutkan dari hadiah berikutnya saat masuk lagi.
- **Pulau tambahan:**
  - tema berbeda (gurun, salju);
  - pohon, batu, dan musuh liar khas yang lebih kuat;
  - dibuka di Balai Lv tinggi;
  - punya batas bangunan sendiri;
  - berbagi sumber daya dengan desa utama.

### Jawaban lanjutan (2026-10-18)

1. **Permata untuk Kuburan: disetujui.**
   - Aturan CLAUDE.md no. 7 dan PLAN Tugas 3.1 sudah diperbarui.
   - Sarang Telur Jiwa juga ditambahkan sebagai asal monster di atas tingkat 1.
   - Telur tidak dijual dengan uang asli atau permata.
2. **Dungeon = mode Petualangan** (Tugas 1.5, wilayah dengan bos); dari sinilah permata gratis didapat. Dikonfirmasi pengguna.
3. **Membangun dengan pekerja: makin banyak pekerja, makin cepat.**
   - Ini sengaja jadi pilihan strategi: slot populasi dipakai untuk pekerja atau untuk monster.
   - Usulan rumus: `waktu = waktuDasar / jumlahPekerja`.
   - Ada batas pekerja maksimum per konstruksi sesuai ukuran bangunan (angka di data, mis. 1×1 = 1, 2×2 = 2, 3×3 = 4, 4×4 = 6).
   - Minimal 1 pekerja.
4. **Monster yang kalah saat mempertahankan desa juga mati**, bisa dihidupkan di Kuburan.

---

## 6. Tambahan pengguna (2026-10-18)

- **Tembok sebaris.**
  - Saat membangun Tembok, pemain mengetuk **titik awal** lalu **titik akhir**, lalu konfirmasi; satu baris tembok lurus dibangun sekaligus.
  - **Harga per ruas lebih murah** dan **langsung jadi**.
  - Tembok bisa **di-upgrade**: satu ruas, atau **semua tembok yang tersambung** sekaligus.
  - Tembok yang bersebelahan digambar menyambung.
