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

## Fase 1B — Konten & retensi (4–5 minggu)

### - [ ] Tugas 1B.1 — Level & XP pemain

- Membangun, memanen, mengambil sumber daya, mengalahkan musuh, dan menetaskan memberi XP (angka di data).
- Naik level memberi hadiah sumber daya kecil.
- Pembatas bangunan tetap level Balai.

**Kriteria selesai:** tes untuk XP per aksi, naik level, dan hadiah; tampilan bilah XP di HUD.

### - [ ] Tugas 1B.2 — Misi, tutorial & bonus harian

- **Misi:**
  - rantai misi bertahap (tutorial sebagai misi awal);
  - target berbasis aksi (bangun X, panen Y, kalahkan Z);
  - hadiah dari data.
- **Bonus harian:**
  - siklus hadiah;
  - bila ada hari terlewat, siklus **tidak kembali ke awal dan tidak maju**: pemain melanjutkan dari hadiah berikutnya.

**Kriteria selesai:** tes untuk kemajuan misi, klaim hadiah, siklus bonus (termasuk hari terlewat), dan determinisme waktu.

### - [ ] Tugas 1B.3 — Sarang Telur Jiwa

- Telur didapat dari hadiah misi atau koleksi. **Tidak dijual** dengan uang asli maupun permata.
- Merawat telur lewat beberapa langkah bertimer, dengan biaya makanan per langkah (angka di data).
- Menetas acak: **minimal langka, kadang epik** (peluang di data).
- Butuh populasi saat menetas.

**Kriteria selesai:** tes untuk langkah dan timer, biaya, populasi penuh, dan sebaran kelangkaan (Monte Carlo).

### - [ ] Tugas 1B.4 — Koleksi set & Keajaiban

- **Set di Monsterpedia** (mis. semua wujud tingkat 1, semua elemen api): lengkap → hadiah (telur, Keajaiban, sumber daya).
- **Keajaiban:**
  - bangunan langka penghasil sumber daya besar berkala;
  - hanya dari hadiah koleksi set atau misi besar;
  - maksimal 1 per jenis.

**Kriteria selesai:** tes untuk deteksi set lengkap, klaim sekali, dan batas 1 Keajaiban per jenis.

### - [ ] Tugas 1B.5 — Putar bangunan & Gudang

- **Putar bangunan dan dekorasi** 2 arah (cermin gambar buatan kode).
- **Gudang:**
  - simpan dekorasi dan Keajaiban ke inventaris lalu pasang lagi;
  - hadiah dekorasi masuk gudang;
  - **monster tidak bisa disimpan**.

**Kriteria selesai:** tes untuk simpan dan pasang (posisi bebas, wilayah terbuka) dan putar tersimpan; tampilan cermin benar.

### - [ ] Tugas 1B.6 — Pulau tambahan

- Pulau bertema (gurun, salju) dibuka di Balai Lv tinggi.
- Tiap pulau punya:
  - pohon/batu khas;
  - musuh liar lebih kuat;
  - batas bangunan sendiri.
- **Sumber daya berbagi** dengan desa utama.
- Pindah pulau lewat peta dunia sederhana.

**Kriteria selesai:** tes untuk membuka pulau, batas bangunan per pulau, dan sumber daya bersama; perpindahan pulau berfungsi.

**Gerbang Fase 1B:** pemain punya alasan kembali besok: misi berikutnya, bonus harian, telur yang sedang dirawat, dan set yang hampir lengkap.

---

## Fase 1 (lanjutan) — Pertarungan dan server

### - [ ] Tugas 1.3 — Simulator pertarungan (shared)

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

### - [ ] Tugas 1.4 — Mode Serbu

- **Layar penempatan:**
  - seret monster ke petak;
  - penghitung poin kekuatan vs batas **gabungan ketiga barak**;
  - maksimal 30 monster;
  - cadangan.
- **Pemutaran:** dari log, kecepatan 1x/2x, tombol jurus saat pengukur penuh.
- **Lawan sementara:** markas NPC.

### - [ ] Tugas 1.5 — Mode Petualangan (dungeon)

- Peta wilayah dengan titik sumber daya, musuh, dan satu bos per wilayah; data di `data/adventure.json`.
- Mengalahkan bos:
  - menaikkan jumlah bos dikalahkan;
  - membuka tingkat Soul Mixer berikutnya.
- **Sumber permata gratis** dalam jumlah kecil (angka di data).

### - [ ] Tugas 1.7 — Serangan ke desa & pertahanan

- Musuh liar atau bandit kadang menyerang desa (jadwal dan kekuatan dari data).
- Monster pemain **melawan balik otomatis** saat musuh masuk wilayah atau mendekat.
- Menara dan tembok ikut bertahan.
- Monster yang kalah mati (masuk Kuburan).
- Memakai simulator Tugas 1.3.

**Kriteria selesai:** tes untuk jadwal serangan, siapa yang ikut bertahan, hasil deterministik, dan monster mati masuk Kuburan.

### - [ ] Tugas 1.6 — Server Supabase

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

**Gerbang Fase 1:** satu sesi 10 menit terasa lengkap: panen, kirim pekerja, campur, bertarung, upgrade.

---

## Fase 2 — Online dan Android (4–6 minggu)

### - [ ] Tugas 2.1 — Akun dan teman

- Login Google, tautkan akun anonim.
- Teman lewat kode, kunjungi dan bantu markas teman, pinjam satu monster teman untuk campur sekali sehari.

### - [ ] Tugas 2.2 — Serbu markas pemain lain

- Simpan cuplikan pertahanan pemain; pencocokan lawan berdasarkan kekuatan; hasil dihitung server; rekaman bisa ditonton pemilik markas.

### - [ ] Tugas 2.3 — Arena dan peringkat

- Duel 3 lawan 3 otomatis, peringkat mingguan dengan hadiah.

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

### Keputusan Fase 1A/1B

Semua keputusan pengguna (2026-10-18) beserta alasannya tercatat di [docs/FITUR.md](FITUR.md) bagian 4–5. Ringkasannya ada di "Aturan inti Fase 1A" di atas.

- Induk lebur setelah dicampur (`consumeParents: true`) atau tetap ada dengan masa istirahat.
- Angka statistik, biaya, dan peluang di `rules.json` masih awal.
- Gaya gambar final menunggu lembar panduan dari ilustrator.
