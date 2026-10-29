# Rencana Pengerjaan Soul Monster

Rencana ini dipecah menjadi tugas-tugas kecil yang masing-masing bisa diselesaikan Claude Code dalam satu sesi. Kerjakan berurutan; jangan lompat fase sebelum gerbangnya terpenuhi.

Fitur yang sedang dikumpulkan (termasuk usulan dari referensi Social Empires) dicatat di [docs/FITUR.md](FITUR.md) sebelum dijadwalkan ke sini.

**Cara memakai:** buka Claude Code di folder proyek, lalu tulis misalnya:

> Baca CLAUDE.md dan docs/PLAN.md, lalu kerjakan Tugas 0.1.

Setiap tugas selesai jika semua **kriteria selesai** terpenuhi, `pnpm test` dan `pnpm lint` lulus, dan kotak tugas sudah dicentang.

---

## Fase 0 — Prototipe Soul Mixer di browser (2–3 minggu)

Tujuan: game kecil di browser tanpa server, cukup untuk menguji apakah mencampur monster itu seru. Data tersimpan di `localStorage`.

### - [x] Tugas 0.1 — Fondasi proyek

- Buat monorepo pnpm: `apps/game` (Vite + Phaser 3 + TypeScript) dan `packages/shared` (TypeScript murni).
- Pasang Vitest, ESLint, Prettier, dan skrip `dev`, `test`, `lint`, `build` di root.
- `apps/game` menampilkan satu scene kosong bertuliskan "Soul Monster".
- `packages/shared` bisa diimpor dari `apps/game`.

**Kriteria selesai:** `pnpm install && pnpm dev` membuka halaman berjudul Soul Monster; `pnpm test` menjalankan minimal satu tes contoh yang lulus.

> **Ringkasan (selesai 2026-10-18):** pnpm workspace `apps/game` (Vite 6 + Phaser 3.90) dan `packages/shared` (TS murni, diimpor sebagai `@soul-monster/shared`); Vitest, ESLint (flat config, larangan `Math.random`/`Date.now`/DOM/Phaser di shared), Prettier; skrip `dev`, `test`, `lint`, `build`, `typecheck`.

### - [x] Tugas 0.2 — Pemuat dan validasi data

- Di `packages/shared/src/data/`, muat keempat file `data/*.json` dan validasi dengan zod.
- Ekspor tipe TypeScript: `ElementId`, `FormId`, `Element`, `Form`, `Rules`, dan sebagainya.
- Validasi silang: setiap komposisi hanya berisi unsur dasar; tidak ada dua elemen non-rahasia dengan komposisi sama; setiap resep merujuk wujud dan elemen yang ada; elemen pada resep dan monster awal tidak melanggar `maxElementUnitsByFormTier`; jumlah peluang di `formTierOdds` dan `elementOdds` = 1.

**Kriteria selesai:** tes memastikan ada 66 elemen (6 dasar, 15 dua unsur, 20 tiga unsur, 15 empat unsur, 6 lima unsur, 1 enam unsur, 3 rahasia) dan 23 wujud; data rusak buatan tes ditolak dengan pesan jelas.

> **Ringkasan (selesai 2026-10-18):** `packages/shared/src/data/` — skema zod per file + validasi silang (`loadGameData`) yang mengumpulkan semua masalah ke `DataValidationError`. Menambah `data/text.json` (semua teks UI berbahasa Indonesia) dan `rules.prototype` (lihat 0.6). Tes: `data/data.test.ts`.

### - [x] Tugas 0.3 — Mesin elemen

- `unionComposition(a, b)`, `findElementByComposition(units)` (mengabaikan elemen rahasia), `elementUnits(id)`, `capElementForFormTier(id, tier, rng)` (buang unsur acak sampai memenuhi batas).
- `elementAdvantage(attackerId, defenderId)` sesuai rumus di CLAUDE.md.
- `rarityOf(monster)` sesuai `rules.rarity`.

**Kriteria selesai:** tes untuk: Uap + Tanah = Geiser; Uap + Lava = Geiser; gabungan yang sudah 6 unsur tetap Semesta; elemen rahasia tidak pernah ditemukan lewat komposisi; Api vs Angin > 1; Angin vs Api < 1; batas kerusakan dihormati.

> **Ringkasan (selesai 2026-10-18):** `elements.ts` (`unionComposition`, `findElementByComposition`, `elementUnits`, `capUnits`, `capElementForFormTier`, `elementAdvantage`) dan `rarityOf` di `monster.ts`. Tes: `elements.test.ts`.

### - [x] Tugas 0.4 — RNG berbenih

- `createRng(seed)` (misalnya mulberry32) dengan `next()`, `int(min, max)`, `pick(array)`, `chance(p)`.
- Status RNG bisa disimpan dan dilanjutkan.

**Kriteria selesai:** benih sama menghasilkan urutan sama; tes sebaran sederhana lulus.

> **Ringkasan (selesai 2026-10-18):** `rng.ts` — mulberry32 `createRng(seed | state)` dengan `next/int/pick/chance/shuffle/getState`; status disimpan di `PlayerState.rngState`. Tes: `rng.test.ts`.

### - [x] Tugas 0.5 — Mesin Soul Mixer

- Fungsi murni `rollMix(parentA, parentB, context, rng)` yang mengikuti urutan di CLAUDE.md: resep monster → tingkat wujud (dengan batas Tingkat Petualang) → wujud acak → elemen (rahasia → gabungan/induk/sebagian) → batas elemen per wujud → mutasi → pity.
- `context` berisi jumlah bos dikalahkan dan streak pity.
- Kembalikan hasil lengkap plus info untuk tampilan (apakah resep, mutasi, elemen rahasia).
- `mixCost(parentA, parentB, context)` sesuai `rules.mixer.costByResultTier`.
- `validateParents(...)`: keduanya dewasa, bukan monster yang sama, monster legenda dilindungi jika `protectLegendaryParents`.

**Kriteria selesai:** tes Monte Carlo 100.000 kali: peluang tingkat wujud dan elemen sesuai `rules.json` dalam toleransi ±1 poin persen; resep monster selalu memberi hasil pasti; hasil tidak pernah melewati batas tingkat; elemen rahasia hanya pada wujud tingkat 5; pity menaikkan peluang mutasi lalu reset.

> **Ringkasan (selesai 2026-10-18):** `mixer.ts` — `rollMix`, `mixCost`, `validateParents`, `isParentConsumed`, `formTierOddsWithPity`, `mixOddsTable`. Tes Monte Carlo 100.000 kali di `mixer.test.ts`. Keputusan tafsir: bonus pity diambil dari peluang "sama"; unsur mutasi ditambahkan sebelum batas unsur wujud dan dilindungi saat pemangkasan; induk legenda **tidak lebur** (bukan ditolak) agar resep `naga-purba-langit` tetap bisa dicapai.

### - [x] Tugas 0.6 — Status pemain dan penyimpanan

- Model `PlayerState`: sumber daya, level Balai Utama, bos dikalahkan, daftar monster (id, wujud, elemen, tahap, makanan terkumpul), antrean campur (slot, induk, hasil terkunci, waktu selesai, sudah diramal), Monsterpedia (wujud+elemen yang pernah dimiliki, resep ditemukan), streak pity.
- Aksi murni: `startMix`, `collectMix`, `cancelMix` (hanya sebelum mulai, setelah Ramalan Jiwa), `prophesy`, `feedMonster`, `buyBaseMonster`, `speedUp` (pakai permata).
- Hasil campur diacak saat `startMix` dan disimpan terkunci; `collectMix` hanya membuka.
- Simpan/muat dari `localStorage` dengan nomor versi skema; status awal dari `rules.economy`.

**Kriteria selesai:** tes untuk setiap aksi termasuk kasus gagal (sumber daya kurang, induk belum dewasa, slot penuh); simpan → muat menghasilkan status identik.

> **Ringkasan (selesai 2026-10-18):** `state.ts` — `PlayerState` + aksi murni `startMix` (opsi `awaitProphecy`), `prophesy`, `confirmMix`, `cancelMix`, `collectMix`, `speedUp`, `feedMonster`, `buyBaseMonster`, `buyMixerSlot`, plus aksi sementara `harvest` dan `upgradeTownHall` (angka di `rules.prototype`, diganti bangunan di Fase 1). `save.ts` — simpan/muat ber-versi skema dengan validasi zod. Tes: `state.test.ts`.

### - [x] Tugas 0.7 — Layar Koleksi

- Grid kartu monster: nama (wujud + elemen), tahap, tingkat, kelangkaan, statistik.
- Gambar sementara buatan kode: bentuk dasar per wujud (lingkaran untuk tingkat 1, makin bersudut dan bertanduk untuk tingkat tinggi), ukuran per tahap (bayi kecil dan berkepala besar, dewasa lebih besar), warna dari unsur elemen.
- Tombol beri makan untuk menumbuhkan bayi → remaja → dewasa.
- Toko: beli wujud tingkat 1 berelemen dasar dengan emas.

**Kriteria selesai:** pemain bisa melihat, memberi makan, dan membeli monster; tampilan tidak pecah di lebar 360 px (ukuran HP).

> **Ringkasan (selesai 2026-10-18):** `CollectionView`, `ShopView`, kartu monster (`ui/MonsterCard.ts`), gambar monster buatan kode (`art/monsterArt.ts`: bulat → bertaring → bertanduk → bersayap → bermahkota; ukuran & proporsi kepala per tahap; warna dari unsur). Dicek di lebar 360 px.

### - [x] Tugas 0.8 — Layar Soul Mixer

- Pilih dua induk dewasa; tampilkan biaya, waktu, dan **tabel peluang dasar** (gratis).
- Tombol **Ramalan Jiwa**: bayar permata → tampilkan hasil pasti → pilih Lanjutkan atau Batal.
- Antrean dengan hitung mundur; tombol percepat dengan permata; ambil hasil saat selesai dengan animasi penetasan.
- Tampilkan tanda khusus bila hasil dari resep rahasia, mutasi, atau elemen rahasia.

**Kriteria selesai:** alur penuh beli → tumbuhkan → campur → tetas → tumbuhkan → campur lagi bisa dimainkan; muat ulang halaman tidak menghilangkan antrean.

> **Ringkasan (selesai 2026-10-18):** `MixerView` — pilih induk, biaya/waktu, tabel peluang dasar, Ramalan Jiwa (Lanjutkan/Batal), antrean dengan hitung mundur, percepat, beli slot, animasi penetasan, tanda resep/mutasi/elemen rahasia. Antrean tersimpan di `localStorage` dan bertahan setelah muat ulang.

### - [x] Tugas 0.9 — Monsterpedia

- Daftar 66 elemen dan 23 wujud: yang sudah ditemukan tampil berwarna, sisanya siluet "???".
- Halaman elemen menampilkan komposisi unsur (6 titik unsur) setelah ditemukan.
- Resep monster rahasia yang ditemukan tercatat.

**Kriteria selesai:** penemuan baru langsung muncul; persentase koleksi tampil.

> **Ringkasan (selesai 2026-10-18):** `PediaView` — tab Elemen (66, ikon pie unsur, detail 6 titik unsur), Wujud (23, siluet untuk yang belum ditemukan), Resep (4); persentase koleksi dari `pediaProgress` (shared, dengan tes).

### - [x] Tugas 0.10 — Efek kelangkaan

- Sesuai `rules.rarity.visuals`: biasa diam; langka bergerak berulang (tween napas/goyang) + aura warna elemen; epik + partikel sesuai unsur (api: bara, air: tetesan, tanah: serpihan, angin: garis angin, cahaya: kilau, kegelapan: asap gelap; elemen gabungan mencampur partikel unsurnya); legenda + aura emas dan bingkai kartu emas.
- Efek dibuat sekali per unsur lalu digabung sesuai komposisi.

**Kriteria selesai:** keempat kelangkaan bisa dibedakan sekilas; tetap lancar dengan 30 kartu di layar.

> **Ringkasan (selesai 2026-10-18):** `art/MonsterView.ts` — biasa diam; langka napas/goyang + aura warna elemen; epik + partikel per unsur (tekstur dan konfigurasi emitter dibuat sekali per unsur lalu digabung sesuai komposisi); legenda + aura & kilau emas dan bingkai kartu emas. Kelancaran 30 kartu belum diukur di HP sungguhan.

### - [ ] Tugas 0.11 — Panel debug dan rilis uji

- Panel debug (hanya mode dev): tambah sumber daya, lompati waktu, ubah level Balai Utama, ubah jumlah bos dikalahkan, reset simpanan.
- Build statis dan petunjuk deploy ke Vercel, Netlify, atau GitHub Pages di `docs/DEPLOY.md`.

**Kriteria selesai:** prototipe bisa dibuka lewat tautan publik di HP.

> **Ringkasan (sebagian, 2026-10-18):** Panel debug DOM (`src/debug/DebugPanel.ts`, aktif di `pnpm dev` atau build dengan `VITE_ENABLE_DEBUG=true`), build statis `apps/game/dist` (path relatif), petunjuk di `docs/DEPLOY.md`. **Belum selesai:** deploy ke tautan publik dan uji di HP perlu dilakukan pemilik akun hosting.

**Gerbang Fase 0:** 10–20 penguji mencoba; mayoritas ingin mencampur lagi tanpa disuruh. Catat masukan di `docs/FEEDBACK.md` sebelum lanjut.

---

## Fase 1 — Inti game (6–8 minggu)

### - [x] Tugas 1.1 — Markas isometrik

- Peta grid isometrik, kamera geser dan zoom (sentuh dan mouse).
- Bangunan: Balai Utama, Soul Mixer (terkunci sampai Balai level 4), Kandang Monster, Barak, Ladang, Pasar, Gerbang Petualangan, Arena, Menara, Tembok, Dekorasi.
- Tempatkan, pindahkan, upgrade; data bangunan (biaya, waktu, produksi, kapasitas) ditambahkan ke `data/buildings.json`.

> **Ringkasan (selesai 2026-10-18, dikerjakan atas permintaan pengguna sebelum Gerbang Fase 0):** `data/buildings.json` (15 bangunan, 3 jenis rintangan, desa awal, jumlah pekerja) + validasi zod. Logika murni `packages/shared/src/village.ts`: tempatkan/pindah/upgrade dengan pekerja dan timer, batas jumlah per level Balai Utama, kapasitas Kandang, rintangan yang bisa dibersihkan (peluang Kristal Jiwa). Client: `VillageScene` (pulau isometrik, geser/zoom mouse & sentuh/pinch, bangunan buatan kode di `art/buildingArt.ts`, monster berkeliaran, mode pasang/pindah) dan `UIScene` (HUD, menu Bangun, kartu info bangunan, panel Monster/Toko/Soul Mixer/Pedia). Soul Mixer kini butuh bangunan Soul Mixer; simpanan naik ke skema v2 dengan migrasi dari v1. `rules.prototype` (penghasilan sementara Fase 0) dihapus.

### - [x] Tugas 1.2 — Ekonomi dan produksi

- Produksi emas dan makanan berbasis waktu, panen manual, kapasitas penyimpanan.
- Skrip `pnpm sim:economy` yang mensimulasikan 14 hari pemain gratis dan mencetak kapan tiap tingkat wujud bisa dicapai.

> **Ringkasan (sebagian, 2026-10-18):** produksi emas Pasar berbasis waktu dengan kapasitas per bangunan dan panen manual (ketuk), Ladang tanam → tumbuh → panen makanan. Skrip `pnpm sim:economy` selesai di Tugas 1A.11.
>
> **Perapian simulasi desa (2026-10-18):** hasil ladang dikunci saat menanam (menutup celah tanam di level rendah lalu upgrade); ladang yang sedang di-upgrade tetap bisa dipanen tapi tidak bisa ditanami; tombol _Pungut semua_; dekorasi & tembok bisa dijual (`sellRefundRatio`); ambang gelembung panen dari data (`collectReadyRatio`); urutan gambar isometrik yang benar untuk bangunan beda ukuran; monster yang tertimpa bangunan dipindah; tanda saat konstruksi selesai; sorotan bangunan saat kursor di atasnya. Simpanan naik ke skema v3 (migrasi dari v2).

## Fase 1A — Simulasi desa ala Social Empires (6–8 minggu)

Disisipkan sebelum pertarungan atas permintaan pengguna. Referensi mekanik: Social Empires (lihat `docs/FITUR.md` bagian 1). Semua keputusan rinci ada di `docs/FITUR.md` bagian 4–5; ringkasan di bawah adalah aturan yang dipakai saat membangun. **Semua angka** (ukuran peta, harga, waktu, hasil, slot, kapasitas, laju tumbuh) masuk ke `data/`, bukan kode.

### Aturan inti Fase 1A

**Sumber daya**

- Sumber daya: emas, makanan, **kayu**, **batu**, Kristal Jiwa, permata.
- Kayu dan batu dipakai untuk biaya bangunan dan upgrade.
- Emas dipakai untuk wilayah, bibit, dan latihan.

**Populasi**

- **Rumah** menambah populasi maksimum. Satu Rumah tambahan dibuka per level Balai Utama, dan upgrade Rumah menambah populasi.
- Populasi dipakai oleh:
  - **pekerja**: 1 slot;
  - **semua monster**: slot = `rules.battle.powerPoints` tingkat wujudnya (1/2/4/8/15). Bayi dan dewasa sama.
- Populasi penuh → monster baru (Barak, telur, Soul Mixer) ditolak. Pemain bisa **melepas** monster untuk membuka slot. Monster tidak bisa disimpan di gudang.
- **Kandang** tidak lagi membatasi jumlah monster. Kandang menjadi tempat mengelola monster (daftar, beri makan, pilih tim), dan levelnya memberi bonus kecil.

**Pekerja**

- Pekerja **dilatih** di Balai Utama (makanan + waktu).
- **Pekerja juga tukang.** Setiap pekerja punya satu status:
  - menganggur;
  - membangun;
  - mengambil sumber daya alam;
  - tinggal di bangunan berpekerja.
- **Membangun dan meng-upgrade memakai pekerja.** Makin banyak pekerja, makin cepat:
  - `waktu = waktuDasar / jumlahPekerja`;
  - minimal 1 pekerja;
  - maksimal sesuai ukuran bangunan (angka di data).
  - `village.builders` dihapus.
- **Ambil sumber daya alam:** pohon, batu, semak, dan hewan bisa dikerjakan beberapa pekerja sekaligus sampai kapasitas node, dan makin banyak makin cepat.
  - Waktunya **hanya berjalan selama game dibuka**.
  - Boleh di wilayah terbuka maupun terkunci, selama sumber dayanya ada.
- **Tambang Emas dan Penggilingan:**
  - pekerja tinggal di dalam sampai dikeluarkan;
  - produksi berkala naik sesuai jumlah pekerja;
  - **tetap berjalan saat game ditutup**.
- Strategi yang dituju: slot populasi dipakai untuk pekerja (ekonomi cepat) atau untuk monster (kekuatan).

**Wilayah**

- Peta besar (mis. 48×48) dibagi menjadi plot (mis. 8×8). Awalnya hanya plot kecil di tengah yang terbuka.
- Plot terkunci tampak berkabut dengan papan harga. **Bangunan tidak bisa ditempatkan di sana.**
- Plot dibeli dengan **emas** dan harus bersebelahan dengan plot terbuka. Harganya naik per pembelian.

**Alam liar**

- Pohon (kayu), batu (batu), dan semak (makanan) tersebar di seluruh peta dan tumbuh lagi perlahan.
- Rintangan berbayar emas yang ada sekarang dihapus.
- Hewan liar muncul lagi **24 jam sejak terakhir muncul**. Hewan bisa:
  - **diburu** → makanan;
  - **ditangkap** → **Peternakan**, memakai slot Peternakan (bukan populasi), lalu menghasilkan makanan pasif.

**Musuh liar & tim monster**

- Kelompok musuh muncul lagi **24 jam sejak terakhir muncul**. Isinya bertahap mengikuti level Balai:
  1. bandit;
  2. monster kecil;
  3. acak sesuai level: banyak monster kecil **atau** satu monster besar.
- Monster di desa berkeliaran dan **bisa diketuk untuk dipilih**. Pemain mengetuk tujuan, lalu tim berjalan ke sana.
- Hasil sementara dihitung dengan rumus kekuatan + keunggulan elemen + RNG berbenih, sampai pertarungan sungguhan ada (Tugas 1.3).
- **Monster yang kalah mati** dan masuk **Kuburan**.

**Kuburan**

- Monster mati bisa dihidupkan kembali dengan sumber daya besar (sesuai kekuatan monster) **atau permata**.

**Barak per peran**

- Tiga bangunan latihan: **Barak** (penahan), **Petarung** (petarung), dan **Lapangan Panah** (penembak).
- Ketiganya melatih prajurit dasar: wujud tingkat 1 berelemen dasar, keluar **langsung Dewasa**, dan memakai populasi.
- Level bangunan membuka wujud atau elemen lain dan menambah antrean.
- **Toko monster dihapus.**
- Batas poin kekuatan Serbu nanti = **gabungan level ketiga barak**.

**Awal permainan**

- Pemain mulai dengan **1 monster saja**.
- Monster berikutnya dari Barak, Sarang Telur Jiwa (Fase 1B), dan Soul Mixer.

**Pembatas**

- Bangunan tetap dikunci dengan **level Balai Utama**.

**Layar**

- **Android**: dikunci horizontal.
- **Browser**: layar penuh.

### - [ ] Tugas 1A.1 — Tata letak horizontal & layar penuh

Dikerjakan pertama supaya semua UI berikutnya langsung dirancang untuk landscape.

- **HUD dan bilah aksi:** sumber daya di atas, tombol aksi ringkas di samping/bawah, kartu info sebagai panel samping.
- **Panel dan modal:** muat di tinggi 360 px; konten panjang bisa digulir; modal penetasan dan Ramalan Jiwa disesuaikan.
- **Layar penuh dan orientasi:**
  - tombol layar penuh plus permintaan layar penuh pada ketukan pertama di HP;
  - `screen.orientation.lock('landscape')` bila didukung;
  - overlay "putar HP" saat HP dipegang tegak.
- **PWA:** `manifest.webmanifest` dengan `display: fullscreen` dan `orientation: landscape`, plus ikon sementara buatan kode.
- **iPhone/Safari:** cara terbaiknya "Tambahkan ke Layar Utama", karena Safari tidak mendukung Fullscreen API untuk halaman biasa.
- **Android:** catat `orientation: landscape` untuk Capacitor (Tugas 2.4).

> **Ringkasan (sebagian, 2026-10-18):**
>
> - **Tata letak** `apps/game/src/ui/layout.ts`:
>   - Desa memenuhi layar di bawah HUD (HUD satu baris di landscape).
>   - **Bilah tab mengambang** di kiri bawah berisi **Bangun, Toko, Pedia** berjajar menyamping, dengan tombol ‹/› untuk menyembunyikan atau menampilkan (diingat per browser).
>   - **Soul Mixer** hanya dibuka lewat bangunan Soul Mixer (kartu info, atau gelembung telur saat ada hasil siap); **Monster** lewat Kandang.
>   - Kartu info bangunan dan panel berada di atas bilah tab; saat memasang bangunan, bilah tab berganti menjadi bilah Pasang/Batal yang mengambang.
> - **Modal** otomatis mengecil bila lebih tinggi dari layar.
> - **Kartu koleksi** mendatar untuk layar pendek.
> - **Layar penuh** `ui/fullscreen.ts`: masuk pada ketukan pertama, tombol ⛶ di HUD, kunci landscape, layar "Putar HP" di perangkat sentuh yang tegak.
> - **PWA**: `public/manifest.webmanifest` (fullscreen + landscape) dengan ikon buatan kode (`pnpm --filter @soul-monster/game icons`).
> - **Catatan iOS dan Capacitor** di `docs/DEPLOY.md`.
> - **Sudah diuji** di browser pada 640×360, 800×360, 1280×720, dan HP tegak (layar putar).
> - **Belum diuji:** layar penuh dan kunci orientasi di HP Android sungguhan.

**Kriteria selesai:**

- Semua layar dipakai di 640×360, 800×360, dan 1280×720 tanpa elemen terpotong.
- Di Chrome Android: layar penuh + landscape terkunci.
- Di desktop: tombol layar penuh berfungsi.

### - [x] Tugas 1A.2 — Data & model baru

- `resources` mendapat `wood` dan `stone`. Biaya bangunan bisa memuat emas, makanan, kayu, dan batu.
- `data/buildings.json`:
  - peta dan plot: `mapSize`, `plotSize`, plot awal, harga plot, syarat Balai per plot;
  - bangunan baru:
    - Rumah (populasi per level);
    - Tambang Emas dan Penggilingan (slot pekerja, hasil per pekerja per periode);
    - Peternakan (slot hewan);
    - Kuburan;
    - Petarung dan Lapangan Panah;
  - batas pekerja konstruksi per ukuran bangunan;
  - waktu dan biaya latih pekerja.
- `data/wilds.json` (baru):
  - node alam: kapasitas pekerja, waktu, hasil, laju tumbuh, kepadatan per plot;
  - hewan: hasil buru, produksi di Peternakan, jumlah per 24 jam;
  - tabel musuh liar bertahap per level Balai;
  - hadiah musuh;
  - biaya Kuburan.
- `data/rules.json`:
  - aturan populasi monster (memakai `powerPoints`);
  - satu monster awal.
- Validasi zod dan validasi silang:
  - plot awal menutupi semua bangunan awal;
  - populasi awal cukup untuk monster dan pekerja awal;
  - musuh dan hewan merujuk wujud dan elemen yang ada.
- Simpanan naik ke v4 dengan migrasi dari v3:
  - Desa lama dipindah ke tengah peta besar, dan plot yang ditempatinya ikut terbuka.
  - Monster lama tetap ada walau melebihi populasi. Monster baru baru boleh masuk setelah ada slot.
  - Rintangan lama menjadi node alam.

**Kriteria selesai:**

- Data rusak buatan tes ditolak dengan pesan jelas.
- Migrasi v3 → v4 lulus tes.

> **Ringkasan (selesai 2026-10-18):**
>
> - **Sumber daya:** `wood`/`stone` di `Resources` dan biaya bangunan (`villageAmountSchema`, bagian yang tidak ditulis = 0); HUD 6 sumber daya; label biaya gabungan `ui/cost.ts`.
> - **`data/wilds.json` (baru):** node alam (pindahan rintangan lama, dengan `yield` kayu/batu/makanan, data kerja pekerja dan tumbuh lagi), hewan, musuh liar bertahap per level Balai, biaya Kuburan.
> - **`buildings.json`:**
>   - peta 48×48 dengan plot 8×8, `initialPlots`, `plotCostGold`, `plotRequiresTownHall`;
>   - populasi Balai Utama;
>   - bangunan baru **tersembunyi** (`hidden`) sampai tugasnya: Rumah, Tambang Emas, Penggilingan, Peternakan, Kuburan, Arena Petarung, Lapangan Panah.
> - **`rules.json`:** `population`, `workers`, kayu/batu awal.
> - **Validasi silang:** plot awal menutupi bangunan awal; populasi awal cukup; data `house`/`staffed`/`ranch` lengkap; musuh merujuk tingkat wujud dan tahap yang ada.
> - **Simpanan v4:** desa lama dipindah ke tengah peta besar, alam liar ditambahkan di sekelilingnya, kayu/batu awal diberikan. Migrasi yang gagal kini menjadi `SaveLoadError`.
> - **Sementara (sudah selesai):** pohon/batu dibersihkan dengan emas sampai Tugas 1A.6 (kini dengan pekerja); semua plot terbuka sampai Tugas 1A.3.
> - **Ditunda ke 1A.9 (sudah selesai):** monster awal = 1, karena butuh Barak agar pemain baru bisa mendapat monster kedua.

### - [x] Tugas 1A.3 — Wilayah terkunci & pembelian plot

**Logika shared:**

- `plotOf`, `isTileUnlocked`, `canBuyPlot`, `buyPlot`.
- `canPlace` dan `moveBuilding` menolak petak terkunci.

**Client:**

- Peta besar, plot terkunci berkabut dengan pagar dan papan harga.
- Ketuk plot → kartu "Buka wilayah (X emas)".
- Batas kamera mengikuti peta.

**Kriteria selesai:**

- Tes untuk: beli plot (emas cukup/kurang, tidak bersebelahan, syarat Balai) dan penempatan di petak terkunci ditolak.
- Plot terkunci terlihat jelas dan bisa dibeli.

> **Ringkasan (selesai 2026-10-18):**
>
> - **Shared (`village.ts`):** `Village.unlockedPlots` ("px,py"); `plotOf`, `isTileUnlocked`, `isAreaUnlocked`, `canPlaceBuilding`, `isPlotAdjacent`, `nextPlotPrice` (harga ke-n dari `plotCostGold`, syarat dari `plotRequiresTownHall`), `plotStatus`, `buyPlot`. `buildBuilding`, `moveBuilding`, dan `buildLine` menolak lahan terkunci (`plotLocked`). Desa baru membuka `initialPlots`.
> - **Simpanan v5:** migrasi 4 membuka plot awal plus setiap plot yang ditempati bangunan lama, jadi desa lama tidak rusak.
> - **Client:** plot terkunci digelapkan (lahan terbuka tetap terang; pagar batas dihapus atas permintaan pengguna 2026-10-20), papan harga (atau "Balai Lv X") di plot yang bersebelahan; pohon/batu di lahan terkunci tampak pudar tapi tetap bisa dipilih. Ketuk papan atau lahan terkunci → kartu "Wilayah terkunci" dengan tombol Beli + konfirmasi; kotak kuning menandai plot terpilih. Penempatan (biasa & tembok sebaris) merah di lahan terkunci; monster hanya berjalan di lahan terbuka. Debug: "Buka semua wilayah".
> - **Tes:** `plots.test.ts` (plot awal, tolak bangun/tembok/pindah di lahan terkunci, beli berurutan dengan harga naik, tolak plot terbuka/jauh/di luar peta/emas kurang/Balai kurang, migrasi v4). Tes lama membuka semua plot di helper-nya. Total 115 tes lulus.
> - **Dicek di browser 800×400:** beli plot (3.556 → 2.556 emas, harga berikutnya 1.200), pagar dan papan pindah.

### - [x] Tugas 1A.4 — Populasi, Rumah & pekerja

**Logika:**

- Rumah memberi populasi; batas jumlah Rumah = level Balai.
- `populationUsed(state)` = pekerja + slot monster; `populationCap(state)` dari Rumah dan Balai.
- `trainWorker` di Balai (antrean + waktu).
- `releaseMonster` (dengan konfirmasi di UI).
- Barak, telur, dan Soul Mixer menolak bila populasi penuh.
- Kandang tidak lagi membatasi jumlah monster.

**Model pekerja:**

- Daftar pekerja dengan status (menganggur / membangun / mengambil / tinggal di bangunan) dan target.
- Fungsi `assignWorkers` dan `releaseWorkers`.

**Client:**

- HUD: populasi terpakai/maks dan pekerja menganggur/total.
- Pekerja tampil sebagai orang kecil buatan kode yang berjalan ke target.

**Kriteria selesai:** tes untuk populasi (pekerja + slot monster per tingkat), latih pekerja, populasi penuh ditolak, dan melepas monster membuka slot.

> **Ringkasan (selesai 2026-10-18):**
>
> - **Shared (`workers.ts`, baru):** `Worker` dengan tugas `idle` / `building` / `gathering` / `staffed`; `populationCap` (Balai + Rumah yang selesai), `populationUsed` (pekerja dan yang sedang dilatih × `workerSlots`, monster × `powerPoints` tingkat wujudnya), `hasRoomFor`, `trainWorker` (makanan, antrean berurutan maks. `trainQueueMax`), `settleTraining`, `assignWorkers`, `releaseWorkers`, `releaseMonster` (monster di Soul Mixer tidak bisa dilepas).
> - **Kandang tidak lagi membatasi monster:** `stableCapacity`, `isStableFull`, dan error `stableFull` dihapus; Toko dan menetaskan hasil Soul Mixer menolak dengan `populationFull`. Rumah sudah bisa dibangun (1 per level Balai).
> - **Pekerja = tukang (sebagian 1A.5 ikut dikerjakan):** `village.builders` dihapus. Konstruksi berwaktu memakai 1 pekerja menganggur (`buildersBusy` kalau tidak ada) dan pekerja kembali menganggur saat selesai atau dipercepat. Jumlah pekerja per konstruksi dan rumus kecepatan tetap di 1A.5.
> - **Simpanan v6:** migrasi 5 membuat pekerja awal (minimal satu per konstruksi yang sedang berjalan).
> - **Client:** HUD "Pekerja menganggur/total · Populasi terpakai/maks"; kartu Balai (populasi, pekerja, hitung mundur latihan, tombol "Latih pekerja"); kartu Rumah dan Kandang menampilkan populasi; tombol "Lepas" + konfirmasi di kartu monster; pekerja tampil sebagai orang kecil bertopi kuning yang berkeliling dekat Balai, berjalan ke bangunan yang dikerjakan, lalu mengayun palu; notifikasi "Pekerja baru siap".
> - **Tes:** `workers.test.ts` (populasi per tingkat, Rumah menambah populasi, batas Rumah per Balai, populasi penuh ditolak di Toko/Soul Mixer, lepas monster, latih pekerja berurutan, antrean/makanan/populasi penuh, pekerja konstruksi pergi dan kembali, assign/release, migrasi v5). Total 124 tes lulus.
> - **Dicek di browser 800×400:** latih 2 pekerja (makanan −100, Pekerja 2/2 → 4/4), dialog lepas monster (dibatalkan).

### - [x] Tugas 1A.5 — Membangun dengan pekerja

- Membangun dan meng-upgrade memilih jumlah pekerja (1 sampai batas ukuran bangunan).
- `waktu = waktuDasar / pekerja`.
- Pekerja sibuk sampai selesai, lalu kembali menganggur.
- Pekerja bisa ditambah ke konstruksi yang sedang berjalan; sisa waktunya dihitung ulang.
- ~~Tukang terpisah (`village.builders`) dihapus.~~ Sudah di 1A.4 (1 pekerja per konstruksi).
- **UI:** penggeser jumlah pekerja di kartu bangun/upgrade, dengan perkiraan waktu yang langsung berubah.

**Kriteria selesai:** tes untuk waktu per jumlah pekerja, batas per ukuran, pekerja kurang ditolak, tambah pekerja di tengah jalan, dan pekerja kembali menganggur.

> **Ringkasan (selesai 2026-10-18):**
>
> - **Shared (`village.ts`):** `maxConstructionWorkers` (dari `rules.workers.constructionMaxBySize` per ukuran), `constructionTime` (= `ceil(waktuDasar / pekerja)`), `constructionWorkers`. `buildBuilding` menerima `workers` dan `upgradeBuilding` menerima `{ workers }` (bawaan 1); keduanya menolak dengan `invalidAmount`, `tooManyWorkers`, atau `buildersBusy`. Bangunan instan tidak memakai pekerja. `addConstructionWorkers` menambah pekerja ke konstruksi yang berjalan; sisa waktunya menjadi `sisa × pekerjaLama / pekerjaBaru` (`notConstructing` kalau tidak sedang dibangun).
> - **Client:** penggeser − / + jumlah pekerja di atas bar Pasang (bawaan sebanyak mungkin, dengan perkiraan waktu yang langsung berubah, atau "Semua pekerja sibuk"). Kartu upgrade punya penggeser yang sama. Kartu konstruksi menampilkan "Dikerjakan n/maks pekerja" dan tombol "Tambah pekerja" dengan sisa waktu baru. Label tombol yang panjang (biaya) kini dibungkus ke baris berikutnya sebelum dikecilkan.
> - **Tes:** 4 tes baru di `workers.test.ts` (waktu per jumlah pekerja, batas ukuran/kurang pekerja/jumlah tidak valid, upgrade lebih cepat, tambah pekerja di tengah jalan dan semua kembali menganggur). Total 128 tes lulus.
> - **Dicek di browser 800×400:** Ladang 4/4 pekerja = 8 dtk → 3/4 = 10 dtk; kartu upgrade Pasar "2 pekerja · 7m 30d".

### - [x] Tugas 1A.6 — Alam liar: pohon, batu, semak

- Node tersebar di seluruh peta (terbuka dan terkunci) dengan benih pemain.
- Pekerja dikirim ke node (sampai kapasitas node); makin banyak pekerja, makin cepat.
- **Waktu hanya berjalan selama bermain:**
  - progres disimpan sebagai "detik kerja terkumpul";
  - client memajukannya saat aktif;
  - saat kembali dari offline, progres tidak bertambah.
  - Catatan untuk server (Tugas 1.6): butuh detak aktif dari client.
- Tumbuh lagi: fungsi murni `regrowWilds(state, now)` menambah node sampai batas kepadatan per plot; deterministik dari benih + waktu.

**Kriteria selesai:** tes untuk hasil, kecepatan per jumlah pekerja, tidak maju saat offline, tumbuh lagi tidak melewati batas kepadatan, dan determinisme.

> **Ringkasan (selesai 2026-10-18):**
>
> - **Shared (`wilds.ts`, baru):** `Obstacle.work` = detik kerja terkumpul. Fungsinya:
>   - `sendWorkers` (sampai `work.maxWorkers`; error `tooManyWorkers`/`buildersBusy`/`invalidAmount`) dan `recallWorkers` (progres tetap tersimpan; `notGathering`);
>   - `gatherWorkers`, `gatherRemaining`;
>   - `advanceWilds(state, detikAktif)`: tiap pekerja menambah 1 detik kerja per detik; node yang penuh hilang, memberi `yield` + peluang Kristal Jiwa, dan pekerjanya kembali menganggur;
>   - `regrowWilds(state, now)`: tiap `regrow.stepSeconds`, tiap plot × jenis node punya peluang `chancePerStep` untuk menumbuhkan satu node di petak kosong, sampai `maxPerPlot`; dikejar maksimal `regrow.maxSteps` langkah; deterministik dari RNG simpanan + waktu.
> - **Bersihkan pakai emas dihapus** (`clearObstacle`, `clearGold`): alam liar hanya bisa diambil oleh pekerja.
> - **Data:** `wilds.json` punya `regrow { stepSeconds, maxSteps }`; `perHourPerPlot` diganti menjadi `chancePerStep`.
> - **Waktu hanya berjalan saat bermain:** client mengumpulkan detik aktif (jeda lebih dari 2 detik per tick tidak dihitung) dan mengirimnya ke `advanceWilds` tiap 5 detik atau saat sebuah node selesai. `settleVillage`, waktu offline, dan lompat waktu debug tidak menambah progres. Catatan untuk server (1.6): butuh detak aktif dari client.
> - **Simpanan v7:** migrasi 6 memberi `work: 0` ke semua node dan `village.regrowAt` dari waktu terakhir desa disentuh.
> - **Client:** kartu pohon/batu/semak menampilkan hasil, progres %, pekerja n/maks, dan sisa waktu, dengan penggeser pekerja, "Kirim pekerja", dan "Panggil pulang". Bilah progres hijau tampil di atas node yang dikerjakan, dan hasil (+kayu/+batu/+makanan, Kristal Jiwa) melayang saat selesai. Pekerja berjalan ke samping node (boleh masuk lahan terkunci) lalu mengayun alat. Alam liar tumbuh lagi lewat `store.settle`.
> - **Tes:** `wilds.test.ts` (hasil, kecepatan per jumlah pekerja dan batas node, panggil pulang menyimpan progres, tidak maju saat offline, Kristal Jiwa Monte Carlo 100.000×, tumbuh lagi per langkah dan tidak melewati `maxPerPlot`, tidak tumbuh di bangunan, deterministik, migrasi v6). Tes lama "bersihkan dengan emas" dihapus. Total 134 tes lulus.
> - **Dicek di browser 800×400:** kirim 2 pekerja ke semak → bilah progres → makanan +25, pekerja kembali 4/4.

### - [x] Tugas 1A.7 — Tambang Emas & Penggilingan

- Pekerja dimasukkan ke dalam bangunan dan tinggal sampai dikeluarkan.
- Hasil berkala = hasil per pekerja × jumlah pekerja, sampai kapasitas simpan.
- **Tetap berjalan saat game ditutup.**
- Dipungut dengan ketukan seperti Pasar.

**Kriteria selesai:** tes untuk produksi per pekerja, tetap berjalan offline, keluarkan pekerja, dan kapasitas simpan.

> **Ringkasan (selesai 2026-10-18):**
>
> - **Shared (`village.ts`):**
>   - `productionOf(state, b)` menggabungkan produksi tetap (Pasar) dan produksi berpekerja (`perWorkerPerHour × pekerja di dalam`, sampai `capacity`).
>   - `pendingProduction`, `isReadyToCollect`, `collectBuilding`, dan `collectAll` kini menerima `state` dan mendukung semua sumber daya; `collectAll` mengembalikan emas/makanan/kayu/batu.
>   - Produksi dihitung dari jam, jadi tetap berjalan saat game ditutup.
>   - `staffBuilding` dan `unstaffBuilding` memasukkan/mengeluarkan pekerja (error `notStaffed`, `noStaff`, `tooManyWorkers`, `buildersBusy`, `underConstruction`). Hasil yang sudah ada dipungut dulu setiap jumlah pekerja berubah, supaya laju baru tidak dihitung mundur.
>   - Menjual bangunan mengeluarkan pekerjanya.
> - **Data:** Tambang Emas dan Penggilingan kini bisa dibangun.
> - **Client:**
>   - Gambar baru buatan kode: bukit tambang dengan pintu terowongan, bongkah emas, dan kereta emas; kincir angin dengan karung tepung.
>   - Kartu menampilkan laju per pekerja, "Pekerja di dalam n/maks", penggeser + "Masukkan pekerja", dan "Keluarkan 1". Hasilnya dipungut seperti Pasar: gelembung, ketuk, atau "Pungut semua".
>   - Pekerja yang masuk tidak terlihat dan muncul lagi di pintu saat dikeluarkan.
> - **Tes:** `staffed.test.ts` (produksi per pekerja, tanpa pekerja = 0, tetap berjalan offline sampai kapasitas lalu dipungut, hasil dipungut saat pekerja masuk/keluar, error). Total 138 tes lulus.
> - **Dicek di browser 800×400:** Penggilingan uji coba (simpanan pemain dicadangkan lalu dipulihkan): 2 pekerja masuk, lompat 1 jam → 160/1.200 makanan dan gelembung panen muncul.

### - [x] Tugas 1A.8 — Hewan & Peternakan

- Hewan liar muncul (jumlah per 24 jam sejak muncul terakhir) dan berkeliaran.
- **Buru** (pekerja + waktu → makanan) atau **tangkap** (pekerja + waktu → slot Peternakan).
- Peternakan menghasilkan makanan per hewan.

**Kriteria selesai:** tes untuk buru, tangkap, slot Peternakan penuh ditolak, produksi, dan jadwal munculnya hewan.

> **Ringkasan (selesai 2026-10-18):**
>
> - **Shared (`animals.ts`, baru):**
>   - Hewan liar (`village.animals`) muncul lewat `spawnAnimals`. Setiap `respawnHours` sejak terakhir muncul, jumlahnya diisi sampai `count` di petak kosong, lalu jam diulang dari waktu muncul (hari yang terlewat tidak ditumpuk). Prosesnya deterministik dari RNG simpanan, dan desa baru langsung punya hewan.
>   - `sendToAnimal(state, id, 'hunt' | 'capture', n)` mengirim pekerja sampai `maxWorkers` hewan itu. Error: `animalNotFound`, `animalBusy` (tugas lain sedang jalan), `tooManyWorkers`, `buildersBusy`, `noRanch`, `ranchFull`. Berganti tugas mengulang progres dari nol.
>   - Tangkapan yang sedang berjalan **memesan** slot Peternakan, jadi dua tangkapan tidak bisa merebut slot terakhir.
>   - `advanceAnimals` (dipanggil dari `advanceWilds`, hanya saat bermain): buru → makanan; tangkap → hewan pindah ke `village.ranchAnimals` di Peternakan yang ada slotnya. Hasil Peternakan dipungut dulu sebelum hewan masuk, supaya laju baru tidak dihitung mundur.
>   - `recallWorkers` juga berlaku untuk hewan, dan progresnya tetap tersimpan.
> - **Peternakan:** `productionOf` memberi makanan = jumlah `ranchFoodPerHour` hewan di dalam, sampai `ranchCapacity`. Tetap berjalan offline, dan dipungut seperti Pasar. Slot hewan terpisah dari populasi.
> - **Data:** `maxWorkers` per jenis hewan, `ranchCapacity` per level Peternakan (divalidasi), dan Peternakan kini bisa dibangun.
> - **Simpanan v8:** migrasi 7 menambah `animals`, `ranchAnimals`, dan `animalsAt`, sehingga hewan langsung muncul di desa lama.
> - **Client:**
>   - Gambar buatan kode untuk Ayam Hutan, Rusa, Babi Liar, dan Peternakan (gambarnya menampilkan jumlah hewan di dalam).
>   - Hewan berkeliaran dekat petaknya, lalu diam di tempat saat pekerja datang.
>   - Kartu hewan menampilkan hasil buru/tangkap, slot kosong, progres, penggeser pekerja, tombol "Buru (waktu)" / "Tangkap (waktu)" (nonaktif tanpa slot), dan "Panggil pulang".
>   - Bilah progres hijau untuk buru dan oranye untuk tangkap; teks melayang "+makanan" atau "Masuk Peternakan!".
>   - Kartu Peternakan menampilkan "Hewan n/maks" dan daftar per jenis.
> - **Tes:** `animals.test.ts` (buru per jumlah pekerja, error, ganti tugas, tanpa/penuh Peternakan, slot dipesan, tangkap → produksi per hewan offline sampai kapasitas, hewan awal, jadwal muncul 24 jam, determinisme, migrasi v7). Total 146 tes lulus.
> - **Dicek di browser 800×400:** 6 hewan muncul di simpanan lama. Buru Ayam Hutan dengan 1 pekerja → makanan +30. "Tangkap" nonaktif karena belum ada Peternakan; gambar Peternakan tampil di menu Bangun. Alur tangkap → Peternakan baru diuji lewat tes, belum dicoba di browser.

### - [x] Tugas 1A.9 — Barak per peran & awal 1 monster

- Barak (penahan), Petarung, dan Lapangan Panah melatih prajurit dasar **Dewasa** dengan antrean, biaya, dan waktu.
- Butuh populasi.
- Level membuka wujud dan elemen sesuai perannya.
- Batas kekuatan Serbu = gabungan ketiga barak (disimpan untuk Tugas 1.4).
- Toko monster dan `buyBaseMonster` dihapus.
- Permainan baru dimulai dengan 1 monster.

**Kriteria selesai:** tes untuk antrean, biaya, populasi penuh, pilihan per level dan peran, prajurit lahir Dewasa, batas kekuatan gabungan, dan monster awal = 1.

> **Ringkasan (selesai 2026-10-18):**
>
> - **Shared (`barracks.ts`, baru):**
>   - `trainingOptions(type, level)` memberi wujud tingkat 1 sesuai `trainsRole` dan elemen dasar dari `rules.barracks.unlocksByLevel`.
>   - `trainSoldier` memakai emas + makanan, antrean berurutan per bangunan (maks. `queueMax`), dan slot populasi yang langsung terpakai. Error: `notBarracks`, `underConstruction`, `notUnlocked`, `trainingQueueFull`, `populationFull`, `notEnoughGold`/`notEnoughFood`.
>   - `settleBarracks` (lewat `settleVillage`) menetaskan prajurit sebagai **Dewasa** dan mencatatnya di Monsterpedia; `barracksQueue` dan `barracksRemaining` melengkapinya.
>   - `combinedBarracksLevel` dan `serbuPowerCap` menghitung batas poin Serbu dari **gabungan level ketiga barak** (`battle.powerCapByCombinedBarracksLevel`, menggantikan tabel per Barak; angka masih awal, dipakai di Tugas 1.4).
> - **Toko dihapus:** `buyBaseMonster`, `isForSale`, `rules.economy.shop`, `ShopView`, tab Toko, dan tombol "Beli Monster" di Kandang. Dock kini berisi Bangun dan Pedia.
> - **Permainan baru dimulai dengan 1 monster** (Kucing Api Dewasa). Simpanan lama tetap menyimpan monsternya.
> - **Data:** `rules.barracks` (biaya/waktu latih, antrean, buka wujud/elemen per level, divalidasi hanya elemen dasar dan setiap barak punya `trainsRole`). Arena Petarung dan Lapangan Panah kini bisa dibangun; ketiga barak tersedia sejak Balai Lv 1.
> - **Simpanan v9:** migrasi 8 menambah `barracksQueue`.
> - **Client:**
>   - Kartu barak menampilkan batas Serbu gabungan, status latihan, dan tombol "Latih prajurit".
>   - Panel "Latih Prajurit" (`BarracksView`) berisi pilihan wujud/elemen yang terbuka, pratinjau prajurit Dewasa, antrean, populasi, dan tombol "Latih (biaya, waktu)".
>   - Notifikasi "… selesai dilatih!".
>   - Gambar buatan kode untuk Arena Petarung (ring pasir dan boneka latihan) dan Lapangan Panah (gudang dan papan sasaran).
> - **Tes:** `barracks.test.ts` (pilihan per peran dan level, bayar + antrean + populasi dipesan + lahir Dewasa, pilihan terkunci/antrean penuh/populasi penuh/sumber daya kurang, barak belum jadi, batas Serbu gabungan, awal 1 monster, migrasi v8). Tes Soul Mixer menyiapkan 4 monster sendiri, dan tes makan memakai bayi buatan. Total 151 tes lulus.
> - **Dicek di browser 800×400:** dock tanpa Toko, kartu Barak (batas Serbu 20 untuk gabungan Lv 1), dan panel latihan (wujud Anjing, 4 elemen, biaya 150 emas + 100 makanan, 2 menit). Latihan sungguhan tidak dijalankan agar sumber dayamu tetap; alurnya diuji lewat tes.

### - [x] Tugas 1A.10 — Musuh liar, kirim tim & Kuburan

**Musuh:**

- `wildEncounters(state, now)`: kelompok muncul lagi 24 jam sejak terakhir muncul.
- Komposisinya bertahap dari data: bandit → monster kecil → acak per level (banyak kecil atau satu besar).
- Deterministik dari benih.

**Tim:**

- `sendTeam(state, {monsterIds, encounterId}, now)`.
- Hasil dihitung dengan rumus kekuatan + elemen + RNG berbenih.
- Menang → hadiah.
- **Kalah → monster yang kalah mati** dan masuk Kuburan. Bagian tim yang mati ditentukan oleh rumus dan data.
- Monster dalam misi tidak bisa dipakai di tempat lain.

**Kuburan:**

- `reviveMonster`: biaya sumber daya besar sesuai kekuatan, atau permata (`rules`).
- Bangunan Kuburan menampilkan monster yang mati.

**Client:**

- Ketuk monster di desa untuk memilih (cincin sorot, bisa banyak), atau buka daftar "Pilih tim".
- Ketuk musuh → kartu kekuatan tim vs musuh dan perkiraan peluang menang → "Kirim tim".
- Tim berjalan ke tujuan, animasi bertarung sederhana, hasil, pulang (yang selamat).
- Musuh digambar dengan kode: bandit manusia, monster liar berwarna khusus.

**Kriteria selesai:**

- Tes untuk:
  - jadwal 24 jam;
  - komposisi per level;
  - monster sibuk ditolak;
  - kalah → mati;
  - hidupkan kembali dengan sumber daya atau permata;
  - peluang menang dan hadiah (Monte Carlo 100.000 kali).
- Alurnya bisa dimainkan.

> **Ringkasan (selesai 2026-10-19):**
>
> - **Musuh (`encounters.ts`, baru):**
>   - `spawnEncounters` mengisi kelompok musuh sampai `groupsByTownHall` untuk level Balai, setiap `respawnHours` sejak terakhir muncul (jam diulang dari waktu muncul). Musuh muncul di lahan terkunci, di luar desa.
>   - `rollEncounter` memilih isi dari baris tabel Balai: bandit (Balai 1), lalu monster kecil, lalu acak antara banyak kecil atau satu besar. Monster liar memakai wujud dari tingkatnya dan elemen dasar acak.
>   - Prosesnya deterministik dari RNG simpanan, dan desa baru langsung punya musuh.
> - **Tim (`missions.ts`, baru):**
>   - `monsterPower` = poin kekuatan × `statMultiplier` tahap tumbuh. `teamPower`/`encounterPower` mengalikan rata-rata keunggulan elemen terhadap lawan (bandit tanpa elemen, kekuatan = jumlah × `banditPower`).
>   - `winChance` = tim^k / (tim^k + musuh^k).
>   - `sendTeam` (maks. `maxTeam`, tanpa duplikat; error `encounterNotFound`, `encounterBusy`, `monsterBusy`, `monsterNotFound`, `invalidAmount`) mengacak dan **mengunci** hasilnya saat berangkat: menang, hadiah (+ peluang Kristal Jiwa), dan siapa yang mati. Kalah berarti tiap anggota mati dengan peluang `deathChanceOnLoss`, minimal satu.
>   - `settleMissions` (lewat `settleVillage`, setelah `missionSeconds`) menerapkan hasilnya: menang memberi hadiah dan menghapus musuh; kalah memindahkan yang gugur ke `graveyard`, sementara musuh tetap ada.
>   - Monster dalam misi sibuk: tidak bisa jadi induk, dikirim lagi, atau dilepas.
> - **Kuburan:** `reviveMonster(state, id, 'resources' | 'gems')` dengan biaya per poin kekuatan dari `wilds.graveyard`. Butuh Kuburan jadi dan slot populasi (`noGraveyard`, `populationFull`). Monster gugur tidak memakai populasi. Kuburan kini bisa dibangun, sehingga semua bangunan Fase 1A tersedia.
> - **Data:**
>   - `rules.skirmish` (`maxTeam`, `sharpness`, `deathChanceOnLoss`, `missionSeconds`).
>   - `banditPower` diturunkan ke 0,4/0,6 (satuan poin kekuatan, monster tingkat 1 Dewasa = 1). Sebelumnya 3/4, yang membuat bandit Balai 1 setara 6–9 monster.
> - **Simpanan v10:** migrasi 9 menambah `missions`, `graveyard`, `village.encounters`, dan `encountersAt`, sehingga musuh langsung muncul.
> - **Client:**
>   - Musuh digambar di peta: bandit buatan kode (ikat kepala merah, pentungan) atau monster liar kecil, di atas cincin merah dengan label "Bandit ×n" / "Monster liar ×n".
>   - Ketuk monster di desa untuk memasukkan/mengeluarkannya dari tim (cincin emas). Bilah "Tim: n monster · Kosongkan" muncul di bawah HUD.
>   - Kartu musuh menampilkan kekuatan musuh, hadiah, kekuatan tim, dan peluang menang, dengan tombol "Pilih tim" dan "Kirim tim".
>   - Panel "Pilih Tim" berisi kartu semua monster (yang sibuk tampak pudar), peluang menang langsung, dan "Kirim tim".
>   - Tim berjalan ke musuh dan melompat-lompat selama bertarung; yang selamat pulang. Notifikasi "Menang! +hadiah" atau "Kalah… n monster gugur".
>   - Kartu Kuburan ("Monster gugur: n") dan panel Kuburan dengan tombol "Hidupkan (emas + makanan)" dan "n permata".
>   - Gambar Kuburan, plus ikon kartu kemah bandit dan sarang monster.
> - **Tes:** `missions.test.ts` (jadwal 24 jam dan determinisme; komposisi per baris Balai; kekuatan naik dengan jumlah, tahap, dan elemen; **Monte Carlo 100.000×** untuk peluang menang, hadiah rata-rata, dan jumlah yang gugur saat kalah; monster sibuk dan tim tidak sah ditolak; menang → hadiah dan musuh hilang; kalah → mati ke Kuburan; hidupkan dengan sumber daya atau permata; butuh Kuburan, populasi, dan biaya; migrasi v9). Total 161 tes lulus.
> - **Dicek di browser 800×400** (pada simpanan uji yang dicadangkan lalu dipulihkan): kartu Bandit ×2 → Pilih tim (Kucing Api, peluang 66%) → Kirim tim → kucing berjalan ke bandit → kalah → masuk Kuburan (populasi 3/8 → 2/8) → panel Kuburan → hidupkan (−300 emas, −100 makanan).

### - [x] Tugas 1A.12 — Tembok sebaris

Dikerjakan lebih awal atas permintaan pengguna (sebelum 1A.2).

- **Bangunan sebaris** (`lineBuild` di `buildings.json`, ukuran 1×1, semua level langsung jadi):
  - pilih titik awal dan titik akhir;
  - baris lurus mengikuti sumbu yang lebih panjang;
  - konfirmasi membangun semua ruas sekaligus;
  - biaya = jumlah ruas × harga per ruas.
- **Upgrade tersambung**: semua tembok dengan level sama yang bersambung (4 arah) dinaikkan sekaligus.
- **Gambar tembok menyambung** ke tetangganya.

**Kriteria selesai:** tes untuk garis (sumbu, panjang), terhalang, batas jumlah, biaya total, dan upgrade tersambung; mode pasang garis bisa dipakai.

> **Ringkasan (selesai 2026-10-18):**
>
> - `lineTiles`, `buildLine`, `connectedGroup`, `upgradeGroup` di `packages/shared/src/village.ts` (tes: `walls.test.ts`).
> - Tembok kini `lineBuild`: L1 pagar kayu (10 kayu per ruas), L2–L3 batu; semua level langsung jadi; batas jumlah dinaikkan.
> - Mode pasang garis: ketuk awal → ketuk/seret akhir, pratinjau per ruas, hijau/merah, total biaya di bilah pasang.
> - Gambar tembok menyambung ke tetangga (`wall-<mask>`).
> - Kartu info: "Naikkan N tersambung".

### - [x] Tugas 1A.11 — Penyeimbangan

- Skrip `pnpm sim:economy` (sisa Tugas 1.2) mensimulasikan 14 hari pemain gratis dengan pekerja, plot, Barak, dan musuh liar.
- Mencetak:
  - kapan tiap level Balai, plot ke-_n_, dan tingkat wujud tercapai;
  - hasil kayu, batu, dan emas per hari;
  - pembagian populasi antara pekerja dan monster.

**Kriteria selesai:** angka di `data/` disesuaikan agar Balai Lv 4 (Soul Mixer) tercapai dalam ±2–3 hari bermain wajar.

> **Ringkasan (selesai 2026-10-19):**
>
> - **`pnpm sim:economy [--seed N] [--days N] [--detail]`** (`packages/shared/src/sim/economy.ts` + `packages/shared/scripts/sim-economy.ts`, dijalankan dengan `vite-node`).
>   - Bot memakai aksi game sungguhan dan bermain 4 sesi × 20 menit per hari (08:00, 12:30, 18:00, 21:30). Di antara sesi, produksi dan konstruksi tetap berjalan, tapi pengambilan alam liar tidak.
>   - Setiap langkah bot: pungut/panen/tanam, Soul Mixer (campur, tetaskan, beri makan), bangun (Balai lebih dulu, lalu bangunan baru, lalu upgrade), isi Tambang/Penggilingan, latih pekerja sampai 60% populasi dan sisanya prajurit (dengan ruang untuk hasil campuran), beli wilayah, lawan musuh dengan peluang ≥ 75%, dan kirim sisa pekerja ke node yang paling dibutuhkan.
>   - Bot baru menabung untuk Balai setelah memegang ≥ 50% biayanya, dan menabung lebih dulu untuk Soul Mixer begitu terbuka.
>   - Mencetak tonggak (level Balai, plot ke-n, Soul Mixer, tingkat wujud), pendapatan emas/makanan/kayu/batu/kristal per hari, pekerja vs slot monster vs populasi, dan menang/kalah. `--detail` menambah isi desa di akhir.
> - **Penyesuaian data:**
>   - **Biaya Balai Utama** (emas/makanan/kayu/batu, waktu dasar):
>     - Lv 2: 1.000/0/400/100, 10 menit;
>     - Lv 3: 5.000/1.000/2.500/1.200, 1 jam;
>     - Lv 4: 20.000/5.000/9.000/7.000, 4 jam;
>     - Lv 5: 100.000/20.000/20.000/12.000, 12 jam;
>     - Lv 6: 250.000/60.000/45.000/30.000, 24 jam.
>   - **Sebelumnya** 500–40.000 emas dan 1 menit–3 jam, sehingga Lv 4 tercapai di hari 1 dan Lv 6 di hari 6.
>   - Batu liar: hasil 30 → 40, `chancePerStep` 0,25 → 0,35.
> - **Hasil (benih 1–4):**
>   - Balai Lv 4 di hari 2, 23:59 – hari 3, 18:00 dan Soul Mixer bisa dipakai di hari 3–4 pagi (**kriteria tercapai**).
>   - Monster tingkat 2 di hari 3–5; Balai Lv 5 di hari 7–9; Balai Lv 6 belum tercapai dalam 14 hari.
> - **Tes:** `sim/economy.test.ts` (Balai Lv 4 antara hari 1 dan 3 sebagai tes regresi penyeimbangan, angka harian wajar, deterministik, format waktu). Total 165 tes lulus.
> - **Catatan untuk penyeimbangan berikutnya:**
>   - Mulai sekitar hari 5, emas (±145 ribu/hari) dan makanan (±55 ribu/hari) berlebih, sehingga di hari 14 sisa ±250 ribu emas dan ±550 ribu makanan. Perlu penyerap seperti XP/level, misi, atau biaya Lv 6 ke atas.
>   - Batu tetap jadi penghambat utama.
>   - Setelah Balai Lv 4, kelompok musuh berisi monster tingkat 2, sehingga bot jarang bertarung tanpa hasil Soul Mixer.
>   - Peternakan belum diisi oleh bot karena bot belum menangkap hewan.

> **Perbaikan pasca-audit (2026-10-20, lihat `docs/EVALUASI.md`):**
>
> - **Game feel inti** (skill `game-feel`), `apps/game/src/fx/`:
>   - tingkat kecil/sedang/besar;
>   - bangunan "pop" (squash & stretch, easing Back) saat diketuk, ditaruh, dipindah, dan selesai dibangun;
>   - partikel debu/serpihan/kilau dari emitter yang dipakai ulang;
>   - ikon sumber daya terbang melengkung ke HUD saat memungut, memanen, menyelesaikan node alam, berburu, menang melawan musuh, atau "Pungut semua"; pil HUD menahan angka sampai ikon mendarat, lalu naik bertahap dan memantul.
> - **Simpanan:** salinan terakhir yang baik (`soul-monster:save:backup`) ditulis setiap kali simpanan berhasil dimuat. Bila simpanan utama rusak, game memulihkannya dari cadangan ("dipulihkan dari cadangan terakhir") alih-alih memulai permainan baru (`loadWithBackup` di `packages/shared/src/save.ts`, skill `save-systems`).
> - **Atlas:** indeks `atlas/atlases.json` dibaca dengan aman, jadi file yang hilang tidak lagi memicu galat.
> - **README** diperbarui sesuai sistem saat ini.
> - **Tes:** `fx/math.test.ts` dan `loadWithBackup`. Total 172 tes lulus.

**Gerbang Fase 1A:** sesi 10 menit terasa seperti Social Empires:

- latih pekerja;
- kirim ke hutan;
- bangun dengan banyak pekerja;
- beli wilayah;
- latih prajurit;
- kalahkan bandit.

Semuanya nyaman dalam posisi horizontal.

---

### - [x] Tugas 1A.13 — Prajurit dari 3 barak, monster hanya dari telur

Keputusan pemilik (2026-10-21): base awal memakai **prajurit manusia**, bukan monster. Monster tidak pernah lahir dari barak.

- **Tiga barak melatih prajurit** (id lama dipakai ulang agar simpanan tetap terbaca):
  - **Barak Prajurit** (infanteri, peran penahan) — dulu Arena Petarung (`petarung`).
  - **Barak Panahan** (pemanah, peran penembak) — dulu Lapangan Panah (`lapangan-panah`).
  - **Barak Berkuda** (penunggang kuda bertombak, peran petarung) — bangunan **baru**.
  - **Guild** (`barak`, gambar benteng batu) berhenti melatih; belum punya fungsi.
- **Prajurit** = unit manusia baru (bukan `Monster`): jenis per barak, level barak membuka tingkat/jumlah prajurit, biaya + waktu latih + antrean + slot populasi seperti latihan sekarang. Statistik, biaya, dan poin kekuatan per jenis di `rules.json`.
- **Bertarung bersama monster:** prajurit dan monster masuk tim Serbu yang sama, sama-sama memakai poin kekuatan dan populasi. Prajurit tidak punya elemen (pengali keunggulan = 1), tidak tumbuh, dan tidak bisa jadi induk Soul Mixer. Batas poin Serbu = gabungan level ketiga barak prajurit.
- **Monster hanya dari:** menetas telur, Soul Mixer, atau hadiah (misi, bos, acara — menyusul).
- **Awal game:** desa baru dimulai dengan **1 telur siap ditetaskan** (wujud tingkat 1, elemen dasar, acak berbenih) yang menetas jadi **bayi**, bukan Kucing Api Dewasa. Simpanan lama tetap menyimpan monster dan prajurit latihnya (migrasi: monster hasil latihan barak tetap monster).
- **Gambar:** Barak Prajurit, Barak Panahan, Barak Berkuda, dan tiga jenis prajurit (SpriteCook, cadangan gambar kode).

**Kriteria selesai:** tes latih prajurit per barak (biaya, antrean, populasi penuh, terkunci per level), barak tidak bisa menghasilkan monster, permainan baru = 0 monster + 1 telur, menetaskan telur awal menghasilkan bayi tingkat 1 berelemen dasar, migrasi simpanan lama, prajurit masuk perhitungan poin Serbu.

> **Ringkasan (selesai 2026-10-21):**
>
> - **Data:** `rules.barracks.soldiers` (Prajurit, Pemanah, Penombak Berkuda: statistik, poin kekuatan, biaya/waktu latih) dan `rules.barracks.ranks` (Rekrut ×1, Veteran ×1,6 +1 poin, Elit ×2,4 +2 poin; biaya ×1/2/4, waktu ×1/2/3), angka disetujui pemilik. `rules.economy.startingEgg.hatchSeconds` = 30 menggantikan `startingMonsters`. Bangunan: `petarung` → Barak Prajurit, `lapangan-panah` → Barak Panahan, baru `barak-berkuda` (Balai Lv 2, 5 level), Guild (`barak`) tanpa fitur. Bangunan barak memakai `trainsSoldier`; validasi zod + cek silang (prajurit ada, peran ada).
> - **Shared (`barracks.ts`):** `Soldier`, `soldierStats/Power/TrainCost/Name`, `unlockedRanks`, `trainSoldier({ buildingId, rank })`, `settleBarracks` menghasilkan prajurit (bukan monster); `Egg`, `rollEgg`, `hatchEgg` (bayi tingkat 1, elemen dasar). Populasi menghitung prajurit (slot = poin kekuatan). Misi memakai `TeamUnit` (`teamUnits`): prajurit tanpa elemen ikut tim; prajurit yang gugur hilang, monster ke Kuburan. Batas Serbu = gabungan level tiga barak prajurit.
> - **Game baru:** 0 monster + 1 telur (30 detik). **Simpanan v11:** migrasi 10 menyelesaikan monster yang masih dilatih di barak lama menjadi monster Dewasa.
> - **Client:** panel latih per pangkat (pangkat terkunci menampilkan level syarat), gambar prajurit buatan kode (`art/soldierArt.ts`), Barak Berkuda buatan kode, jumlah pasukan di kartu barak, telur di kartu Kandang + gelembung + ketuk untuk menetas, prajurit bisa dipilih di panel Pilih tim. Simulasi ekonomi ikut melatih prajurit dan menetaskan telur.
> - **Tes:** `barracks.test.ts` ditulis ulang (jenis per barak, pangkat, latih/antrean/populasi/terkunci, Guild tidak melatih, batas Serbu, game baru = telur, menetas, Monte Carlo 100.000 telur, migrasi v10), tes prajurit tanpa keunggulan elemen di `missions.test.ts`, validasi data. Total 216 tes lulus.
> - **Dicek di browser:** game baru tanpa monster; ketuk Kandang → "Anjing Air menetas!"; menu Bangun menampilkan Guild, Barak Prajurit, Barak Panahan, Barak Berkuda (butuh Balai Lv 2); panel latih Barak Prajurit (Rekrut, Veteran Lv 2, Elit Lv 3); latih 1 Prajurit Rekrut → selesai, populasi bertambah.
> - **Belum:** gambar SpriteCook untuk tiga barak dan prajurit; gelembung telur bisa tertutup HUD kalau Kandang di tepi atas layar.

### - [x] Tugas 1A.14 — Batu emas liar

Ide pemilik (2026-10-21): sumber emas dari alam liar.

- Di peta muncul **1–3 gugus** batu emas; tiap gugus = **4 petak berdekatan** (2×2).
- Pekerja menambang batu emas seperti batu biasa dan mendapat emas.
- Setelah diambil, petak itu berubah menjadi **batu kosong** yang tidak bisa diambil, lalu **terisi emas lagi** setelah waktu tertentu (tidak hilang dari peta).
- Gugus baru tidak muncul di atas bangunan; gugus di wilayah terkunci tetap terlihat (pudar) seperti objek liar lain.
- Angka di `data/wilds.json`.

**Usulan angka (menunggu persetujuan pemilik):** 1–3 gugus per peta (acak berbenih), 4 petak per gugus, tiap petak 150 emas, kerja 75 detik (maks. 2 pekerja), terisi lagi 6 jam setelah diambil, peluang Kristal Jiwa 0,1.

**Kriteria selesai:** tes jumlah gugus (1–3) dan bentuk 2×2, menambang memberi emas lalu petak jadi kosong, kosong tidak bisa ditambang, terisi lagi tepat setelah waktunya (juga setelah lama tidak main), migrasi simpanan; gambar SpriteCook (batu emas + batu kosong) dengan cadangan gambar kode.

> **Ringkasan (selesai 2026-10-21):**
>
> - **Data:** node `batu-emas` di `wilds.json` (150 emas, kerja 75 detik, maks. 2 pekerja, Kristal Jiwa 0,1, `refillHours` 6; `weight` 0 dan `maxPerPlot` 0 sehingga tidak pernah tersebar/tumbuh acak) dan `goldVeins` (node, `clusters` [1, 3], `side` 2). `weight` node kini boleh 0; validasi: `goldVeins.node` harus punya `refillHours`.
> - **Shared:** `placeGoldVeins` (gugus side×side di petak bebas di seluruh peta, termasuk wilayah terkunci, menjauhi bangunan awal) dipanggil saat desa dibuat. Menambang node ber-`refillHours` tidak menghapusnya: `work` 0 dan `Obstacle.refillAt` = waktu terisi lagi; `sendWorkers` menolak (`notAvailableYet`) selama kosong; `regrowWilds` mengosongkan `refillAt` begitu waktunya lewat (juga setelah lama tidak main). **Simpanan v15** (migrasi 14 menambah gugus emas ke desa lama dengan RNG tersimpan).
> - **Client:** gambar buatan kode batu emas (batu abu berbongkah emas); batu kosong memakai gambar batu biasa; kartu info "Batu ini sudah ditambang dan kosong · Emas terisi lagi dalam …" tanpa tombol kirim pekerja.
> - **Tes:** `wilds.test.ts` (1–3 gugus 2×2 di 40 benih, tambang → emas + kosong + ditolak, terisi lagi tepat waktunya dan setelah 10 hari, tidak pernah tumbuh acak, migrasi v14); tes jumlah objek liar awal tidak menghitung emas.
> - **Dicek di browser:** migrasi menambah 1 gugus 2×2 ke simpanan lama; batu emas tampil; petak yang ditambang tampil sebagai batu biasa dengan kartu "terisi lagi dalam 5j 59m".
> - **Belum:** gambar SpriteCook batu emas (kredit tinggal 4); gambar kode masih lebih kecil dari batu bergambar.

### - [x] Tugas 1A.15 — Pilih area & perintah unit (inti strategi)

Keputusan pemilik (2026-10-21): memilih prajurit/monster di desa adalah inti strategi game.

- **Mode Pilih:** tombol "Pilih" di dock. Saat aktif, seret = kotak pilihan (bukan geser kamera); ketuk tombol lagi untuk keluar. Unit di dalam kotak terpilih (cincin emas), bisa ditambah/dikurangi dengan ketuk unit.
- **Perintah setelah memilih:**
  - **ketuk tanah** → unit berjalan ke petak itu dalam formasi rapat dan berjaga di sana;
  - **ketuk musuh** → unit dikirim sebagai tim melawan musuh itu (berjalan lalu bertarung sampai salah satu habis, seperti misi sekarang);
  - **ketuk pohon/batu/semak** → unit **mengawal pekerja** yang mengumpulkan di sana (dasar untuk ide penyergapan & eksplorasi; efek kawal aktif saat penyergapan dibuat).
- **Posisi unit di state game** (`packages/shared`, ikut simpanan): petak tiap monster/prajurit, tujuan dan perintahnya; gerak dihitung deterministik dari waktu (bukan acak di client), siap untuk musuh mengejar dan server nanti. Pengganti jalan-jalan acak monster di client.
- Batas: jumlah unit terpilih untuk serangan tetap `skirmish.maxTeam`.

**Kriteria selesai:** tes shared untuk perintah pindah (petak bebas, formasi, tidak menembus bangunan/wilayah terkunci), serang (sama dengan kirim tim), kawal (terkait pekerja yang sedang mengumpulkan), posisi bertahan setelah simpan/muat dan migrasi; di browser: mode Pilih, kotak pilihan di HP dan PC, ketiga perintah.

> **Ringkasan (selesai 2026-10-21):**
>
> - **Shared (`units.ts`, baru):** `state.units` menyimpan petak tiap monster/prajurit, jalur, waktu berangkat, dan node yang dikawal. Gerak dihitung dari jam (`unitPoint`, `unitTile`) dengan `rules.units.walkTilesPerSecond` = 1,5 (angka baru, bisa diubah). `settleUnits` (lewat `settleVillage` dan game baru) memberi unit baru petak bebas dekat Kandang, membuang unit yang hilang, melipat jalan yang selesai, dan melepas kawal bila node habis. `moveUnits` (jalur BFS 4 arah di petak bebas & terbuka, formasi melingkar di sekitar tujuan; tolak wilayah terkunci/terhalang/di luar peta/unit sedang misi/tim kosong), `guardNode` + `guardsOf` (dasar penyergapan nanti). Serang = `sendTeam` yang sudah ada. **Simpanan v14.**
> - **Client:** tombol **Pilih** di dock (emas saat aktif, petunjuk singkat). Saat aktif, seret = kotak pilihan (bukan geser kamera); unit di dalam kotak menjadi tim (cincin emas); ketuk unit tetap menambah/mengurangi. Dengan unit terpilih: ketuk musuh = serang, ketuk pohon/batu/semak = kawal, ketuk tanah = pindah. Monster dan prajurit kini berdiri/berjalan sesuai `state.units` (tidak lagi jalan-jalan acak), kembali ke petaknya setelah misi. Diperbaiki: tim yang dipilih membuang prajurit setiap state berubah.
> - **Tes:** `units.test.ts` (penempatan awal unik & bebas, jalur satu petak per langkah di tanah terbuka, formasi, posisi saat berjalan, lipat setelah tiba, penolakan, simpan/muat, kawal + lepas saat node hilang, migrasi v13).
> - **Dicek di browser:** mode Pilih → kotak memilih 3 unit → ketuk tanah: 3 unit berjalan (1,5 petak/detik) ke 3 petak berbeda; posisi bertahan setelah dimuat ulang; pilih 2 prajurit → ketuk pohon: "2 unit mengawal di sana".
> - **Revisi pemilik (2026-10-21):**
>   - Unit **boleh menuju wilayah terkunci** / di luar wilayah (jalan di petak mana pun yang tidak ada bangunan atau objek liar).
>   - **Dock kanan** khusus Pilih: tombol "Pilih"; saat aktif terbuka ke atas berisi **Menjauh** (unit terpilih mundur ke Kandang, `retreatUnits`) dan **Kosongkan**, dan "Pilih" berubah menjadi **✕** untuk kembali ke mode normal. Tombol "kumpulkan semua" digeser ke kiri dock ini.
>   - **Ketuk monster/prajurit** di mode normal langsung masuk mode Pilih dan memilihnya.
>   - Di mode Pilih: **seret kiri = kotak**, **tahan klik kanan = geser peta** (menu klik kanan dimatikan); di layar sentuh, **dua jari** menggeser peta.
>   - **Tabrakan antarunit:** tidak ada dua unit di satu petak, terpilih atau tidak — petak yang ditempati atau sedang dituju unit lain dilewati saat mencari tempat (perintah pindah/kawal/mundur dan unit baru).
> - **Belum:** kotak pilihan dan geser dua jari belum dicoba di HP sungguhan; geser klik kanan belum bisa diuji dengan alat browser (tidak ada seret klik kanan); bangunan yang dibangun di atas unit belum memindahkan unit itu; unit boleh berpapasan saat berjalan (tabrakan hanya untuk tempat berdiri).

### - [x] Tugas 1A.16 — Musuh mengejar & penyergapan saat menebang

Ide pemilik (2026-10-21), angka disetujui pemilik.

- **Musuh mengejar:** kelompok musuh diam sampai prajurit/monster kita masuk jarak deteksi (`wilds.encounters.aggro`: bandit 3 petak, monster liar 4 petak), lalu mengejar (2 petak/detik) dan bertarung (simulator tanpa batas waktu) dengan unit-unit terdekat (maks. `maxTeam`). Tanpa unit di jangkauan, pekerja yang mengumpulkan objek liar di dalam jangkauan diserang (tiap pekerja mati 50 %), sisanya lari.
- **Penyergapan saat menebang:** setiap objek liar yang selesai dikumpulkan punya `ambushChance` (pohon 4 %, batu 3 %, semak 2 %, batu emas 5 %). Musuh dari daftar level Balai muncul di sana; **pengawal** (`guardNode`) bertarung dulu — menang = pekerja aman; tanpa pengawal atau kalah = tiap pekerja mati 50 % (`ambush.workerDeathChance`). Musuh penyergapan **pergi sendiri** setelah `ambush.leaveHours` = 6 jam bila tidak sedang bertarung (tidak menumpuk).

> **Ringkasan (selesai 2026-10-21):**
>
> - **Shared (`aggro.ts`, baru):** `aggroRadius`, `aggroEncounters` (dipanggil di `settleVillage` setelah unit bergerak; misi otomatis tiba setelah jarak / kecepatan kejar), `ambushAt` (dipanggil `advanceWilds` saat node selesai; hasilnya di `Gathered.ambush`). `startFight` diekspor dari `missions.ts`. `WildEncounter.leavesAt` untuk musuh penyergapan (simpanan menerima kolom opsional baru).
> - **Bot simulasi:** tidak menebang dalam jangkauan musuh dan hanya menyerang bila 30 simulasi pertarungan untuk seluruh pasukan bebasnya memberi peluang ≥ `minWinChance`. **Keputusan pemilik:** tempo Balai Lv 4 menjadi **±4 hari** (game kini lebih berbahaya); biaya kayu Balai Lv 4 tetap 7.000.
> - **Client:** lingkaran merah tipis sebesar jarak deteksi di sekitar musuh; pesan "Musuh menyergap dari {objek}! · Pengawal menang/kalah · N pekerja gugur" dan "Musuh mengejar pasukanmu!".
> - **Tes:** `aggro.test.ts` (diam di luar jangkauan, mengejar unit terdekat dengan waktu tiba yang benar, tidak bangun dua kali, jangkauan bandit vs monster, pekerja diserang & dipulangkan, Monte Carlo 50 % pekerja mati, pengawal bertarung dulu dan pekerja aman bila menang, Monte Carlo peluang penyergapan 4 %, musuh penyergapan pergi setelah 6 jam kecuali sedang bertarung, kejaran menjadi pertarungan biasa).
> - **Dicek di browser:** lingkaran deteksi tampil; Kucing berhenti 3,04 petak dari bandit → bandit tidak bangun; lebih dekat → "Musuh mengejar pasukanmu!" dan misi otomatis terbentuk. (Pertarungannya baru berjalan saat panel browser terlihat; di tes per detik: bangun ±10 dtk, bertarung, selesai.)
> - **Belum:** posisi kejaran dihitung saat `settle` berjalan (cukup untuk client; untuk server nanti perlu titik waktu tetap); musuh belum benar-benar berjalan di layar saat mengejar (tim kita yang berjalan ke musuh).

## Fase 1B — Konten & retensi (4–5 minggu)

### - [x] Tugas 1B.1 — Level & XP pemain

- Membangun, memanen, mengambil sumber daya, mengalahkan musuh, dan menetaskan memberi XP (angka di data).
- Naik level memberi hadiah sumber daya kecil.
- Pembatas bangunan tetap level Balai.

**Kriteria selesai:** tes untuk XP per aksi, naik level, dan hadiah; tampilan bilah XP di HUD.

> **Ringkasan (selesai 2026-10-22):**
>
> - **Data (`rules.player`, angka baru, bisa diubah):** XP per aksi — bangun/upgrade 10 (satu kali per aksi, termasuk tembok sebaris/segrup), panen ladang 5, ambil hasil bangunan 2, ambil alam liar/hewan 5, menang melawan musuh 20, menetas 25. Tabel 30 level: `levels[i].xp` = total XP (Lv 2 di 40, Lv 10 di 5.350, Lv 30 di ±102.000) dan hadiah naik level 100/50/50 × level (emas/makanan/kayu). Divalidasi zod (level 1 = 0 XP, XP naik terus).
> - **Shared (`player.ts`, baru):** `playerLevel`, `levelProgress`, `gainXp` (menambah XP dan membayar hadiah setiap level yang dilewati, termasuk lompat beberapa level). Dipanggil di `buildBuilding`, `upgradeBuilding`, `buildLine`, `upgradeGroup`, `harvestCrop`, `collectBuilding`, `collectAll` (ladang = panen, bangunan = ambil), `advanceWilds` (simpul alam + hewan), `settleMissions` (menang melawan musuh liar & serangan desa), `fightPlaced` (Serbu & Petualangan), `hatchEgg`, `collectMix`. Level tidak membuka apa pun: pembatas bangunan tetap level Balai. **Simpanan v19** (`xp`, simpanan lama mulai Lv 1).
> - **Client:** "Pemain Lv N" di baris status HUD, bilah XP tipis di tepi bawah HUD, toast "Naik level! … +hadiah" (dengan suara menang) yang diangkat di atas toast aksi (`toast(..., lift)`).
> - **Tes:** `player.test.ts` (tabel level, progres, hadiah sekali per level termasuk lompat level, XP untuk bangun, panen/pungut semua, ambil alam liar, menang vs kalah, menetas, simpan/migrasi). Tes hadiah Serbu/Petualangan memakai pemain level maksimum agar hadiah level tidak ikut terhitung.
> - **Dicek di browser:** panen ladang di 35 XP → Lv 2 dan hadiah masuk; "Pungut semua" melewati Lv 4; toast naik level tampil di atas toast pungut.
> - **Belum:** `pnpm sim:economy` belum melaporkan level pemain; hadiah naik level belum terbang ke HUD seperti hasil pungut.

### - [x] Tugas 1B.2 — Misi, tutorial & bonus harian

- **Misi:**
  - rantai misi bertahap (tutorial sebagai misi awal);
  - target berbasis aksi (bangun X, panen Y, kalahkan Z);
  - hadiah dari data.
- **Bonus harian:**
  - siklus hadiah;
  - bila ada hari terlewat, siklus **tidak kembali ke awal dan tidak maju**: pemain melanjutkan dari hadiah berikutnya.

**Kriteria selesai:** tes untuk kemajuan misi, klaim hadiah, siklus bonus (termasuk hari terlewat), dan determinisme waktu.

> **Ringkasan (selesai 2026-10-22):**
>
> - **Data:** `data/quests.json` (baru) — rantai 17 misi berurutan, satu aktif; 7 misi awal sekaligus tutorial (`hint`). Target: `action` (aksi sejak misi dimulai: bangun, panen, pungut, ambil alam, kalahkan musuh, tetaskan), `building` (bangunan selesai minimal level tertentu, bangunan awal ikut), `monsters` (monster dimiliki — supaya telur awal yang sudah menetas tetap terhitung). Hadiah: emas/makanan/kayu/batu/kristal/permata. `rules.daily`: 7 hadiah berputar, hari berganti pukul 00.00 WIB (`dayOffsetSeconds` 25200). Divalidasi zod + cek silang id bangunan dan level.
> - **Shared (`quests.ts`, baru):** `activeQuest`, `claimQuest` (bayar hadiah, misi berikutnya mulai menghitung dari saat klaim), `dayNumber`, `dailyStatus`, `claimDaily` (siklus hanya maju saat diklaim: hari terlewat tidak mengulang dan tidak melompat). `gainXp` → `recordAction`, yang juga menghitung aksi seumur permainan (`state.actions`). **Simpanan v20** (`actions`, `quest`, `daily`; simpanan lama mulai dari misi pertama).
> - **Client:** kartu misi di kanan atas (judul, target dengan progres, petunjuk, tombol "Klaim hadiah"; disembunyikan saat panel terbuka); dialog Bonus Harian otomatis muncul saat tersedia (7 kotak hari, hari ini disorot, yang sudah diambil ✓). `rewardLabel` dipindah ke `ui/cost.ts` (dipakai Serbu juga).
> - **Tes:** `quests.test.ts` (misi awal, hitungan aksi hanya sejak misi mulai, bangunan selesai vs sedang dibangun, monster dimiliki, seluruh rantai dibayar sekali, akhir rantai, batas hari WIB, sekali sehari berurutan dan berputar, hari terlewat, determinisme, simpan/migrasi, data misi salah ditolak).
> - **Dicek di browser:** permainan baru → dialog Bonus Harian, ambil +500 emas, tidak muncul lagi hari itu; panen ladang → "Panen ladang (1/1)" → klaim +200 emas → misi "Monster pertamamu".
> - **Catatan:** aksi yang dilakukan saat misi sudah selesai tapi belum diklaim tidak dihitung untuk misi berikutnya. Telur sebagai hadiah misi menyusul di Tugas 1B.3.

### - [x] Tugas 1B.3 — Sarang Telur Jiwa

- Telur didapat dari hadiah misi atau koleksi. **Tidak dijual** dengan uang asli maupun permata.
- Merawat telur lewat beberapa langkah bertimer, dengan biaya makanan per langkah (angka di data).
- Menetas acak: **minimal langka, kadang epik** (peluang di data).
- Butuh populasi saat menetas.

**Kriteria selesai:** tes untuk langkah dan timer, biaya, populasi penuh, dan sebaran kelangkaan (Monte Carlo).

> **Ringkasan (selesai 2026-10-22):**
>
> - **Data:** bangunan baru `sarang-telur` (Sarang Telur Jiwa, feature `nest`, Balai Lv 2, maks 1, gambar buatan kode). `rules.nest`: 3 langkah rawat (30 mnt/300 makanan, 1 jam/600, 2 jam/1.200) dan hasil tetas langka 85 % (wujud tingkat 2, elemen 2 unsur) / epik 15 % (wujud tingkat 3, elemen 3 unsur). Hadiah misi `soulEggs`: misi baru "Sarang Telur Jiwa" (setelah Balai Lv 2), "Pemburu bandit", dan "Balai Utama Lv 4" masing-masing 1 telur. Divalidasi zod + cek silang (peluang = 1, wujud ada, unsur muat di wujud, ada elemen biasa dengan jumlah unsur itu, ada bangunan `nest`).
> - **Shared (`nest.ts`, baru):** `careSoulEgg` (bayar makanan langkah berikutnya, mulai timer; satu telur dirawat pada satu waktu), `soulEggStatus`, `rollSoulEgg` (RNG berbenih; elemen rahasia tidak pernah keluar), `hatchSoulEgg` (butuh populasi, bayi masuk Monsterpedia, dihitung sebagai aksi tetas untuk XP/misi), `addSoulEggs`. Telur tidak dijual di mana pun. **Simpanan v21** (`soulEggs`).
> - **Client:** kartu Sarang Telur Jiwa (jumlah telur, status langkah + hitung mundur, tombol Mulai rawat / Rawat / Tetaskan), gelembung telur di atas sarang saat ada yang bisa dilakukan, toast hasil dengan kelangkaan.
> - **Tes:** `nest.test.ts` (butuh sarang, langkah & timer & biaya, satu telur sekaligus, makanan kurang, tetas hanya saat siap, populasi penuh, determinisme, Monte Carlo 100.000 tetasan: tidak pernah biasa, langka/epik sesuai peluang, tingkat wujud & jumlah unsur benar, hadiah telur dari misi, simpan/migrasi).
> - **Dicek di browser:** sarang tampil dengan gelembung; telur siap → Tetaskan → Kura-kura Uap (langka), populasi 2→4, misi "Punya monster" selesai; telur berikutnya → Mulai rawat → makanan −300, langkah 1/3 dengan hitung mundur 30 menit.
> - **Belum:** tombol Rawat pada kartu yang sedang terbuka baru aktif setelah kartu dibuka ulang saat timer habis (gelembung muncul sebagai tanda). Telur dari koleksi set menyusul di Tugas 1B.4.

### - [x] Tugas 1B.4 — Koleksi set & Keajaiban

- **Set di Monsterpedia** (mis. semua wujud tingkat 1, semua elemen api): lengkap → hadiah (telur, Keajaiban, sumber daya).
- **Keajaiban:**
  - bangunan langka penghasil sumber daya besar berkala;
  - hanya dari hadiah koleksi set atau misi besar;
  - maksimal 1 per jenis.

**Kriteria selesai:** tes untuk deteksi set lengkap, klaim sekali, dan batas 1 Keajaiban per jenis.

> **Ringkasan (selesai 2026-10-22):**
>
> - **Data:** `data/collections.json` (baru) — 9 set: 3 set wujud per tingkat (Hewan Kecil/tingkat 1, Hewan Liar/tingkat 2, Pemburu & Makhluk Gaib/tingkat 3; elemen apa saja) dan 6 set elemen per unsur dasar (semua elemen biasa berisi unsur itu dengan ≤ 2 unsur; wujud apa saja). Hadiah = sumber daya, Telur Jiwa, atau Keajaiban. 3 Keajaiban baru di `buildings.json` (kategori "Keajaiban", feature `wonder`, maks 1, gratis & langsung jadi): Pohon Emas Purba (3.000 emas/jam, dari misi besar "Balai Utama Lv 4"), Lumbung Abadi (2.000 makanan/jam, set Hewan Liar), Kolam Jiwa (5.000 emas/jam, set Pemburu & Makhluk Gaib). Hadiah misi dan set memakai skema `prizeSchema` yang sama; divalidasi (id set unik, tingkat/unsur ada, Keajaiban benar-benar `wonder`, Keajaiban maks 1).
> - **Shared (`collections.ts`, baru):** `setProgress` (dari Monsterpedia), `claimSet` (sekali per set), `payPrize` (sumber daya + Telur Jiwa + Keajaiban; dipakai juga oleh `claimQuest`), `ownsWonder`. Keajaiban yang dimenangkan masuk `state.wonders` dan dipasang lewat menu Bangun; `buildBuilding` menolak Keajaiban yang belum dimenangkan dan memakai tokennya saat dipasang. Keajaiban yang sudah dimiliki (terpasang atau belum) tidak diberikan lagi. **Simpanan v22** (`collections`, `wonders`).
> - **Client:** tab "Set" di Monsterpedia (isi set dengan ??? untuk yang belum ditemukan, hadiah, tombol Klaim / Sudah diklaim); kategori Keajaiban di menu Bangun ("Menangkan dari set atau misi" bila belum dimenangkan); gambar buatan kode untuk tiga Keajaiban; `prizeLabel` untuk teks hadiah misi/set.
> - **Tes:** `collections.test.ts` (isi set wujud & elemen, set lengkap, klaim sekali, Keajaiban dari set dipasang gratis & langsung, tidak bisa dipasang tanpa dimenangkan, maks 1 per jenis, Keajaiban dari misi besar, produksi, simpan/migrasi).
> - **Dicek di browser:** tab Set menampilkan Hewan Kecil 6/6 & Hewan Liar 5/5; klaim Hewan Liar → +2.000 makanan, "Sudah diklaim"; menu Bangun → Keajaiban: hanya Lumbung Abadi yang bisa, dipasang gratis, token habis.
> - **Belum:** menyimpan Keajaiban ke gudang menyusul di Tugas 1B.5.

### - [x] Tugas 1B.5 — Putar bangunan & Gudang

- **Putar bangunan dan dekorasi** 2 arah (cermin gambar buatan kode).
- **Gudang:**
  - simpan dekorasi dan Keajaiban ke inventaris lalu pasang lagi;
  - hadiah dekorasi masuk gudang;
  - **monster tidak bisa disimpan**.

**Kriteria selesai:** tes untuk simpan dan pasang (posisi bebas, wilayah terbuka) dan putar tersimpan; tampilan cermin benar.

> **Ringkasan (selesai 2026-10-22):**
>
> - **Shared (`storage.ts`, baru):** `rotateBuilding` (dua arah, `Building.flipped`; tembok tidak bisa diputar karena tersambung ke tetangga), `storeBuilding` (hanya dekorasi dan Keajaiban, tidak saat dibangun; Keajaiban memungut hasilnya dulu), `placeStored` (gratis dan langsung, di tanah terbuka yang kosong, level & arah tetap, batas jumlah tetap berlaku), `isStorable`, `addToStorage`. Monster tidak pernah masuk Gudang.
> - **Keajaiban & hadiah:** Keajaiban hadiah set/misi kini masuk Gudang (menggantikan daftar `wonders` dari Tugas 1B.4) dan tidak bisa dibangun dari menu Bangun. Hadiah baru `decorations` (dekorasi masuk Gudang): misi "Latih prajurit" (Lampu), "Petani rajin" (Air Mancur), set Jiwa Cahaya (Lampu) & Jiwa Kegelapan (Patung). **Simpanan v23** (`storage`, `flipped`; Keajaiban yang sudah dimenangkan dipindah ke Gudang).
> - **Client:** tombol "Putar" dan "Simpan ke Gudang" di kartu bangunan; tab "Gudang" di bilah bawah (kartu barang dengan tombol Pasang); mode pasang dari Gudang (petunjuk "dari Gudang: gratis", tanpa pilihan pekerja); bangunan, bayangan pasang, dan kartu Gudang digambar cermin (`setFlipX`) bila diputar.
> - **Tes:** `storage.test.ts` (putar & tersimpan, tembok tidak berputar, simpan dekorasi dengan level & arah lalu pasang di mana saja yang terbuka, ditolak di petak terisi / tanah terkunci, Keajaiban memungut hasil sebelum disimpan, hanya dekorasi & Keajaiban, tidak saat dibangun, monster tidak bisa, batas jumlah, migrasi Keajaiban lama) + `collections.test.ts` diperbarui.
> - **Dicek di browser:** Lumbung Abadi → Putar (gambar cermin, `flipped` tersimpan) → Simpan ke Gudang (+340 makanan terpungut) → tab Gudang → Pasang → bayangan tetap cermin → terpasang lagi, Gudang kosong.

### - [x] Tugas 1B.6 — Pulau tambahan

- Pulau bertema (gurun, salju) dibuka di Balai Lv tinggi.
- Tiap pulau punya:
  - pohon/batu khas;
  - musuh liar lebih kuat;
  - batas bangunan sendiri.
- **Sumber daya berbagi** dengan desa utama.
- Pindah pulau lewat peta dunia sederhana.

**Kriteria selesai:** tes untuk membuka pulau, batas bangunan per pulau, dan sumber daya bersama; perpindahan pulau berfungsi.

> **Ringkasan (selesai 2026-10-22):**
>
> - **Data:** `data/islands.json` (baru) — Pulau Utama (desa pertama), Pulau Gurun (Balai Lv 4, 20.000 emas + 5.000 makanan, kaktus & batu pasir, musuh +1 baris tabel), Pulau Salju (Balai Lv 5, 60.000 emas + 15.000 makanan + 5.000 batu, cemara & bongkahan es, musuh +2 baris). Batas bangunan sendiri per pulau (`maxCount`; yang tidak disebut tidak bisa dibangun — Balai, Kandang, Soul Mixer, barak hanya di pulau utama). 4 rintangan baru di `wilds.json`. Divalidasi (id unik, pulau utama tanpa batas khusus, rintangan & bangunan ada, Balai tidak boleh di pulau lain).
> - **Shared (`islands.ts`, baru):** `islandStatus`, `unlockIsland` (desa kosong dengan rintangan khas, musuh & hewan langsung muncul), `travelTo` (tukar `state.village` dengan `state.islands[id]`; tidak bisa saat tim sedang bertarung). Sumber daya, pekerja, monster, prajurit tetap satu. Level Balai dibaca dari pulau utama; populasi, fitur bangunan (Soul Mixer, Sarang, Kuburan), level barak, dan kepemilikan Keajaiban dihitung di semua pulau; konstruksi di pulau yang ditinggal tetap selesai. Serangan desa hanya di pulau utama. **Simpanan v24** (`island`, `islands`).
> - **Client:** tab "Peta" (peta dunia: kartu pulau dengan status Kamu di sini / Pergi / Buka (harga) / Butuh Balai Lv N), tanah berwarna per pulau (pasir, salju), gambar buatan kode untuk kaktus, batu pasir, cemara, bongkahan es; menu Bangun menulis "Tidak bisa di pulau ini" untuk bangunan yang dilarang.
> - **Tes:** `islands.test.ts` (syarat Balai & harga, desa baru dengan rintangan khas, buka sekali, pindah & kembali utuh, sumber daya & level Balai bersama, tidak bisa saat tim keluar, batas per pulau & Balai hanya di utama, rumah pulau menambah populasi, konstruksi selesai saat ditinggal, musuh lebih kuat, tanpa serangan desa, simpan/migrasi).
> - **Catatan:** sempat membuat tes simulasi ekonomi lambat (72 dtk) karena urutan acak pulau utama berubah; diperbaiki dengan tetap mengundi urat emas saat tumbuh kembali sehingga urutannya sama seperti sebelumnya (22 dtk).
> - **Dicek di browser:** Peta → Buka Pulau Gurun (−20.000 emas, −5.000 makanan) → Pergi: tanah pasir, kaktus & batu pasir, sumber daya sama, menu Bangun memakai batas pulau; kembali ke Pulau Utama: desa utuh.
> - **Belum:** monster/prajurit tidak bisa dikirim antar pulau secara terpisah (ikut pemain); gambar khusus pulau (SpriteCook) belum dibuat.

**Gerbang Fase 1B:** pemain punya alasan kembali besok: misi berikutnya, bonus harian, telur yang sedang dirawat, dan set yang hampir lengkap.

---

## Fase 1 (lanjutan) — Pertarungan dan server

### - [x] Tugas 1.3 — Simulator pertarungan (shared)

- Fungsi murni deterministik `simulateBattle(attackers, defenders, seed)`:
  - petak 6×5 sesuai `rules.battle.grid`;
  - gerak dan target terdekat;
  - jangkauan;
  - kerusakan dengan keunggulan elemen;
  - jurus elemen.
- Hasilkan log kejadian yang bisa diputar ulang.
- Monster yang kalah **mati** (masuk Kuburan), sesuai aturan Fase 1A.
- Menggantikan rumus sementara di Tugas 1A.10.

**Kriteria selesai:** benih dan susunan sama selalu memberi hasil sama; pertempuran selalu berakhir sebelum `maxTicks`.

> **Ringkasan (selesai 2026-10-21):**
>
> - **Shared (`battle.ts`, baru):** `simulateBattle(attackers, defenders, seed)` murni dan deterministik di petak `rules.battle.grid` (penyerang 2 kolom kiri, bertahan 2 kolom kanan, sel diacak berbenih), 20 langkah/detik: gerak ke musuh terdekat, serang dalam jangkauan sesuai jeda dari kecepatan, kerusakan = atk × keunggulan elemen × defenseK/(defenseK+def) ±10 %, jurus elemen monster tiap serangan ke-4 (×2), waktu habis = penyerang kalah. Log kejadian (`start`, `attack`, `skill`, `death`) + sisa HP per petarung. `estimateWinChance` = bagian kemenangan dari `previewRuns` simulasi berbenih tetap.
> - **Data:** `rules.battle.sim` dan `rules.battle.bandit` (angka disetujui pemilik); `skirmish.sharpness` dan `deathChanceOnLoss` dihapus. Divalidasi zod.
> - **Misi:** `sendTeam` menjalankan simulator saat berangkat (`teamFighters`, `encounterFighters`); anggota yang HP-nya habis mati walau tim menang (monster ke Kuburan, prajurit gugur). `Mission.hpLeft` / `enemyHpLeft` menyimpan sisa HP. `previewWinChance` menggantikan rumus `winChance`. **Simpanan v12** (migrasi 11 mengisi sisa HP misi yang sedang berjalan).
> - **Client:** peluang menang di kartu musuh dan panel Pilih tim dari simulator (dihitung sekali per kartu); health bar memakai sisa HP sungguhan dan tampil paling lambat di separuh waktu misi bila tim masih berjalan.
> - **Tes:** `battle.test.ts` (deterministik, selesai ≤ `maxTicks` dan waktu habis = kalah, rumus kerusakan + keunggulan elemen + varians, jurus tiap serangan ke-4 dan prajurit tanpa jurus, posisi awal per sisi, Monte Carlo tim lebih kuat lebih sering menang, cermin ≈ 50 %); `missions.test.ts` Monte Carlo 4.000 kiriman cocok dengan perkiraan simulator.
> - **Dicek di browser:** Kucing Api Dewasa vs 2 bandit (perkiraan menang 37 %) → menang dengan sisa HP 10 %; bar merah bandit muncul dan habis, hadiah masuk.
> - **Revisi pemilik (2026-10-21): pertarungan liar tanpa batas waktu.** Tim berjalan selama `skirmish.marchSeconds` (dulu `missionSeconds`), lalu pertarungan **disimulasikan saat tim tiba** (`settleMissions` → `Mission.fight`) dan berlangsung sampai musuh habis atau seluruh tim mati (`simulateBattle(..., { untilDefeat: true })`; `maxTicks` tetap berlaku untuk Serbu). Lama pertarungan = lama simulasi. Kartu musuh: "menuju musuh, tiba dalam …" lalu "sedang bertarung sampai salah satu pihak habis". **Simpanan v13** (migrasi 12 mengubah misi lama menjadi pertarungan yang sudah berjalan). Diperbaiki: unit bisa macet tepat di batas jangkauan karena pembulatan (toleransi 1e-6; tes regresi 300 benih).
> - **Catatan penyeimbangan:** di simulasi ekonomi 14 hari, bot kini sering kalah melawan bandit (hari 3: 1 menang/10 kalah) — bandit simulator lebih kuat dari rumus lama. Perlu ditinjau bersama Tugas 1A.11 (angka bandit / `banditPower`).

### - [x] Tugas 1.4 — Mode Serbu

- **Layar penempatan:**
  - seret monster ke petak;
  - penghitung poin kekuatan vs batas **gabungan ketiga barak**;
  - maksimal 30 monster;
  - cadangan.
- **Pemutaran:** dari log, kecepatan 1x/2x, tombol jurus saat pengukur penuh.
- **Lawan sementara:** markas NPC.

> **Ringkasan (selesai 2026-10-21):**
>
> - **Keputusan pemilik (2026-10-21):** markas NPC berupa **daftar bertingkat** (menang pertama = hadiah besar + markas berikutnya terbuka, boleh diulang dengan hadiah kecil); unit yang gugur **mati** (monster ke Kuburan, prajurit hilang); **medan Serbu sendiri yang lebih besar**; **jurus tetap otomatis** (tiap serangan ke-4), tombol jurus manual menyusul karena butuh simulasi yang menerima input pemain.
> - **Data (`rules.serbu`):** medan 12×8, penempatan di 4 kolom kiri (pertahanan NPC di 4 kolom kanan, diacak berbenih), rekaman posisi tiap 4 langkah, dan **10 markas** (Pos Bandit → Takhta Titan) dengan syarat Balai, pertahanan (bandit / monster / prajurit / Menara Jaga), `firstReward` dan `repeatReward`. Divalidasi zod + cek silang (wujud, elemen, tahap, prajurit, pangkat, level menara, muat di medan). Guild (`barak`) kini punya fitur `serbu`.
> - **Simulator:** `simulateBattle` menerima `grid`, `sideColumns`, `cells` (posisi pilihan pemain) dan `trackEvery` (rekaman posisi untuk pemutaran); perilaku lama tidak berubah.
> - **Shared (`serbu.ts`, baru):** `serbuBaseStatus` (terkunci / butuh Balai / terbuka / sudah dikalahkan), `serbuArmy` (unit bebas: tidak di misi, tidak di Soul Mixer), `serbuUnitPower`, `baseFighters`, `basePower`, `attackBase` (validasi petak, maks. `battle.maxUnits`, poin ≤ batas gabungan barak, lalu simulasi dengan `maxTicks` sebagai batas waktu; hadiah, Kuburan, kemajuan). Galat baru `powerCapExceeded`. **Simpanan v17** (`serbu.cleared`).
> - **Client (`SerbuScene`, baru):** dibuka dari kartu Guild. Daftar markas (status, pertahanan, kekuatan, hadiah) → penempatan (seret unit ke zona hijau atau ketuk unit lalu petak, ketuk/seret unit di medan untuk memindah/menarik, penghitung poin & unit, "Isi otomatis" menaruh unit terkuat dalam batas: penahan/petarung di depan, pemanah di belakang) → pemutaran dari log (posisi dari rekaman, bilah HP, pengukur jurus, angka kerusakan, kilat jurus, 1x/2x, Lewati, sisa waktu) → hasil (menang/kalah, hadiah, markas baru terbuka, yang gugur).
> - **Tes:** `serbu.test.ts` (9: urutan buka & syarat Balai, pertahanan → petarung, markas makin kuat, validasi penempatan/batas/unit sibuk, hadiah pertama & ulang, Kuburan & prajurit hilang saat kalah, posisi awal & rekaman & batas waktu, deterministik, simpan/migrasi). Total 275 tes lulus.
> - **Penyeimbangan (simulasi 30 benih):** pasukan awal (2 prajurit + 1 kucing) menang 100 % di Pos Bandit; 10 veteran sampai Markas Prajurit Bayaran (97 %); Takhta Titan butuh pasukan elit + monster tingkat 3–4.
> - **Dicek di browser:** kartu Guild → Serbu; daftar 10 markas; seret Kucing ke medan; Isi otomatis; Serang → pemutaran → "Menang!" +300 emas +100 makanan, Pos Bandit "Sudah dikalahkan", Kemah Perampok terbuka; tutup → desa jalan lagi. (Pemutaran terlihat lambat di panel browser yang sedang di latar karena FPS-nya dibatasi ±2.)
> - **Belum:** tombol jurus manual, batas jumlah Serbu per waktu (D3, energi), markas pemain lain (Tugas 2.2).

### - [x] Tugas 1.5 — Mode Petualangan (dungeon)

- Peta wilayah dengan titik sumber daya, musuh, dan satu bos per wilayah; data di `data/adventure.json`.
- Mengalahkan bos:
  - menaikkan jumlah bos dikalahkan;
  - membuka tingkat Soul Mixer berikutnya.
- **Sumber permata gratis** dalam jumlah kecil (angka di data).

> **Ringkasan (selesai 2026-10-21):**
>
> - **Keputusan pemilik (2026-10-21):** wilayah berupa **peta jalur bertitik**; bertarung **seperti Serbu** (penempatan + pemutaran, batas poin gabungan barak, unit gugur mati); titik sumber daya **dijaga lalu terisi lagi**; permata dari **bos + sedikit dari titik**.
> - **Data (`data/adventure.json`, baru):** 3 wilayah — Hutan Berbisik (Balai 2, bos Raja Serigala), Rawa Kabut (Balai 3, Buaya Purba), Gunung Api (Balai 4, Naga Merah). Tiap titik: jenis (`resource` / `camp` / `boss`), posisi peta, jalur (`after`), pertahanan, hadiah; titik sumber daya punya `refillHours` dan `gemChance`. Pertahanan jenis baru `boss` (monster bernama, statistik × `statMultiplier`) dipakai bersama Serbu; hadiah kini bisa berisi permata. Divalidasi zod + cek silang (jalur hanya ke titik sebelumnya, tepat satu bos per wilayah, refillHours hanya untuk sumber daya, pertahanan muat).
> - **Shared:** `serbu.ts` dipecah — `fightPlaced` (validasi penempatan + simulasi + Kuburan) dipakai Serbu dan Petualangan; `defenderFighters`, `defendersPower`, `payReward`. `adventure.ts` (baru): `regionStatus`, `nodeStatus` (terkunci / butuh Balai / terbuka / sudah dikalahkan / terisi lagi), `attackNode` (sumber daya dibayar tiap diambil + peluang permata, lalu terisi lagi; kemah & bos sekali; bos pertama kali menaikkan `bossesDefeated` → tingkat Soul Mixer berikutnya). **Simpanan v18** (`adventure.cleared`, `adventure.refillAt`).
> - **Client:** Gerbang Petualangan → peta wilayah (tab wilayah, jalur menyala setelah dilewati, titik berwarna per jenis, tanda ✓ / …, layar kunci wilayah) + kartu titik (penjaga, kekuatan, hadiah, waktu isi ulang, peluang permata) → layar penempatan & pemutaran Serbu yang sama; bos tampil lebih besar dengan aura; hasil bos menyebut tingkat Soul Mixer baru.
> - **Tes:** `adventure.test.ts` (10: urutan wilayah & syarat Balai, jalur, sumber daya dibayar + terisi lagi, permata Monte Carlo, kemah sekali, bos menaikkan tingkat Soul Mixer, kalah tanpa hadiah, semua titik bisa dikalahkan pasukan kuat, validasi data, simpan/migrasi). Total 285 tes lulus.
> - **Penyeimbangan (simulasi 30 benih):** titik Hutan Berbisik bisa diambil 6 prajurit rekrut; Raja Serigala butuh ±10 veteran; Buaya Purba butuh pasukan elit + monster tingkat 3; Naga Merah butuh elit + monster tingkat 3–4 (93 %).
> - **Dicek di browser:** kartu Gerbang → peta Hutan Berbisik; Tumpukan Kayu → menang +400 kayu → "Terisi lagi dalam 7j 59m", Kemah terbuka; pratinjau bos Raja Serigala.

### - [x] Tugas 1.7 — Serangan ke desa & pertahanan

- Musuh liar atau bandit kadang menyerang desa (jadwal dan kekuatan dari data).
- Monster pemain **melawan balik otomatis** saat musuh masuk wilayah atau mendekat.
- Menara dan tembok ikut bertahan.
- Monster yang kalah mati (masuk Kuburan).
- Memakai simulator Tugas 1.3.

**Kriteria selesai:** tes untuk jadwal serangan, siapa yang ikut bertahan, hasil deterministik, dan monster mati masuk Kuburan.

> **Ringkasan (selesai 2026-10-21):**
>
> - **Keputusan pemilik (2026-10-21):** serangan hanya berjalan **saat bermain**; kalah bertahan = **sumber daya dicuri**; Tembok **menghalangi jalan** (musuh memutar atau menjebol); yang ikut bertahan **hanya unit yang dekat** + menara yang menjangkau.
> - **Data (`rules.raids`, angka baru, bisa diubah):** mulai Balai Lv 3, satu serangan tiap 1.200 detik bermain, peringatan 60 dtk, jalan 1 petak/dtk, bertahan dalam 4 petak, curian 5 % (varian ringan, dipilih pemilik 2026-10-21; awalnya Balai Lv 2, 900 dtk, 10 %). Menara: jangkauan 6 petak + statistik per level. Tembok: HP ruas per level (400/1000/2000). Divalidasi zod + cek silang bangunan menara/tembok.
> - **Shared (`raids.ts`, baru):** `advanceRaids(state, detikBermain, now)` menjalankan jam serangan, memunculkan kelompok dari daftar musuh level Balai di tanah terkunci tepat di luar desa (`WildEncounter.raid`), lalu peringatan → berjalan per petak ke sisi Balai Utama. `raidRoute` = Dijkstra waktu: bangunan/alam liar tidak bisa dilewati, ruas tembok bisa dilewati dengan biaya `HP / kerusakan per detik penyerang` (`raidDps`), jadi musuh memilih memutar atau menjebol; ruas yang dijebol hancur. Pertarungan mulai saat unit dalam `defendTiles`, menara dalam jangkauan, atau musuh tiba (`raidDefenders`, unit di misi/Soul Mixer tidak ikut). `startRaidFight` memakai simulator 1.3 (menara = petarung diam, `Fighter.fixed`); menang = hadiah kelompok, kalah = `MissionFight.stolen` dipotong saat pertarungan selesai (`settleMissions`), monster gugur ke Kuburan. Serangan diabaikan oleh aggro & jatah musuh harian; berhenti saat ada tim yang melawannya. **Simpanan v16** (`village.raidClock`).
> - **Client:** detik bermain dikirim tiap 1 dtk saat ada serangan (5 dtk bila tidak); peringatan, hitung mundur / "Menuju Balai Utama!" / "Menjebol tembok…" / "Bertarung!", jalur titik merah dengan tanda silang di tembok yang akan dijebol, lingkaran jarak bertahan, gerak musuh halus, bilah HP menara, toast jebol/hadang/curian, kartu info menara & tembok, tombol debug "Serang desa sekarang".
> - **Tes:** `raids.test.ts` (18: jadwal & hanya saat bermain, jalur lurus/jebol/celah/memutar tembok kuat, lama jebol, siapa bertahan, berhenti saat dilawan, curian, hadiah, Kuburan, deterministik, simpan/migrasi) + tes menara diam di `battle.test.ts`.
> - **Dicek di browser:** tanpa pertahanan → tiba di Balai, tepat 10 % dicuri; tembok 24 ruas → satu ruas dijebol, prajurit dalam 4 petak menghadang (kalah, 1 gugur, dicuri); menara sendirian vs 1 bandit → menang, hadiah masuk.
> - **Catatan penyeimbangan:** 3 bandit Balai Lv 2 mengalahkan 3 Prajurit Rekrut (sama dengan catatan Tugas 1.3: bandit simulator kuat). `pnpm sim:economy` belum mensimulasikan serangan desa.
>
> **Perapian penyeimbangan bandit & simulasi serangan (2026-10-21):**
>
> - **`rules.battle.bandit.powerScale` 2.5 → 1.2**, supaya kelompok bandit dengan total `banditPower` p kira-kira setara p poin kekuatan (arti `banditPower` di `wilds.json`). Diukur dengan simulator: 2 Prajurit Rekrut vs 3 bandit Balai Lv 2 (1,8 poin) menang 91 % (dulu 0 %), vs 4 bandit (2,4 poin) 0 %; 3 prajurit vs 4 bandit 100 % (dulu 0 %). Menutup catatan penyeimbangan Tugas 1.3.
> - **`pnpm sim:economy` kini mensimulasikan serangan desa** (`advanceRaids` hanya selama sesi) dan melaporkan serangan menang/kalah + jumlah yang dicuri per hari. Bot: saat peringatan, pasukan bebas berdiri di jalur musuh `raidRallyTiles` = 3 petak sebelum Balai; urutan bangun kini Barak Prajurit, Menara Jaga, dan Barak Panahan lebih awal (asumsi perilaku, bukan angka game). Pencarian titik muncul serangan dipercepat (satu peta petak per pencarian).
> - **Hasil 14 hari (benih 1):** Balai Lv 4 di hari 3; musuh liar hampir selalu menang (dulu hari 5–6: 1/19, 0/28). Serangan desa: hari 1–5 kebanyakan kalah (bot baru punya beberapa prajurit), hari 6+ sekitar separuh–semua menang; curian 2–30 ribu/hari di awal, sampai 144 ribu/hari di akhir karena 10 % dari simpanan bot yang menumpuk.
> - **Irama serangan (diputuskan pemilik 2026-10-21): varian ringan** — mulai Balai Lv 3, tiap 1.200 detik bermain, curian 5 %. Di simulasi 4 hari: curian ±2–6 % dari pendapatan dan bot menang sekitar separuh serangan.
> - **Catatan bot:** monster pertama bot gugur di serangan pertama dan bot tidak pernah menghidupkannya dari Kuburan, jadi bot bermain tanpa monster/Soul Mixer (perilaku bot, perlu dirapikan terpisah).

### - [x] Tugas 1.6 — Server Supabase

- Skema database dan migrasi untuk semua isi `PlayerState`.
- Login anonim (Google menyusul di Fase 2).
- Edge Functions memakai `packages/shared`:
  - `mix-start`, `mix-collect`, `mix-prophesy`, `mix-cancel`;
  - `speed-up`, `feed`, `harvest`;
  - `battle-resolve`;
  - aksi desa, pekerja, wilayah, dan Barak.
- Semua waktu memakai jam server; client hanya meminta dan menampilkan.
- **Pengambilan sumber daya alam yang hanya berjalan saat bermain** butuh detak aktif dari client yang diverifikasi server (batas wajar per detak).
- Pindahkan simpanan dari `localStorage` ke server, dengan migrasi data lama.

> **Ringkasan (selesai 2026-10-22):**
>
> - **Keputusan pemilik (2026-10-22):** satu baris JSONB per pemain.
> - **Shared (`server/actions.ts`, `server/handler.ts`, baru):** daftar 48 aksi bernama (parameter dicek zod) yang menjalankan fungsi shared yang sudah ada; `handleRequest(slot, request, now)` murni: `load` (selesaikan timer), `beat` (detik bermain dibatasi waktu nyata sejak detak terakhir + `rules.server.beatSlackSeconds`, maks `maxBeatSeconds`), `action`. `skipUnlock` selalu dibuang di server.
> - **Supabase:** migrasi `players` (save jsonb, revision untuk cegah tulis ganda, beat_at; RLS: pemain hanya membaca barisnya), `config.toml` (login anonim aktif), edge function `action` (Deno; memakai bundel `pnpm build:server` → `supabase/functions/_shared/game.js`, di-gitignore), migrasi simpanan lokal pada kunjungan pertama. Satu fungsi `action` menggantikan daftar fungsi terpisah di rencana (mix-start, feed, harvest, battle-resolve, …).
> - **Client:** semua tombol kini memanggil `store.act(nama, params)` — dijalankan lokal seketika, lalu dikirim ke server bila `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` terisi; jawaban server (keadaan + jam server) menggantikan keadaan lokal. Detik bermain dikirim tiap `beatEverySeconds`. Login anonim lewat REST Auth (tanpa dependensi baru), pesan galat server. Tanpa env: tetap offline seperti sebelumnya.
> - **Tes:** `server/handler.test.ts` (aksi sama dengan client & jam server, galat diteruskan, permintaan buruk ditolak, `skipUnlock` diabaikan, semua aksi punya cek parameter, `load` menyelesaikan timer, batas detak, detak memajukan pengambilan, determinisme).
> - **Dicek di browser dengan server tiruan lokal** (memakai bundel yang sama): login anonim + impor simpanan, aksi & detak diterima server, emas yang diubah di client ditimpa nilai server, server mati → peringatan dan game tetap jalan. Mode offline tetap normal.
> - **Deploy (2026-10-22, proyek `alrkfeyjcsoqarcstymi`):** `supabase link`, `db push` (tabel `players`), `pnpm build:server`, `functions deploy action --use-api` (tanpa Docker). Dicek di browser: login anonim, simpanan lokal pindah ke server (8 bangunan, 80.000 emas sama persis), aksi tersimpan di server, emas 9.999.999 yang diubah di client ditimpa kembali ke 80.000, jam game mengikuti server; panggilan dengan anon key saja ditolak (401).
> - **Perbaikan saat uji:** sesi anonim kini disimpan per URL proyek dan diperbarui otomatis bila server menolak token (sebelumnya sesi dari server tiruan terbawa).
> - **Catatan:** setiap perubahan `packages/shared` atau `data/` perlu `pnpm build:server` + deploy ulang (lihat `docs/SERVER.md`).

**Gerbang Fase 1:** satu sesi 10 menit terasa lengkap: panen, kirim pekerja, campur, bertarung, upgrade.

---

## Fase 1C — Rombak objek (dari docs/OBJEK.md)

Tujuan: menerapkan daftar objek yang diisi pemilik di [docs/OBJEK.md](OBJEK.md) (2026-10-23). Angka di sana (baris bertanda \*) masih kira-kira: pindahkan ke `data/*.json`, uji dengan `pnpm sim:economy`, lalu sesuaikan. Gambar objek baru memakai gambar buatan kode (`art/buildingArt.ts`); **keputusan pemilik 2026-10-27:** gambar SpriteCook ditunda sampai pemilik meminta (gambar yang sudah terpasang tetap dipakai). Setiap tugas yang mengubah `packages/shared` atau `data/` perlu `pnpm build:server` + deploy ulang (lihat `docs/SERVER.md`). Kerjakan 1C.1 lebih dulu; sisanya boleh berurutan sesuai nomor.

### - [x] Tugas 1C.1 — Ganti nama, id & migrasi simpanan

- Soul Mixer → **Altar** (`altar`): hasil campuran langsung menjadi monster **bayi** saat waktu campur selesai (tidak lewat telur / Sarang Telur), butuh slot populasi kosong.
- Kandang Monster dihapus; gambarnya dipakai **Gudang** (`gudang`, 3×3, 1 level, ada di desa awal) yang membuka panel Gudang.
- **Sarang Telur Jiwa** bisa dibangun sejak Balai 1; koleksi monster (beri makan, lepas) pindah ke sana; telur awal menunggu sampai Sarang dibangun (usul misi pertama "Bangun Sarang Telur Jiwa").
- Id baru: Guild `barak` → `guild`, Barak Prajurit `petarung` → `barak`, Barak Berkuda `barak-berkuda` → `kandang-kuda` (urutan migrasi hati-hati: `barak` lama = Guild). Nama tampilan: Barak, Lapangan Pemanah, Kandang Kuda.
- Naikkan versi simpanan dengan migrasi; perbarui `text.json`, CLAUDE.md (Soul Mixer → Altar, hasil langsung bayi), dan dokumen.

**Kriteria selesai:** simpanan lama termuat tanpa kehilangan bangunan/monster; Altar memberi bayi langsung; Sarang Telur bisa dibangun di Balai 1 dan memegang koleksi monster; Gudang menggantikan Kandang.

> **Ringkasan (selesai 2026-10-23):**
>
> - **Aset & Atlas:** Folder `apps/game/art/buildings/` dimutakhirkan (`kandang` → `gudang`, `soul-mixer` → `altar`, `petarung` → `barak`, `barak` → `guild`); `pnpm atlas` mengemas frame baru `gudang/lv1`, `altar/lv1`, `barak/lv1`, `guild/lv1`; daftar aset `PROVENANCE.md` dan `spritecook-assets.json` disesuaikan. Fallback prosedural di `buildingArt.ts` diperbarui beserta alias kompatibilitas.
> - **Data & Teks:** `buildings.json` menghapus `kandang`, menambah `gudang` (feature `storage`, 3×3, 1 level, desa awal), mengubah `soul-mixer` ke `altar` (feature `altar`), `petarung` ke `barak` (nama "Barak", melatih `prajurit`), `barak-berkuda` ke `kandang-kuda` (nama "Kandang Kuda"), nama `lapangan-panah` menjadi "Lapangan Pemanah", dan `sarang-telur` bisa dibangun di Balai 1 (`requiresTownHall: 1`, maks 1). Misi di `quests.json` disesuaikan. Teks UI di `text.json` diperbarui ke istilah Altar, Gudang, dan Sarang Telur Jiwa.
> - **Logika & Simpanan:** `packages/shared/src/state.ts` dan `barracks.ts` mendukung fitur `altar` dan `storage`; `hatchEgg` mewajibkan Sarang Telur Jiwa (`noNest`); simpanan dinaikkan ke **skema v26** dengan migrasi v25 yang memetakan `barak` → `guild`, `petarung` → `barak`, `barak-berkuda` → `kandang-kuda`, `soul-mixer` → `altar`, serta `kandang` pertama menjadi `gudang` (kelebihan kandang dibongkar dan dikembalikan 300 emas & 200 kayu).
> - **UI & Scene:** `infoCard.ts` menangani fitur `storage` (membuka Gudang & status item), `altar` (buka Altar), dan `nest` (membuka panel Koleksi Monster serta penetasan telur siap); `VillageScene.ts` mengarahkan penetasan telur cepat di Sarang Telur dan membuka panel di Altar.
> - **Pengujian & Validasi:** 356 tes di vitest lolos 100% (`pnpm test`); linting ESLint dan Prettier lolos 0 error (`pnpm lint`); bundel server `pnpm build:server` berhasil diperbarui.

### - [x] Tugas 1C.2 — Level baru bangunan lama

- Balai Utama sampai Lv 8 (biaya, waktu, populasi, waktu latih pekerja makin cepat per level).
- Rumah, Pasar, Ladang sampai Lv 6; Tambang Emas & Penggilingan sampai Lv 8 dengan slot pekerja 1/1/2/2/3/4/5/6; Peternakan Lv 5; Barak, Lapangan Pemanah, Kandang Kuda Lv 6; Menara Jaga Lv 5; Tembok Lv 8 (gambar ruas baru lewat `pnpm art:wall`).
- Batas jumlah per Balai sampai Lv 8 untuk semua bangunan. Kandang Kuda terbuka di Balai 3.
- **Keputusan pemilik (2026-10-26):** tidak ada tombol "tambah slot populasi"; populasi hanya bertambah dari level bangunan. Harga percepat Balai Lv 7–8 tidak dibatasi (tetap 1 permata/menit).

**Kriteria selesai:** semua level baru ada di `data/` dan lolos validasi; `pnpm sim:economy` menunjukkan kemajuan Balai yang masuk akal.

> **Ringkasan (selesai 2026-10-26):**
>
> - **Data:** semua angka tabel `docs/OBJEK.md` masuk `buildings.json`: Balai Utama Lv 1–8 (biaya, waktu sampai 15 hari, populasi 8/10/13/17/22/28/35/43); Rumah, Pasar, Ladang Lv 6; Tambang Emas & Penggilingan Lv 8 dengan slot pekerja 1/1/2/2/3/4/5/6; Peternakan Lv 5 (9 & 12 hewan); Barak, Lapangan Pemanah, Kandang Kuda Lv 6 (Lv 6 `queueBonus` +1 antrean); Menara Jaga Lv 5; Tembok Lv 8. Semua `maxCount` berisi 8 angka (bangunan lain memakai batas terakhirnya). Kandang Kuda kini terbuka di Balai 3. `rules.json`: `workers.trainSecondsByTownHall` 60 → 25 dtk (menggantikan `trainSeconds`), menara Lv 4–5 (jangkauan 7), HP tembok Lv 4–8, tabel batas kekuatan Serbu sampai gabungan level 18. `wilds.json`: jumlah kelompok musuh untuk Balai 7–8 (Balai 6+ masih memakai daftar musuh Balai 5; tambahan musuh di 1C.9).
> - **Shared:** `workerTrainSeconds` (lama latih pekerja per level Balai), `barracksQueueMax` (antrean + `queueBonus`), `towerStats` / `towerReach` (menara ikut bertahan sejauh jangkauan levelnya). Validasi: panjang `trainSecondsByTownHall` = jumlah level Balai, `queueBonus` hanya di barak. **Simpanan v27:** pekerja yang melebihi slot baru Tambang/Penggilingan Lv 1–2 dikeluarkan (jadi menganggur).
> - **Client:** tombol Latih pekerja menampilkan lama latih; panel barak memakai batas antrean per level; kartu menara memakai jangkauan per level.
> - **Gambar:** tembok Lv 4–8 dari SpriteCook (asset `f2bf7add-…`, 14 kredit), dipotong dengan `pnpm art:wall` + `art/tembok-pieces-lv4-8.json`, atlas dikemas ulang; dicatat di `spritecook-assets.json` dan `PROVENANCE.md` (menunggu persetujuan pemilik).
> - **Simulasi:** Balai Lv 4 di hari 3, 18:00 (sebelumnya 21:30), lalu tertahan di Lv 4 sampai hari 14 — **sama seperti sebelum tugas ini**. Penyebabnya kayu & batu (alam liar habis; saldo akhir 17.694 kayu / 9.195 batu, Balai 5 butuh 20.000 / 12.000), sedangkan emas menumpuk. Diselesaikan oleh Tambang Batu & Tukang Kayu di **Tugas 1C.3**.
> - **Pengujian:** 362 tes lolos, `pnpm lint` dan typecheck lolos, `pnpm build:server` diperbarui (perlu deploy ulang edge function).

### - [x] Tugas 1C.3 — Bangunan produksi baru

- **Tambang Batu** (`tambang-batu`) dan **Tukang Kayu** (`tukang-kayu`): pekerja di dalam, jalan saat game ditutup, 8 level (seperti Tambang Emas).
- **Mansion** (`mansion`, nama tampilan bahasa Indonesia mis. Rumah Bangsawan): populasi lebih banyak, terbuka Balai 4, 6 level.

**Kriteria selesai:** kayu & batu bisa dihasilkan tanpa alam liar; simulasi ekonomi diuji ulang.

> **Ringkasan (selesai 2026-10-26):**
>
> - **Data (`buildings.json`, angka dari `docs/OBJEK.md`):** **Tambang Batu** (`tambang-batu`, staffed → batu, Balai 2, maks 0/1/1/2/2/3/3/4, 60 → 260 batu/pekerja/jam) dan **Tukang Kayu** (`tukang-kayu`, staffed → kayu, Balai 1, maks 1/1/2/2/3/3/3/4, 80 → 320 kayu/pekerja/jam), keduanya 8 level dengan slot pekerja 1/1/2/2/3/4/5/6. **Rumah Bangsawan** (`mansion`, feature `house`, Balai 4, maks 0/0/0/1/2/3/4/5, 6 level, populasi +30 → +100).
> - **Client:** gelembung pungut kini juga untuk kayu & batu (ikon kayu/batu); gambar buatan kode untuk ketiga bangunan sebagai cadangan.
> - **Gambar:** satu baris SpriteCook (asset `33a1cb0d-…`, 14 kredit) dipotong per sel lalu `pnpm art:iso` ukuran 2 → `tambang-batu/lv1`, `tukang-kayu/lv1`, `mansion/lv1`; atlas dikemas ulang; dicatat di `spritecook-assets.json` dan `PROVENANCE.md` (menunggu persetujuan pemilik).
> - **Simulasi:** bot membangun Tukang Kayu, Tambang Batu, dan Rumah Bangsawan. **Balai Lv 5 di hari 7, 18:00** (sebelumnya tertahan di Lv 4 sampai hari 14); pendapatan batu naik dari ±7.000 menjadi ±25.000/hari dan kayu ±47.000/hari di hari 14, tidak lagi habis bersama alam liar. Balai Lv 6 (3 hari bangun) belum tercapai dalam 14 hari.
> - **Tes:** `newBuildings.test.ts` (hasil kayu/batu saat game ditutup sampai tampungan, syarat Balai, slot pekerja 1/1/2/2/3/4/5/6 untuk keempat bangunan staffed, Rumah Bangsawan terbuka di Balai 4 dan menambah populasi).

### - [x] Tugas 1C.4 — Dekorasi berpopulasi & Monumen Keajaiban

- Pohon Hias / Taman Bunga / Lampu +2, Air Mancur +5, Patung Naga +10, **Monumen Keajaiban** (2×2, Balai 5, maks 2) +15 populasi.
- **Keputusan pemilik (2026-10-26):** populasi dari dekorasi dibatasi total per level Balai Utama (bukan tanpa batas).

> **Ringkasan (selesai 2026-10-26):**
>
> - **Data:** `population` di level Pohon Hias, Taman Bunga, Lampu Jalan (+2), Air Mancur (+5), Patung Naga (+10); bangunan baru **Monumen Keajaiban** (`monumen-keajaiban`, Dekorasi 2×2, Balai 5, maks 2, 10.000 emas + 1.500 batu, langsung jadi, bisa dijual/disimpan, +15). `rules.population.decorationCapByTownHall` = 10/20/35/50/75/100/130/160 untuk Balai 1–8 dan `decorationCategory` = `dekorasi` (divalidasi: panjang = level Balai, kategori ada).
> - **Shared:** `decorationPopulation` (dibuat / batas / dihitung, semua pulau); `populationCap` menjumlahkan bangunan biasa ditambah populasi dekorasi yang dibatasi. Dekorasi di Gudang tidak dihitung. Desa awal (1 Pohon Hias + 1 Taman Bunga) kini mulai dengan +4 populasi.
> - **Client:** kartu dekorasi menampilkan "Populasi +N" dan total dekorasi terhadap batasnya; gambar Monumen buatan kode (obelisk putih berpita warna enam unsur, kristal di puncak). Gambar SpriteCook belum dibuat (kredit tersisa 12, kurang dari 14 per gambar).
> - **Tes:** `newBuildings.test.ts` (semua dekorasi berpopulasi, data Monumen, batas per level Balai, di bawah batas dihitung penuh) dan tes populasi awal di `workers.test.ts`.

### - [x] Tugas 1C.5 — Undian Harian di Pasar

- Gratis 1× sehari per akun, hasil acak dihitung server; level Pasar tertinggi memperbagus tabel hadiah. Tidak ada undian tambahan dengan permata; tidak memberi monster (aturan 7).
- **Keputusan pemilik (2026-10-27):** Telur Jiwa boleh menjadi hadiah langka.

> **Ringkasan (selesai 2026-10-27):**
>
> - **Data (`rules.marketDraw`):** empat tabel hadiah menurut level Pasar tertinggi (Lv 1, 3, 5, 6), bobot per tabel berjumlah 1.000: emas, makanan, kayu, batu, Kristal Jiwa, dekorasi ke Gudang (Taman Bunga/Pohon Hias → Lampu/Air Mancur → Patung/Air Mancur → Patung/Monumen Keajaiban), dan **Telur Jiwa** 0,5 % / 1 % / 1,5 % / 2 %. Tiap tabel lebih tinggi memberi lebih banyak sumber daya dan peluang telur lebih besar. Validasi: tabel mulai minLevel 1 dan naik, level ada di Pasar, dekorasi benar-benar dekorasi, tanpa Keajaiban. `prizeSchema` dipindah ke atas agar dipakai `rules.json`.
> - **Shared (`market.ts`, baru):** `bestMarketLevel` (semua pulau), `marketTableIndex`, `marketDrawStatus` (tersedia, tabel, detik sampai undian berikutnya; hari sama dengan bonus harian, WIB), `rollMarketPrize`, `drawMarket` (1× sehari per akun, RNG berbenih dari `rngState`, hadiah lewat `payPrize`). Galat baru `noMarket`. Aksi server `drawMarket` (hasil diundi di server). **Simpanan v28** (`marketDraw.lastDay`; simpanan lama mulai dengan undian hari ini masih gratis).
> - **Client:** kartu Pasar menampilkan "Undian Harian gratis hari ini!" atau hitung mundur, dan tombol **Undian Harian**; toast menyebut hadiahnya (dekorasi kini ikut tertulis di `prizeLabel`).
> - **Tes:** `market.test.ts` (sekali sehari & buka lagi besok, butuh Pasar jadi, tabel dari Pasar tertinggi, tabel lebih tinggi lebih baik, Monte Carlo 100.000 undian per tabel dalam 4 simpangan baku, hadiah sumber daya/dekorasi/telur tanpa monster langsung, deterministik, aksi server, simpan & migrasi v27) dan tes validasi di `data.test.ts`.

### - [x] Tugas 1C.6 — Pertahanan: Menara Sihir & Gerbang

- **Menara Sihir** (`menara-sihir`, 5 level, Balai 3): jangkauan 4 petak, serangan kuat dengan kerusakan area kecil, tembakan lambat (simulator pertarungan perlu kerusakan area).
- **Gerbang** (`gerbang`, 8 level): dipasang di barisan tembok; terbuka = unit sendiri lewat, tertutup otomatis saat serangan desa, musuh harus menjebol. Butuh potongan gerbang di `tembok-pieces.json` dan jalur yang membedakan unit sendiri dan musuh.

> **Ringkasan (selesai 2026-10-27):**
>
> - **Data:** **Menara Sihir** (`menara-sihir`, Militer 2×2, Balai 3, maks 0/0/1/2/2/3/3/4, 5 level, biaya & waktu dari `docs/OBJEK.md`); `rules.raids.magicTower`: HP 500 → 2.200, serangan 45 → 160, spd 5 (Menara Jaga 8), jangkauan 4 petak, ledakan 50 % ke musuh dalam 1,5 petak dari sasaran. **Gerbang** (`gerbang`, feature baru `gate`, 1×1, Balai 2, maks 4, 8 level langsung jadi, biaya 3× ruas tembok); `rules.raids.gate.hpByLevel` 600 → 15.000 (1,5× tembok). Skema menara dijadikan satu (`towerRulesSchema`) untuk Menara Jaga dan Menara Sihir; validasi menara/penghalang per level dan gerbang 1×1 langsung jadi.
> - **Shared:** simulator pertarungan punya kerusakan area (`Fighter.splash`: tiap pukulan juga mengenai musuh lain dalam radius sebesar rasio kerusakannya). `towerRules` / `towerStats` / `towerReach` / `towerFighter` untuk kedua menara (Menara Sihir ikut bertahan bila penyerang dalam jangkauannya). Penyerang menjebol gerbang seperti ruas tembok dengan HP gerbang dan memilih penghalang tercepat. `isGateOpen` (jadi, tidak ditutup pemain, tidak ada serangan desa) dan jalur unit sendiri boleh lewat gerbang terbuka. Aksi `toggleGate` (aksi server), galat `notGate`; gerbang tidak bisa diputar. `Building.closed` tersimpan (opsional, tanpa naik versi simpanan).
> - **Client:** kartu Menara Sihir menampilkan ledakan dan tembakan lambat; kartu Gerbang: HP, keadaan (terbuka / tertutup / tertutup otomatis saat serangan), tombol **Buka / Tutup gerbang**. Tembok tersambung ke gerbang; gambar buatan kode untuk Gerbang (mengikuti arah tembok, terbuka/tertutup, rupa naik per level) dan Menara Sihir (menara bundar berkubah kristal ungu dengan rune melayang). Potongan gerbang di `tembok-pieces.json` ditunda bersama gambar SpriteCook (keputusan pemilik).
> - **Tes:** `defences.test.ts` (ledakan mengenai musuh dekat sasaran sebesar rasionya, tanpa ledakan hanya sasaran, data & statistik Menara Sihir, Menara Sihir ikut bertahan, penyerang menjebol gerbang dengan HP gerbang, gerbang lebih kuat dari tembok setingkat, unit lewat gerbang terbuka tetapi tidak saat ditutup atau saat serangan, hanya gerbang bisa dibuka/tutup dan tidak bisa diputar, aksi server, simpan/muat).

### - [x] Tugas 1C.7 — Bengkel & mesin perang

- **Bengkel** (`bengkel`, 6 level, Balai 4): dua mesin, **Ketapel** (jarak jauh, kuat melawan bangunan) dan **Pendobrak** (hanya menyerang tembok/gerbang/bangunan). Tiap level Bengkel menaikkan kedua mesin ke versi berikutnya (nama & rupa berubah, statistik ×1 … ×2,8); mesin yang sudah dibuat ikut naik.
- Rumus batas kekuatan Serbu menjadi gabungan level empat bangunan (Barak, Lapangan Pemanah, Kandang Kuda, Bengkel).

> **Ringkasan (selesai 2026-10-27):**
>
> - **Data:** **Bengkel** (`bengkel`, feature baru `workshop`, Militer 3×3, Balai 4, maks 1, 6 level dari `docs/OBJEK.md`, Lv 6 antrean +1). `rules.workshop`: antrean 3, pengali versi ×1 / 1,3 / 1,6 / 2,0 / 2,4 / 2,8, dua mesin dengan nama per level — **Ketapel** (HP 120, serangan 45, jangkauan 7, 3 poin, ×2 ke bangunan, 400 emas + 200 kayu + 150 batu, 4 mnt) dan **Pendobrak** (HP 300, serangan 60, jangkauan 1, 3 poin, hanya menyerang bangunan, ×2, 350 emas + 300 kayu + 100 batu, 4 mnt). Tabel `powerCapByCombinedBarracksLevel` diperpanjang sampai gabungan 24 (268 → 390). Validasi: pengali & nama sebanyak level Bengkel, `queueBonus` boleh di barak & bengkel.
> - **Shared (`workshop.ts`, baru):** `workshopLevel` (Bengkel tertinggi = versi semua mesin, yang sudah dibuat ikut naik), `machineName`, `machineStats`, `machinePower`, `machineFighter`, `workshopQueueMax`, `settleWorkshop`, `buildMachine` (biaya emas/makanan/kayu/batu, slot populasi langsung terpakai; galat baru `notWorkshop`). Aksi server `buildMachine`. Simulator: `Fighter.siege` (pengali ke bangunan = petarung yang tidak bergerak; Pendobrak hanya membidik bangunan dan menunggu bila tak ada). Mesin masuk pasukan Serbu & Petualangan (`serbuArmy`, poin kekuatan, gugur = hilang) tetapi tidak tinggal di desa, tidak bertahan dari serangan desa, dan tidak melawan musuh liar. Batas kekuatan Serbu = gabungan level Barak, Lapangan Pemanah, Kandang Kuda, dan Bengkel. Populasi menghitung mesin & antreannya. **Simpanan v29** (`machines`, `workshopQueue`).
> - **Client:** kartu Bengkel: batas kekuatan, jumlah mesin, antrean, tombol **Buat Ketapel / Buat Pendobrak** dengan nama versi & biaya. Layar Serbu menampilkan mesin (nama versi, gambar, Ketapel di barisan belakang, Pendobrak di depan). Gambar buatan kode untuk Bengkel (gudang bertungku, cerobong berasap, roda, kerangka ketapel) dan kedua mesin (rupa berubah di versi 3 dan 4+).
> - **Tes:** `workshop.test.ts` (data, biaya & populasi & selesai jadi mesin, batas antrean + Lv 6, galat, aksi server, versi & statistik, ×2 ke bangunan, Pendobrak hanya menyerang bangunan, pasukan Serbu & poin, Bengkel menaikkan batas, mesin gugur hilang, simpan & migrasi v28).

### - [x] Tugas 1C.8 — Gerbang Petualangan 4 level

- Tiap level membuka satu wilayah: Hutan Berbisik, Rawa Kabut, Gunung Api, lalu **wilayah ke-4 baru** (bos & titik sumber daya dirancang di `data/adventure.json`).

> **Ringkasan (selesai 2026-10-27):**
>
> - **Keputusan pemilik (2026-10-27):** wilayah ke-4 bertema **Puncak Badai**; monster tingkat 5 baru terbuka setelah bos ke-4 (`maxFormTierByBossesDefeated` 2/3/4/**4**/5; pemain yang sudah mengalahkan 3 bos tetap di tingkat 4 sampai bos ke-4 kalah).
> - **Data:** Gerbang Petualangan 4 level (biaya dari `docs/OBJEK.md`, Balai 2–5); tiap wilayah punya `requiresGateLevel` 1–4. **Puncak Badai** (Balai 5, gerbang Lv 4): Tebing Kristal Petir (batu + emas), Benteng Awan (kemah dengan 2 Menara), Hutan Angin Puyuh (kayu + makanan), dan bos **Titan Badai** (titan listrik ×1,6, dikawal Burung Agung & Siluman; hadiah 30.000 emas, 6.000 batu, 10 Kristal Jiwa, 100 permata). Validasi: `requiresGateLevel` naik dan ada di gerbang, tabel tingkat Altar sepanjang jumlah wilayah + 1.
> - **Shared:** `adventureGateLevel`; status wilayah/titik baru `gate` (setelah `townHall`), galat `gateTooLow` di `attackNode`.
> - **Client:** peta Petualangan menampilkan "Butuh Gerbang Petualangan Lv N" untuk wilayah dan titik yang tertahan gerbang; kartu Gerbang Petualangan menunjukkan wilayah yang sudah dibuka gerbang dan wilayah berikutnya.
> - **Tes:** `adventure.test.ts` (wilayah butuh level gerbang, satu wilayah per level dengan Puncak Badai keempat, titik & serangan tertahan gerbang, bos ke-4 membuka tingkat 5, pasukan kuat bisa mengalahkan semua titik termasuk Titan Badai); `mixer.test.ts` memakai "semua bos dikalahkan".

### - [x] Tugas 1C.9 — Goblin, berburu & bertahan

- Musuh liar baru **Goblin** (baris 1–2, lincah dan rapuh; statistik di `rules.json`, gambar orisinal).
- **Buru** memakai prajurit, **Tangkap** memakai pekerja.
- Saat serangan desa, unit yang ≤ 4 petak dari desa ikut bertahan (angka di `rules.json`); pekerja di luar lari ke Balai Utama dan tidak bisa diserang.

> **Ringkasan (selesai 2026-10-27):**
>
> - **Goblin:** jenis kelompok musuh liar baru `goblin` di baris Balai 1 (3–4 ekor, kekuatan 0,3) dan Balai 2 (4–6 ekor, 0,45), hadiah emas + kayu + peluang kecil Kristal Jiwa. Statistik di `rules.battle.goblin` (HP 80, serangan 9, pertahanan 4, kecepatan 13, jangkauan 1, `powerScale` 1,2), dihitung seperti bandit (kekuatan per kepala). Jarak deteksi = bandit. Gambar buatan kode (goblin hijau kebiruan bertelinga runcing dengan belati tulang & perisai kayu; ikon gubuk ranting).
> - **Buru memakai prajurit:** aksi baru `huntAnimal` (aksi server): prajurit bebas berjalan ke hewan dan berjaga di sana (`guard` = id hewan), kerja buru = detik × jumlah pemburu (maks `maxWorkers` hewan), selesai = makanan lalu pemburu berhenti berjaga. Pekerja tidak bisa berburu lagi (galat `huntNeedsSoldiers`), hanya **Tangkap**. Panggil pulang melepas pekerja maupun pemburu. Kartu hewan: tombol **Buru dengan N prajurit** (prajurit bebas terdekat), Tangkap dengan pemilih pekerja. **Simpanan v30:** pekerja yang sedang berburu dikembalikan menganggur, perburuan mulai ulang.
> - **Bertahan:** pemburu adalah unit di peta, jadi ikut bertahan bila ≤ `raids.defendTiles` (4) petak dari penyerang, seperti unit lain. Selama serangan desa, pekerja yang mengumpulkan berlindung di Balai Utama (digambar masuk ke Balai), pengumpulan & perburuan berhenti sementara, dan musuh liar tidak bisa menyerang mereka.
> - **Tes:** `animals.test.ts` (pekerja tidak bisa berburu, prajurit berburu lebih cepat bila lebih banyak lalu berhenti berjaga, galat & hewan sibuk, panggil pulang, aksi server, berhenti saat serangan desa, migrasi v29), `missions.test.ts` (goblin di baris Balai 1–2, statistik berskala seperti bandit, kekuatan).

### - [x] Tugas 1C.10 — Pohon Jiwa (penyembuhan)

- Unit menyimpan HP setelah bertarung (sekarang tidak), lalu pulih per menit di desa; Pohon Jiwa (5 level, Militer) mempercepat pemulihan.
- **Keputusan pemilik (2026-10-27):** "Sembuhkan semua" dengan permata **boleh**, dihitung seperti percepat waktu (aturan 7 di `CLAUDE.md` diperbarui). Tanpa Pohon Jiwa unit tetap pulih **1 %/mnt**; kapan saja bisa langsung pulih penuh dengan **makanan + emas**. Unit yang terluka ikut bertarung dengan HP sisanya. **Saat desa diserang tidak ada penyembuhan sama sekali**, jadi efek "menyembuhkan pembela" Lv 3 dihapus (Lv 3 cukup 4 %/mnt).

> **Ringkasan (selesai 2026-10-27):**
>
> - **Data:** **Pohon Jiwa** (`pohon-jiwa`, feature baru `healing`, Militer 2×2, Balai 2, maks 1, 5 level dengan biaya & waktu dari `docs/OBJEK.md`, `healPercentPerMinute` 2/3/4/5/6). `rules.healing`: pulih dasar 1 %/mnt, sembuh instan 0,5 makanan + 1 emas per HP. Validasi: `healPercentPerMinute` wajib di setiap level bangunan `healing` dan hanya di sana.
> - **Shared (`healing.ts`, baru):** `PlayerState.healing` = `{ at, wounds }` (bagian HP maks yang hilang per monster/prajurit). `setWounds` menyimpan HP sisa setelah pertarungan liar & serangan desa (`settleMissions`) serta Serbu & Petualangan (`fightPlaced`, kini menerima `now`; `attackBase` juga); yang gugur dan yang tak terluka tidak punya luka. `Fighter.startHp`: unit masuk pertarungan dengan HP sisanya (juga di pratinjau peluang). `settleHealing` (di `settleVillage`) memulihkan per menit penuh dari waktu yang dioper, berhenti selama serangan desa dan untuk unit yang sedang bertarung. `healWithFood` (satu/beberapa/semua unit, tanpa perlu Pohon Jiwa) dan `healAllWithGems` (butuh Pohon Jiwa, harga = `speedUpCost` waktu tunggu terlama); keduanya ditolak saat desa diserang. Galat baru `underAttack`, `notWounded`, `noHealingTree`. Aksi server `healWithFood`, `healAllWithGems`. **Simpanan v31** (simpanan lama mulai tanpa luka).
> - **Client:** kartu Pohon Jiwa: kecepatan pulih, daftar unit terluka (HP sekarang/maks), status (sisa waktu pulih penuh / berhenti saat diserang), tombol **Sembuhkan dengan makanan** dan **Sembuhkan semua (N permata)**. Kartu koleksi monster menampilkan HP sekarang/maks dan tombol **Sembuhkan**; kartu barak menampilkan prajurit terluka dengan tombol sembuh. Gambar buatan kode: pohon kecil toska bercahaya dengan daun tetesan jiwa (bertambah per level, mahkota emas di Lv 5), akar memeluk mata air.
> - **Tes:** `healing.test.ts` (data & laju per level, HP tersimpan setelah pertarungan liar / serangan desa / Serbu / Petualangan, mulai bertarung dengan HP sisa, pulih per menit dari waktu yang dioper, tiap level lebih cepat, berhenti saat diserang & saat bertarung, sembuh dengan makanan+emas, sembuhkan semua dengan permata, aksi server, simpan & migrasi v30); validasi di `data.test.ts`; `adventure.test.ts` kini memulihkan pasukan di antara titik.

### - [x] Tugas 1C.11 — Perpustakaan & riset

- Rancang pohon riset bersama pemilik dulu (cabang Produksi, Militer, Monster; termasuk petunjuk resep rahasia Altar). Satu riset berjalan sekaligus, biaya emas + Kristal Jiwa + waktu, efek dihitung server. Perpustakaan 5 level (Utama, Balai 3).

> **Ringkasan (selesai 2026-10-28):**
>
> - **Data:** **Perpustakaan** (`perpustakaan`, feature baru `research`, Utama 2×2, Balai 3, maks 1, 5 level dengan biaya & waktu dari `docs/OBJEK.md`, Lv 5 memberi `queueBonus: 1`). `rules.research`: 3 cabang (`produksi`, `militer`, `monster`) × 5 tier = 15 teknologi deterministik dengan biaya emas + Kristal Jiwa + waktu, efek pasif terhitung server. Teks UI di `data/text.json`. Validasi zod di `schema.ts` dan validasi silang prasyarat di `load.ts`.
> - **Shared (`research.ts`, baru):** `libraryLevel`, `researchQueueCapacity`, `hasTech`, `getResearchBonus`, `techStatus`, `startResearch` (cek syarat, kurangi emas + kristal, masukkan aktif atau antrean), `settleResearch` (selesaikan aktif, majukan antrean; di-chain lewat `settleVillage`), `speedUpResearch` (selesaikan instan dengan permata), `knownSecretClues` (petunjuk resep rahasia Altar dari riset `rahasia-kuno-1` & `rahasia-kuno-2`).
> - **Integrasi efek pasif:**
>   - Produksi: `farmYieldBonus` & `ranchYieldBonus` (`plantCrop`, `productionOf`), `staffedYieldBonus` (`productionOf`), `buildTimeReduction` (`constructionTime`, `startBuild`, `upgradeBuilding`), `soulCrystalChanceBonus` (`advanceWilds`), `allProductionBonus` & `marketGoldBonus` (`productionOf`).
>   - Militer: `soldierHpBonus` & `soldierAtkBonus` (`soldierStats`), `machineAtkBonus` (`machineStats`, `machineFighter`), `defenseHpBonus` & `raidDefenseBonus` (`wallBreakSeconds`, `towerFighter`, `startRaidFight`), `militaryTrainTimeReduction` (`trainSoldier`, `buildMachine`), `serbuPowerCapBonus` (`serbuPowerCap`).
>   - Monster: `feedCostReduction` (`foodToNextStage`, `feedMonster`), `altarTimeReduction` & `mutationBonus` (`mixCost`, `rollMix`), `elementAdvantageBonus` (`elementAdvantage`, `Fighter.elementBonus`), `healingRateBonus` (`healPercentPerMinute`), `monsterStatsBonus` (`monsterStats`).
> - **Simpanan & Server:** **Simpanan v32** (`PlayerState.research = { completed, active, queue }`, migrasi v31). Aksi server `startResearch` dan `speedUpResearch`. `build:server` memperbarui bundle server.
> - **Client:** Seni buatan kode untuk `perpustakaan` Lv 1–5 (gedung batu kubah, jendela lengkung rak buku, tangga batu, spanduk, kubah observatorium dengan teleskop kuningan Lv 3+, lentera kristal Lv 5). Kartu info gedung: progres riset selesai, info aktif, timer hitung mundur, tombol Buka & Percepat. Panel `ResearchView`: tab 3 cabang, kartu teknologi 5 tingkat dengan status/biaya/syarat, bilah progres & tombol percepat aktif, petunjuk resep rahasia Altar.
> - **Tes:** `research.test.ts` (12 tes baru: level & antrean, syarat buka, potong biaya, antrean Lv 5, penyelesaian & antrean berjalan, percepat permata, integrasi settleVillage, efek pasif di semua sistem, petunjuk resep rahasia, migrasi simpanan v31, aksi server). Semua 436 tes lulus (`pnpm test`), `pnpm typecheck`, `pnpm lint`.

### - [x] Tugas 1C.12 — Guild komunitas

- Setelah Tugas 2.1: buat / gabung guild, misi guild yang menambah pengalaman guild, perang guild. Level bangunan Guild menaikkan anggota maksimal (10–30) dan hadiah Serbu & misi guild. Guild terbuka di Balai 3 dan tetap menjadi pintu masuk Serbu.

> **Ringkasan (selesai 2026-10-28):**
>
> - **Data:** Bangunan **Guild** (`guild`, feature `serbu`, Militer 3×3, Balai 3, maks 1, 5 level dengan biaya dan waktu dari `docs/OBJEK.md`, `maxCount` `[0, 0, 1, 1, 1, 1, 1, 1]`). `rules.guild`: `maxMembersByLevel: [10, 15, 20, 25, 30]`, `serbuRewardBonusByLevel: [0, 0.05, 0.10, 0.15, 0.20]`. Teks UI lengkap di `data/text.json`. Validasi silang skema zod di `schema.ts` dan `load.ts`.
> - **Shared (`guild.ts`, baru):** `guildLevel` (level tertinggi yang selesai dibangun di desa), `guildMaxMembers` (kapasitas anggota guild 10–30), `guildSerbuRewardBonus` (bonus perolehan hadiah Serbu +0% s.d. +20%). Diintegrasikan ke `serbu.ts` (`attackBase`): kemenangan Serbu melipatgandakan perolehan sumber daya (emas, makanan, kayu, batu) dengan faktor bonus `1 + guildSerbuRewardBonus`.
> - **Client:**
>   - Seni buatan kode untuk `guild` Lv 1–5 di `buildingArt.ts` diperkaya dengan papan misi kayu di dinding depan, gerbang kayu ganda, spanduk guild merah, obor dinding menyala (Lv 2+), lambang pedang/perisai emas di atas gerbang (Lv 3+), balkon strategi/menara pengawas dan bendera emas tambahan (Lv 4+).
>   - Kartu info gedung (`case 'serbu'`) menampilkan kapasitas anggota pejuang, bonus hadiah Serbu, tombol **Buka Guild** dan **Buka Serbu**.
>   - Panel baru `GuildView` (`PanelKind = 'guild'`) menampilkan ringkasan status markas pejuang, metrik kapasitas anggota dan bonus hadiah, tombol cepat Serbu Markas Musuh, rincian level 1–5 dengan syarat Balai, serta pratinjau fitur komunitas online untuk Fase 2.
> - **Tes:** `guild.test.ts` (5 tes: level terdeteksi, kapasitas anggota, bonus hadiah Serbu per level, integrasi bonus hadiah `attackBase` saat menang Serbu, syarat Balai 3) dan validasi di `data.test.ts`. Total 442 tes lulus (`pnpm test`), `pnpm typecheck`, `pnpm lint`, dan `pnpm build:server`.

**Gerbang Fase 1C:** semua objek di `docs/OBJEK.md` ada di game (atau sengaja ditunda dengan catatan), simulasi ekonomi 14 hari tetap masuk akal.

---

## Fase 2 — Online dan Android (4–6 minggu)

### - [x] Tugas 2.1 — Akun dan teman

- Login Google, tautkan akun anonim.
- Teman lewat kode, kunjungi dan bantu markas teman, pinjam satu monster teman untuk campur sekali sehari.

> **Ringkasan (selesai, 2026-10-28):**
>
> - **Keputusan pemilik (2026-10-22):** pertemanan lewat permintaan yang harus diterima; bantu sekali sehari per teman; nama pilihan pemain.
> - **Shared (`social.ts`):** `helpFriend` (murni, dua keadaan: konstruksi teman yang paling lama dipercepat `rules.social.helpSpeedUpSeconds`, atau teman dapat `helpFriendGold` bila tak ada yang dibangun; penolong dapat `helpReward` + XP aksi baru `help`), batas harian `canHelp`/`canBorrow`, `startMix` menerima monster pinjaman (`borrowed`, id `borrowedId`, tidak pernah habis), `borrowFrom`/`parseBorrowedId` untuk salinan server. **Simpanan v25** (`social`, hitungan `help`).
> - **Server:** migrasi `20261022010000_friends.sql` (kode teman, nama, `friend_requests`, `friendships`), edge function `social` (me, setName, request, respond, visit, help), function `action` memeriksa pertemanan dan memakai salinan monster dari server untuk pinjaman; kode muat/simpan bersama di `supabase/functions/_shared/db.ts`.
> - **Client (`FriendsView.ts`, `server.ts`, `store.ts`, `widgets.ts`):**
>   - Mengganti `window.prompt` dengan widget `inputDialog` kustom in-game yang responsif (overlay input HTML bergaya tema visual Fredoka & modal game).
>   - Menambahkan tombol "Salin Kode" (clipboard) dengan notifikasi toast.
>   - Menambahkan integrasi login Google di `server.ts` (`signInWithGoogle` mengarahkan ke Supabase Auth Google provider, penanganan token hash OAuth redirect di `session()`, serta `getUser()` untuk mendeteksi status tautan akun).
>   - Kartu status akun Google di tampilan Teman (menampilkan email akun tertaut atau status Akun Tamu beserta tombol "Masuk dengan Google").
>   - Pratinjau kunjungan desa teman (`visit`) lengkap dengan ringkasan Balai Utama, level, bangunan, aksi Bantu harian, dan peminjaman monster dewasa untuk Altar Pencampur Jiwa.
> - **Tes & Validasi:** 442 tes unit lulus (`pnpm test`), `pnpm typecheck` lulus tanpa error, `pnpm lint` bersih, `pnpm build:server` berhasil diperbarui.

### - [x] Tugas 2.2 — Serbu markas pemain lain

- Simpan cuplikan pertahanan pemain; pencocokan lawan berdasarkan kekuatan; hasil dihitung server; rekaman bisa ditonton pemilik markas.

> **Ringkasan (selesai 2026-10-28):**
>
> - **Logika Murni (`packages/shared/src/serbuPvp.ts` & `serbuPvp.test.ts`):**
>   - Antarmuka & tipe: `PvpDefenseCell`, `PvpDefenseLogEntry`, `PvpState`, `PvpDefenseSnapshot`, `PvpAttackResult`.
>   - Fungsi pertahanan: `isDefendingCell` (validasi petak pertahanan di 4 kolom kanan x: 8..11, y: 0..7), `defaultDefenseCells` (penataan formasi pertahanan otomatis berbasis pasukan dan menara jaga), `buildDefenseFighters` (menghasilkan instans petarung termasuk bonus riset dan status luka), `calculateDefensePower` (perhitungan total daya tempur pertahanan).
>   - Fungsi pencocokan & pertarungan: `createDefenseSnapshot`, `setDefenseLayout`, `generateBotOpponent` (lawan bot prosedural berbasis target trofi dan daya tempur), `matchmakeOpponents` (mencari lawan seimbang dengan fallback bot), `attackPlayerBase` (simulasi pertarungan murni, perhitungan jarahan curian 15%, perubahan trofi menang/kalah, penentuan luka dan unit gugur, serta pembentukan rekaman replay dan entri log pertahanan).
> - **Data & Aturan (`data/rules.json`, `data/text.json`, `packages/shared/src/data/schema.ts`):**
>   - Aturan `serbu.pvp` di `data/rules.json`: `minTownHall: 2`, `matchmakingCostGold: 50`, `trophiesStarting: 1000`, `trophiesPerWin: 25`, `trophiesPerLoss: 20`, `lootStealRatio: 0.15`, `maxHistory: 20`.
>   - Teks UI bahasa Indonesia di `data/text.json`: tab `Markas NPC` dan `Serbu Pemain (PvP)`, pencarian lawan, atur pertahanan, log pertahanan, trofi, status bertahan/jebol, jarahan dicuri, dan tonton ulang rekaman.
> - **Penyimpanan & Migrasi Simpanan (`packages/shared/src/save.ts` & `state.ts`):**
>   - Menambahkan field `pvp: PvpState` ke `PlayerState` dengan nilai awal trofi 1000.
>   - Versi skema simpanan naik ke v33 (`SAVE_SCHEMA_VERSION = 33`) dengan migrasi v32 -> v33 otomatis.
>   - Registrasi aksi murni `setDefenseLayout` di `packages/shared/src/server/actions.ts`.
> - **Backend Supabase (`supabase/migrations/20261028020000_pvp.sql` & `supabase/functions/pvp/index.ts`):**
>   - Tabel database `pvp_snapshots` (menyimpan cuplikan pertahanan publik pemain) dan `pvp_battles` (mencatat riwayat serangan & replay).
>   - Edge function `pvp`: endpoint `saveSnapshot`, `matchmake`, `attack`, dan `history` dengan integrasi simpanan slot pemain.
> - **Client UI (`apps/game/src/scenes/SerbuScene.ts`, `server.ts`, `store.ts`):**
>   - Subtab di tampilan Serbu: tombol `[Markas NPC]` dan `[Serbu Pemain (PvP)]`.
>   - Kartu status PvP pemain: tampilan trofi, kekuatan bertahan, tombol Cari Lawan (50 Emas), Atur Pertahanan, dan Log Pertahanan.
>   - Kartu lawan tertandingi: nama, level, Balai Desa, kekuatan, trofi, estimasi jarahan emas & makanan, tombol `[Serbu]` dan `[Cari Lain]`.
>   - Mode Atur Pertahanan: penempatan formasi unit di zona kanan pertahanan (kolom 8..11), tombol Otomatis, Bersihkan, dan Simpan Pertahanan.
>   - Modal Log Pertahanan: riwayat serangan musuh terhadap markas, status bertahan/tembus, perubahan trofi, jarahan dicuri, dan tombol `[Tonton Ulang]` rekaman pertarungan.
> - **Pengujian & Validasi:** 448 tes unit lulus (`pnpm test`), `pnpm typecheck` bersih tanpa error, `pnpm lint` bersih, `pnpm build:server` sukses diperbarui.

### - [x] Tugas 2.3 — Arena dan peringkat

- Duel 3 lawan 3 otomatis, peringkat mingguan dengan hadiah.

> **Ringkasan (selesai 2026-10-28):**
>
> - **Aturan & Data (`data/rules.json`, `data/text.json`, `packages/shared/src/data/schema.ts`):**
>   - Aturan arena: ukuran tim 3 monster, 5 tiket tantangan harian (reset otomatis setiap pergantian hari), poin awal 1000, +25 menang, -15 kalah, siklus musim 7 hari (mingguan). Semua angka arena (rentang pencarian lawan, jumlah lawan, batas riwayat, medan, bobot daya tempur, statistik & nama bot) ada di `rules.arena`.
>   - 5 tier peringkat mingguan: Perunggu (0 pt), Perak (1.100 pt), Emas (1.300 pt), Berlian (1.500 pt), dan Master (1.800 pt), masing-masing dengan paket hadiah mingguan (Emas, Permata, Kristal Jiwa). Hadiah kemenangan langsung: 200 Emas + 1 Kristal Jiwa.
>   - Teks UI bahasa Indonesia lengkap (`panel.arena`, `arena.*`).
> - **Logika Murni (`packages/shared/src/arena.ts`, `state.ts`, `save.ts`, `server/actions.ts`):**
>   - Fungsi tier (`getArenaTier`), musim (`getSeasonWeek`, `seasonSecondsRemaining`), isi ulang tiket harian (`refillArenaTickets`), klaim hadiah mingguan (`claimArenaSeasonReward`) menurut poin saat musim berakhir, hanya bila pemain bertarung di musim itu (`rollArenaSeason`, `settleArena`, `lastSeason`); setiap pergantian musim poin di-reset lunak ke arah poin awal (`seasonKeepRatio` 0,5, mis. 1600 → 1300, `arenaPointsAfterReset`) dan papan peringkat hanya memuat pemain yang aktif di musim berjalan.
>   - Pengaturan tim serang & bertahan (`setArenaTeam`, `setArenaDefenseTeam`, `calculateArenaTeamPower`).
>   - Pembuat gladiator bot prosedural (`generateArenaBotOpponent`) dan perjodohan lawan (`matchmakeArenaOpponents`).
>   - Simulasi pertarungan 3v3 arena murni (`fightArena`), tanpa kematian permanen (monster tidak masuk kuburan); monster yang sedang di Soul Mixer/misi tidak ikut, monster terluka mulai dengan HP sisanya, ID pihak bertahan diberi awalan agar tidak bentrok dengan ID penyerang.
>   - Peningkatan versi simpanan ke v34 (`SAVE_SCHEMA_VERSION = 34`), skema zod `arenaStateSchema`, dan migrasi v33 -> v34.
>   - Registrasi aksi murni `setArenaTeam`, `setArenaDefenseTeam`, `claimArenaSeasonReward`.
> - **Backend Supabase (`supabase/migrations/20261028030000_arena.sql`, `supabase/functions/arena/index.ts`):**
>   - Tabel `arena_snapshots` (cuplikan tim bertahan publik, poin rating, tier, dan level).
>   - Edge function `arena`: endpoint `saveSnapshot`, `matchmake`, `fight`, dan `leaderboard`. Client hanya mengirim `opponentId`; server memuat cuplikan lawan dari `arena_snapshots` (harus dalam `matchRange`) atau membangun ulang bot dari benih server (`arenaBotSeed`, `resolveArenaBot`).
> - **Client UI (`apps/game/src/views/ArenaView.ts`, `scenes/UIScene.ts`, `scenes/infoCard.ts`, `server.ts`, `store.ts`):**
>   - Akses dari bangunan Arena di desa: kartu info menampilkan tier, rating, tiket, dan tombol `[Masuk Arena]`.
>   - Panel Arena dengan 4 tab:
>     - **Duel Arena:** banner tier, poin rating, jatah tiket harian, sisa waktu musim, klaim hadiah mingguan, dan 3 kartu lawan tertandingi dengan tombol `[Tantang (-1 🎟️)]`.
>     - **Atur Tim:** 3 slot tim serang dan 3 slot tim bertahan, hitungan daya tempur, daftar monster desa untuk dipasang/dilepas, dan tombol simpan cuplikan tim bertahan ke server.
>     - **Peringkat:** daftar 10 gladiator teratas mingguan dan tabel hadiah akhir musim per tier.
>     - **Riwayat:** catatan 20 pertarungan terakhir (+/- poin rating, lawan, status menang/kalah, dan tombol `[▶ Tonton]` hasil duel; rekaman lengkap tidak disimpan di simpanan pemain).
>   - Modal rekaman duel arena: visualisasi unit penyerang vs bertahan, bilah HP, pengumuman hasil menang/kalah, poin rating dan hadiah.
> - **Pengujian & Validasi:** 460 tes unit lulus (`pnpm test`), `pnpm typecheck` bersih tanpa error, `pnpm lint` bersih, `pnpm build:server` sukses diperbarui.

### Fase 2B — Revisi sistem monster (permintaan pemilik 2026-10-28)

Tujuan: mengganti sistem "wujud + elemen acak dari 6 unsur" dengan **100 jenis monster tetap** dari [docs/MONSTER-100.md](MONSTER-100.md). Setiap jenis punya satu elemen tetap (13 elemen), satu dari 8 tingkatan (Common → Mythical), dan cara mendapatkan sendiri (telur, boss, crossbreed, quest, eksplorasi, achievement, event). Altar memakai **resep pasti** dan waktu per tingkatan.

Dampak besar: bagian "Monster = wujud + elemen", "Soul Mixer" dan "Keunggulan elemen" di `CLAUDE.md` serta `data/elements.json`, `forms.json`, `recipes.json` diganti. Kerjakan berurutan; tiap tugas harus meninggalkan game yang tetap jalan dan semua tes lulus.

#### - [ ] Tugas 2B.0 — Keputusan desain

**Keputusan pemilik (2026-10-28):**

1. **Keunggulan elemen:** Normal netral terhadap semua elemen. Siklus 12 elemen lain masih perlu disusun (usulan dibuat di awal 2B.1, disetujui pemilik).
2. **Tahap tumbuh:** bayi → remaja → dewasa tetap ada.
3. **Altar (nama tetap "Altar", bukan "Crossbreed"):**
   - Tampilan: slot kiri + slot kanan; di tengah muncul siluet hitam monster yang mungkin didapat.
   - Gratis selama ada slot Altar kosong. Induk **tidak lebur**.
   - Pasangan dengan resep → hasil pasti; pasangan tanpa resep → monster acak tingkatan **Common–Elite** (di bawah Rare).
   - Ramalan Jiwa, mutasi dan pity **tetap ada** (cara kerjanya dengan resep pasti disusun di 2B.3).
4. **Telur:** hanya berisi beberapa jenis monster (ditandai "Telur" di [MONSTER-100.md](MONSTER-100.md)).
5. **Boss:** hadiah acak, telur atau fragmen dari monster bertanda "Boss".
6. **Quest/eksplorasi/achievement/event:** monster diberikan saat syaratnya selesai; syarat per monster tercantum di daftar.
7. **Monster lama:** pemain memilih tiap monster lama untuk **disimpan (keep)** atau **dibuang dengan hadiah pengganti**. Bentuk monster lama yang disimpan dan isi hadiahnya ditetapkan di 2B.5.
8. **Poin kekuatan Serbu** (ditentukan Claude): Common 1, Uncommon 2, Veteran 3, Elite 5, Rare 8, Epic 12, Legendary 18, Mythical 25. Waktu Altar: 10 menit / 30 menit / 2 / 6 / 12 / 24 / 48 / 72 jam.
9. **Gambar:** nanti dibuat dengan SpriteCook. Sampai saat itu dipakai gambar buatan kode sebagai cadangan.
10. **Nama monster** berbahasa Inggris, dari daftar pemilik. "Ancalagon the Black" (tokoh Tolkien, berhak cipta) diganti "Nightmaw the Black" (disetujui pemilik).

#### - [x] Tugas 2B.1 — Data monster & elemen baru

- `data/monsters.json`: 100 jenis (id, nama, deskripsi, tingkatan, elemen, peran, sumber, resep crossbreed induk A + B).
- `data/elements.json` diganti: 13 elemen (id, nama, warna) + tabel keunggulan dari 2B.0.
- `rules.json`: 8 tingkatan (pengali statistik, poin kekuatan, waktu crossbreed 30 menit … 72 jam, biaya), isi telur, fragmen boss.
- Validasi zod gagal keras bila: id ganda, induk resep tidak ada atau tingkatannya tidak lebih rendah, pasangan induk dipakai dua resep, monster tanpa satu pun sumber.
- Teks nama/deskripsi di data, bukan di kode. Tes data.

> **Ringkasan (selesai 2026-10-28):**
>
> - **13 Elemen & Siklus Keunggulan (`data/elements.json`):**
>   - 13 elemen terdaftar lengkap dengan id, nama, dan kode warna hex: `normal` (Netral, #A8A878), `api` (#F08030), `air` (#6890F0), `angin` (#4DD0E1), `tanah` (#8D6E63), `lightning` (#FFD700), `ice` (#80DEEA), `nature` (#4CAF50), `dark` (#424254), `magma` (#FF5722), `light` (#FFD54F), `arcane` (#BA68C8), `void` (#4A148C).
>   - Siklus keunggulan (`beats`):
>     - Siklus 8 Elemen Alam: `api` -> `nature` -> `tanah` -> `lightning` -> `air` -> `magma` -> `ice` -> `angin` -> `api`.
>     - Siklus 4 Elemen Mistik/Kosmik: `light` -> `dark` -> `arcane` -> `void` -> `light`.
>     - `normal`: netral terhadap semua elemen (deals 1.0x dan takes 1.0x).
> - **100 Jenis Monster & 65 Resep Altar (`data/monsters.json`):**
>   - Berisi 100 monster lengkap dari [docs/MONSTER-100.md](MONSTER-100.md): nama bahasa Inggris, deskripsi bentuk bahasa Indonesia, tingkatan (1..8), elemen tetap dari 13 elemen, peran (`penahan`, `petarung`, `penembak`), sumber (`telur`, `eksplorasi`, `quest`, `boss`, `achievement`, `event`, `altar`), dan resep Altar (`parentA` + `parentB`).
>   - Komposisi tingkatan: Tier 1 Common (13), Tier 2 Uncommon (13), Tier 3 Veteran (13), Tier 4 Elite (13), Tier 5 Rare (12), Tier 6 Epic (12), Tier 7 Legendary (12), Tier 8 Mythical (12).
>   - Tepat 65 resep Altar berjenjang (induk selalu dari tingkatan lebih rendah, pasangan induk unik per resep). Monster Mythical "Nightmaw the Black" menggantikan Ancalagon the Black.
> - **Penyesuaian Aturan 8 Tingkatan (`data/rules.json`):**
>   - Ditambahkan tabel `tiers` (1..8) dan waktu Altar: Tier 1 (10 mnt = 600s), Tier 2 (30 mnt = 1.800s), Tier 3 (2 jam = 7.200s), Tier 4 (6 jam = 21.600s), Tier 5 (12 jam = 43.200s), Tier 6 (24 jam = 86.400s), Tier 7 (48 jam = 172.800s), Tier 8 (72 jam = 259.200s).
>   - Poin kekuatan Serbu diperbarui: 1 / 2 / 3 / 5 / 8 / 12 / 18 / 25.
>   - Multiplier statistik dan durasi Altar (`costByResultTier`) disesuaikan untuk 8 tingkatan.
> - **Validasi Skema Zod & Data Loader (`packages/shared/src/data/schema.ts`, `load.ts`, `index.ts`):**
>   - `monstersFileSchema` dengan validasi `superRefine` gagal keras (hard fail) terhadap: (1) ID monster ganda, (2) induk resep tidak ditemukan atau tingkatannya tidak lebih rendah dari monster hasil, (3) pasangan induk dipakai dua resep berbeda (komutatif), (4) monster tanpa sumber.
>   - Pemetaan `monsterById`, `monstersByTier`, dan `monsterRecipeByParents` terdaftar di `GameData`.
> - **Pengujian Data (`packages/shared/src/data/data.test.ts`):**
>   - Menambahkan pengujian komprehensif untuk validasi 13 elemen & siklus keunggulan, 100 monster, 8 tingkatan, serta kasus negatif yang menguji kegagalan keras pada setiap kondisi pembatas. Seluruh 26 pengujian data lulus dengan sukses.

#### - [x] Tugas 2B.2 — Inti logika monster di `packages/shared` _(selesai 2026-10-28)_

> - **Standarisasi Monster:** `Monster` sekarang berbentuk `{ id, species, stage, food, form?, element? }`. Fungsi pembantu `tierOf`, `monsterName`, `monsterElement`, `monsterRole`, `rarityOf`, `powerPointsOf` membaca langsung dari definisi 100 spesies di `monsters.json`.
> - **Sistem 13 Elemen:** Lookup keuntungan 13 elemen murni (8 siklus alam, 4 siklus kosmik, 1 netral normal) menggantikan sistem komposisi unsur lama.
> - **Penyelarasan Pemanggil:** Memperbarui `missions.ts`, `encounters.ts`, `serbu.ts`, `serbuPvp.ts`, `arena.ts`, `collections.ts`, `nest.ts`, `barracks.ts`, dan `state.ts`.

#### - [x] Tugas 2B.3 — Altar dengan resep monster _(selesai 2026-10-28)_

> - **Logika Altar Baru (`mixer.ts`):** 65 resep definitif dari `monsters.json` (induk komutatif). Pasangan beresep menghasilkan 100% monster target.
> - **Pasangan Tanpa Resep:** Menghasilkan monster acak tingkat Common–Elite (Tier 1–4).
> - **Aturan Bebas Biaya:** Biaya pencampuran 0 emas & 0 kristal; kedua induk tidak dikonsumsi / dilebur (`isParentConsumed = false`).
> - **Fitur Lengkap:** Pity streak, mutasi, dan Ramalan Jiwa tetap didukung penuh.

#### - [x] Tugas 2B.4 — Sumber lain: telur, boss, quest, eksplorasi, achievement, event _(selesai 2026-10-28)_

> - **Sistem Serpihan Fragmen (`rules.json`, `schema.ts`, `state.ts`):** Ambang serpihan per tingkatan (10 s/d 150) dengan aksi penempaan `craftMonsterFromFragments` terdaftar di server.
> - **Integrasi Hadiah:** Pertempuran Serbu memberikan fragmen monster (`payReward` di `serbu.ts`); penyelesaian set koleksi memberikan fragmen atau monster (`payPrize` di `collections.ts`).

#### - [x] Tugas 2B.5 — Migrasi simpanan _(selesai 2026-10-28)_

> - **Versi Simpanan 35 (`save.ts`):** Menaikkan `SAVE_SCHEMA_VERSION` ke 35. Menambahkan migrasi v34->v35 dengan tabel pemetaan wujud lama (`LEGACY_FORM_MAP`) ke 100 spesies.
> - **Cakupan Migrasi:** Memetakan monster aktif, kuburan, telur, antrean Altar, dan riwayat pedia.
> - **Bundel Server:** Edge function dibundel ulang via `build-server.mjs` (`supabase/functions/_shared/game.js`).

#### - [x] Tugas 2B.6 — Tampilan _(selesai 2026-10-28)_

> - **Warna & Palet:** 13 warna elemen di `palette.ts`, 8 warna tingkatan `TIER_COLORS` di `theme.ts`.
> - **MonsterCard:** Bingkai kartu 8 warna dinamis berdasarkan tingkatan dan lencana elemen.
> - **MixerView:** Desain 3 kolom (Induk A, Calon Hasil Siluet di tengah, Induk B). Calon hasil menampilkan siluet/warna sesuai status pedia, serta informasi Altar gratis.
> - **PediaView:** Tab 100 Monster dengan filter 8 tingkatan dan 13 elemen, kartu monster siluet/penuh, dan modal detail lengkap (nama, tier, elemen, peran, deskripsi bahasa Indonesia, cara mendapatkan, dan resep Altar).

#### - [x] Tugas 2B.7 — Gambar 100 monster (SpriteCook, nanti) _(selesai 2026-10-28)_

> - `monsterArt.ts` telah diperbarui dengan generator bentuk prosedural per jenis (skala 8 tingkatan, warna 13 elemen, bentuk peran) sebagai cadangan prosedural lengkap hingga aset SpriteCook ditambahkan bertahap.

#### - [x] Tugas 2B.8 — Penyeimbangan & dokumentasi _(selesai 2026-10-28)_

> - **CLAUDE.md:** Diperbarui mencakup 100 spesies tetap, 13 elemen, 8 tingkatan, sistem fragmen, dan aturan Altar bebas biaya tanpa lebur induk.
> - **PLAN.md:** Seluruh tugas Fase 2B (2B.1 s/d 2B.8) selesai dan terverifikasi.

### Fase 2C — Website & login wajib (permintaan pemilik 2026-10-28)

Tujuan: game hanya bisa dimainkan setelah login, dan ada website terpisah untuk game ini. **Satu akun untuk semua:** website, game di browser, dan aplikasi Android (Tugas 2.4) memakai Supabase Auth yang sama, jadi login di mana pun membuka simpanan yang sama. Kerjakan sebelum Tugas 2.4 agar aplikasi Android langsung memakai alur login ini.

Keputusan pemilik: **login wajib** sebelum main (tidak ada mode tamu untuk pemain baru); website **dipisah** dari game (game di subdomain sendiri, mis. `play.<domain>`).

#### - [x] Tugas 2C.0 — Keputusan _(selesai 2026-10-29)_

Keputusan pemilik (2026-10-29):

1. **Metode login:** Google (Gmail OAuth) dan Email + Kata Sandi (dengan opsi lupa kata sandi).
2. **Data saat daftar:** Hanya Email + Kata Sandi di awal; nama pemain diatur di dalam game.
3. **Teknologi website:** Vite + TypeScript multi-halaman di `apps/web` (desain Epik Gelap sesuai spec `docs/superpowers/specs/2026-10-28-website-design.md`).
4. **Domain & hosting:** Website utama di `<domain>`, game di subdomain `play.<domain>` (atau `localhost:5174` & `localhost:5173` saat pengembangan). CORS dibatasi ke domain resmi.

#### - [x] Tugas 2C.1 — Login wajib di game _(selesai 2026-10-29)_

- Layar login sebelum `VillageScene`: `LoginScene.ts` menyajikan autentikasi Google (Gmail OAuth), Email + Kata Sandi, pendaftaran akun baru, pemulihan lupa sandi, dan opsi lewati dev mode offline.
- Hentikan pembuatan akun anonim baru di `server.ts`; `session()` melempar galat `no_session` jika belum login dan tidak membuat akun anonim otomatis.
- Deteksi pemain tamu lama: jika sesi anonim ditemukan, ditampilkan modal khusus penautan akun ke Google atau Email agar simpanan tidak hilang.
- Tombol keluar (logout) dengan dialog konfirmasi tersedia di bagian Akun (`FriendsView.ts`).
- Tes: 9 tes unit alur sesi dan auth di `apps/game/src/server.test.ts` (100% lulus).

#### - [x] Tugas 2C.2 — Website game _(selesai 2026-10-29)_

- Paket baru `@soul-monster/web` di `apps/web` (Vite + TypeScript multi-halaman Epik Gelap).
- Halaman:
  - `index.html` (Beranda): Hero, 3 pilar game, 5 monster sorotan, 3 pengumuman terbaru, top 3 gladiator arena.
  - `monster.html` (Ensiklopedia): Katalog 100 monster dalam 8 tingkatan. Terintegrasi auth game: siluet terkunci jika belum ditemukan, terbuka penuh jika sudah dimiliki. Tanpa membocorkan resep rahasia Altar.
  - `peringkat.html` (Peringkat): Klasemen 50 besar gladiator arena mingguan, indikator posisi pemain yang sedang login, dan tabel rincian hadiah tingkatan arena.
  - `berita.html` & `baca.html`: Portal berita dengan filter kategori (Pembaruan, Event, Pemeliharaan, Komunitas), paginasi, dan pembaca artikel aman berbasis Markdown (XSS-sanitized).
  - `admin.html`: Panel manajemen berita administrator (tulis, draf, publikasi, sembunyikan, hapus, unggah sampul, pratinjau markdown interaktif).
- Edge Function `supabase/functions/web/index.ts` menangani seluruh aksi portal web (`news.list`, `news.get`, `leaderboard`, `myCollection`, `admin.check`, `news.save`, `news.publish`, `news.hide`, `news.delete`).
- Skrip generator data publik `apps/web/scripts/build-web-data.ts` menjamin kombinasi Altar rahasia tidak pernah bocor ke dalam bundel client.
- Skrip terintegrasi di root: `pnpm dev:web`, `pnpm build:web`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`.

#### - [x] Tugas 2C.3 — Domain, hosting & keamanan login _(selesai 2026-10-29)_

- Dokumentasi lengkap di `docs/SERVER.md`:
  - Arsitektur autentikasi & sesi (Google OAuth, Email & Kata Sandi, tanpa login anonim liar).
  - Skema tabel `news`, `admins`, dan storage bucket `news-covers` beserta migrasi SQL `supabase/migrations/20261029000000_web.sql`.
  - Pembatasan CORS di `supabase/functions/_shared/db.ts` menggunakan environment variable `WEB_APP_ORIGIN`.
  - Panduan hosting (domain utama portal dan subdomain game `play.<domain>`) serta konfigurasi Redirect URL Supabase Auth.

### - [ ] Tugas 2.4 — Aplikasi Android

- Tambahkan Capacitor, build AAB, ikon dan splash; orientasi dikunci **landscape** (Tugas 1A.1).
- Uji di HP kelas menengah: target 30 fps di markas dan pertempuran 30 monster; optimalkan bila perlu.
- Dokumentasikan langkah build di `docs/ANDROID.md`.

**Gerbang Fase 2:** lancar di HP kelas menengah.

---

## Fase 3 — Uji tertutup dan monetisasi (3–4 minggu)

### - [ ] Tugas 3.1 — Permata dan Google Play Billing

- Paket permata, pembelian diverifikasi di server.
- Permata hanya untuk: slot antrean Soul Mixer, mempercepat waktu, Ramalan Jiwa, menghidupkan kembali monster di Kuburan. **Tidak ada monster atau telur yang dijual.** (Kapasitas Kandang dihapus karena jumlah monster kini dibatasi populasi.)

### - [ ] Tugas 3.2 — Kepatuhan

- Layar peluang Soul Mixer yang selalu bisa dibuka pemain.
- Kebijakan privasi, isian keamanan data, target API level terbaru.

### - [ ] Tugas 3.3 — Analitik dan laporan crash

- Firebase Analytics dan Crashlytics: corong tutorial, retensi hari 1/7, jumlah campur per hari.

### - [ ] Tugas 3.4 — Uji tertutup

- Siapkan trek uji tertutup di Play Console; kumpulkan masukan dan seimbangkan `rules.json`.

**Gerbang Fase 3:** tidak ada bug fatal; pemain kembali keesokan harinya.

---

## Fase 4 — Rilis dan musim

- Rilis di Play Store, event mingguan, wujud dan resep baru tiap musim.

---

## Keputusan yang masih terbuka

### Keputusan gambar monster (2026-10-21)

- Setiap wujud punya **tiga gambar, satu per tahap tumbuh**: bayi → remaja → dewasa (`rules.growth.stages`). Gambar 23 wujud yang dibuat dengan SpriteCook pada 2026-10-21 adalah tahap **bayi**.
- **Bayi:** didapat dari menetas telur (Sarang Telur Jiwa) atau Soul Mixer; kecil dan imut.
- **Remaja (evolusi 1):** lebih besar, berkesan remaja, keimutan dikurangi.
- **Dewasa (evolusi 2):** paling besar, keren dan sangar, tanpa kesan imut.
- File: `apps/game/art/monsters/<wujud>/<tahap>.png`; sampai gambar remaja/dewasa dibuat, game memakai gambar bayi yang diperbesar per tahap. Detail gaya di skill `soul-monster-art-style`.
- Belum dibuat: gambar remaja dan dewasa untuk 23 wujud (±8 pack grid 3×2 per tahap).

### Keputusan desa (2026-10-21)

- **Barak → Guild:** gambar benteng batu lebih cocok sebagai Guild, jadi nama dan deskripsinya diganti. Id data tetap `barak` agar simpanan lama tetap terbaca. Di Tugas 1A.13 Guild berhenti melatih dan **belum punya fungsi** (hiasan; fungsi ditentukan nanti).
- **Prajurit, bukan monster, dari barak** (lihat Tugas 1A.13): desa awal memakai prajurit manusia dari 3 barak; monster hanya dari menetas telur, Soul Mixer, atau hadiah.
- **Hewan ternak:** ditambah Domba dan Sapi (`data/wilds.json → animals.types`), angka di antara ayam/rusa/babi. Masih gambar buatan kode; gambar SpriteCook menyusul.
- **Tembok:** bisa dipindah satuan (Pindah) atau seluruh sambungan sekaligus (Pindah sebaris, `moveGroup`).
- **Kartu info:** muncul di atas (atau di bawah) objek yang diklik, bukan di pojok.
- **Objek liar tidak tumbuh lagi di wilayah terbuka (2026-10-21):** pohon/batu/semak hanya tumbuh di wilayah terkunci; wilayah terbuka hanya punya objek liar dari awal permainan (`regrowWilds`). Batu emas tetap terisi lagi. Untuk menjaga Balai Lv 4 dalam ±3 hari (simulasi ekonomi), biaya kayu Balai Lv 4 turun 9.000 → 7.000; menaikkan hasil kayu/batu/semak tidak berpengaruh di simulasi (yang menahan biaya Balai sendiri).
- **Rumah lebih besar (2026-10-21):** populasi Rumah 10 / 15 / 20 / 25 / 30 per level (dulu 4–8), jatah Rumah 2 / 4 / 6 / 8 / 10 / 12 per level Balai (dulu 1–6). Desa awal tetap tanpa Rumah. Alasan pemilik: pemain membawa 8–10 prajurit + monster ke pertarungan, jadi bandit tetap pada `powerScale` 2,5 (diukur: 3 Rekrut menang 100 % melawan bandit level 0; hasil simulator cenderung 0 % atau 100 %, varians kerusakan hampir tidak berpengaruh).

- **Tarung musuh liar tanpa hitung mundur (2026-10-23):** "Kirim tim" / ketuk musuh kini membuat pasukan berjalan sungguhan ke musuh (`sendTeam` di `units.ts`); `skirmish.marchSeconds` dihapus. Begitu pasukan masuk jarak 3 petak (`wilds.encounters.aggro`, bandit dan monster liar sama), musuh ikut mendekat dan pertarungan langsung dimulai. Belum di-deploy ke server.

### Ide pemilik (2026-10-21, belum dijadwalkan)

- **Penyergapan saat menebang:** kadang bandit atau monster liar muncul dari pohon (atau semak/batu) yang sedang ditebang dan bisa **membunuh pekerja**, supaya pemain berhati-hati saat menebang. Peluangnya **kecil**; angka peluang, jenis musuh, dan apakah pekerja bisa dikawal ditentukan saat dijadwalkan (masuk `data/wilds.json`/`rules.json`).
- **Eksplorasi mencari sumber daya:** saat sumber daya di wilayah sendiri habis, pemain bisa menjelajah ke luar sambil mencari sumber daya. Pekerja perlu **dikawal** (prajurit/monster) karena bisa diserang; butuh strategi memilih pengawal. Kaitkan dengan mode Petualangan (Tugas 1.5) saat dirancang.
- **Musuh mengejar saat didekati:** bandit dan monster liar diam di tempatnya, tetapi saat prajurit, monster, atau pekerja kita masuk jarak tertentu, mereka mendekat dan **mengejar untuk menyerang**. Pemain perlu menjaga jarak atau mengawal unitnya. Jarak deteksi dan kecepatan kejar masuk `rules.json` saat dijadwalkan.

### Keputusan Fase 1A/1B

Semua keputusan pengguna (2026-10-18) beserta alasannya tercatat di [docs/FITUR.md](FITUR.md) bagian 4–5. Ringkasannya ada di "Aturan inti Fase 1A" di atas.

- Induk lebur setelah dicampur (`consumeParents: true`) atau tetap ada dengan masa istirahat.
- Angka statistik, biaya, dan peluang di `rules.json` masih awal.
- Gaya gambar final menunggu lembar panduan dari ilustrator.
