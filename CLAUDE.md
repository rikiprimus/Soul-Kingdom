# Soul Monster — panduan proyek untuk Claude Code

Game strategi koleksi monster terinspirasi Social Empires. Fitur inti: **Altar** (dahulu Soul Mixer), mencampur dua monster dewasa menjadi monster baru (langsung menetas menjadi bayi monster saat selesai) lewat resep rahasia atau hasil acak terarah. Dibuat di **browser dulu**, lalu dibungkus menjadi aplikasi **Android** dengan Capacitor.

Rencana kerja ada di `docs/PLAN.md`. Kerjakan **satu tugas per sesi**, sesuai nomor tugas yang diminta pengguna.

## Teknologi

- **Bahasa:** TypeScript (strict) di semua paket.
- **Game client:** Phaser 3 + Vite (`apps/game`).
- **Tampilan:** font Fredoka (`@fontsource/fredoka`, dimuat sebelum Phaser mulai); komponen UI `phaser3-rex-plugins` (panel gulir, tab, tooltip) dipasang saat pertama dibutuhkan; efek bawaan Phaser (postFX glow/shadow/bloom, partikel); atlas tekstur dari `apps/game/art/` lewat `pnpm atlas` (free-tex-packer).
- **Logika game bersama:** paket murni TypeScript tanpa Phaser/DOM (`packages/shared`). Dipakai client untuk tampilan dan server untuk perhitungan resmi.
- **Tes:** Vitest. Linting: ESLint + Prettier.
- **Package manager:** pnpm workspaces.
- **Backend (mulai Fase 1):** Supabase — Postgres, Auth, Edge Functions (Deno/TypeScript).
- **Android (Fase 2):** Capacitor.
- **Animasi monster (nanti):** animasi rangka Spine atau DragonBones; selama prototipe pakai bentuk sederhana buatan kode.

## Struktur folder

```
soul-monster/
  CLAUDE.md
  docs/PLAN.md            rencana tugas bertahap
  data/                   SATU-SATUNYA sumber angka & isi game
    monsters.json         100 monster tetap (8 tier: Common s/d Mythical), 65 resep Altar
    elements.json         13 elemen: 8 siklus natural, 4 siklus kosmik, 1 netral (normal)
    rules.json            semua angka penyeimbangan (peluang, waktu, statistik, batas, fragmen)
    buildings.json        bangunan desa, desa awal, wilayah (plot)
    wilds.json            alam liar: pohon/batu/semak, hewan, musuh liar, Kuburan
    text.json             semua teks UI (bahasa Indonesia)
  packages/shared/src/    logika murni: monster, elemen, mixer, pertumbuhan, pertarungan, ekonomi
  apps/game/src/          Phaser: scene, UI, penyimpanan lokal
  apps/game/art/          sumber PNG per atlas (buildings/, ui/, monsters/) → `pnpm atlas`
  apps/game/public/atlas/ atlas hasil kemasan (png + json Phaser 3)
  supabase/               migrasi dan edge functions (mulai Fase 1)
  .claude/skills/         skill Claude Code proyek (gaya seni + skill GameDev, lihat SOURCES.md)
  .claude/launch.json     server pratinjau `game` untuk panel browser
```

## Alat aset

- **Gambar:** SpriteCook (plugin Claude Code; pasang sekali per komputer: `claude plugin marketplace add https://github.com/SpriteCook/claude-plugin.git` lalu `claude plugin install spritecook@spritecook`, lalu masuk ke akun SpriteCook lewat `/mcp`). Ikuti skill `soul-monster-art-style`; catat aset di `apps/game/art/spritecook-assets.json` dan `PROVENANCE.md`.
- **Suara:** Ludo.ai, dibuat oleh pemilik dan dipasang di `apps/game/public/audio/` (lihat `docs/SUARA.md`). Generator gambar lain tidak dipakai kecuali pemilik meminta.

## Perintah

- `pnpm install` — pasang dependensi
- `pnpm dev` — jalankan game di browser
- `pnpm test` — jalankan semua tes
- `pnpm lint` — cek gaya kode
- `pnpm build` — build produksi
- `pnpm art:iso <mentah.png> <ukuran> <keluaran.png>` — normalisasi gambar isometrik hasil generator (alpha, berlian tapak 2:1, jangkar)
- `pnpm art:wall <lembar.png> <config.json> <folder>` — potong gambar tiang + ruas tembok menjadi potongan yang disambung game (lihat `apps/game/art/tembok-pieces.json`)
- `pnpm atlas` — kemas `apps/game/art/` menjadi atlas di `apps/game/public/atlas/`
- `pnpm sim:economy` — simulasi ekonomi 14 hari (`--seed`, `--days`, `--detail`)
- `pnpm build:server` — bundel `packages/shared` untuk edge function Supabase (lihat `docs/SERVER.md`)

Setelah mengubah kode, selalu jalankan `pnpm test` dan `pnpm lint` sebelum menyatakan tugas selesai.

## Aturan wajib

1. **Jangan menulis angka penyeimbangan di kode.** Peluang, biaya, waktu, statistik, batas kekuatan, dan sebagainya selalu dibaca dari `data/rules.json`. Kalau butuh angka baru, tambahkan ke `rules.json`.
2. **Logika game di `packages/shared` harus murni dan deterministik.** Tidak boleh memakai `Math.random()`, `Date.now()`, DOM, atau Phaser. Keacakan lewat RNG berbenih (seeded) yang dioper sebagai parameter; waktu dioper sebagai parameter.
3. **Validasi data saat dimuat** dengan zod. Data tidak valid harus gagal keras dengan pesan jelas.
4. **Setiap fungsi logika baru wajib punya tes.** Untuk peluang, pakai tes Monte Carlo (misalnya 100.000 percobaan) dengan toleransi yang wajar.
5. **Kode berbahasa Inggris, teks yang dilihat pemain berbahasa Indonesia.** Nama elemen, monster, dan teks UI diambil dari data, bukan ditulis ulang di kode.
6. **Server adalah sumber kebenaran (mulai tugas 1.6).** Hasil acak, saldo, timer, dan hasil pertarungan dihitung di server; client hanya meminta dan menampilkan.
7. **Tidak ada monster yang bisa dibeli dengan uang asli.** Monster hanya lahir dari menetas telur (telur awal, Sarang Telur Jiwa), Altar, atau hadiah/fragmen — tidak dari barak maupun toko (telur tidak dijual dengan uang asli maupun permata). Barak melatih prajurit manusia, bukan monster (Tugas 1A.13). Permata hanya untuk: buka slot, mempercepat waktu (termasuk "Sembuhkan semua" di Pohon Jiwa), Ramalan Jiwa, dan menghidupkan kembali monster yang mati di Kuburan.
8. **Aset gambar:** boleh gambar buatan kode, ilustrator, atau generator (mis. SpriteCook), asal **orisinal** dan mengikuti skill `soul-monster-art-style`. Jangan memakai gambar, karakter, atau aset dari game lain (termasuk meniru gaya khas Social Empires secara persis). Aset yang belum dibuat tetap memakai gambar buatan kode sebagai cadangan.
9. Setelah tugas selesai, centang tugas itu di `docs/PLAN.md` dan tulis ringkasan singkat perubahan.

## Ringkasan aturan game (detail angka di `data/`)

### Monster = spesies (100 jenis) + elemen + tingkatan (8 tier) + tahap tumbuh

- **100 Spesies Tetap:** 8 tingkat kelangkaan (1: Common, 2: Uncommon, 3: Veteran, 4: Elite, 5: Rare, 6: Epic, 7: Legendary, 8: Mythical). Lihat `data/monsters.json` dan `docs/MONSTER-100.md`.
- **13 Elemen:**
  - 8 Elemen Alam: Api → Es → Alam → Tanah → Petir → Air → Racun → Angin → Api.
  - 4 Elemen Kosmik: Cahaya → Kegelapan → Ruang → Waktu → Cahaya.
  - 1 Netral: Normal.
- **Tahap tumbuh:** bayi → remaja → dewasa, naik dengan diberi makanan. Statistik dikali pengali tahap. Hanya dewasa yang bisa jadi induk di Altar.
- **Sistem Fragmen (Serpihan Monster):** pemain dapat mengumpulkan pecahan monster (10 s/d 150 pecahan sesuai tier) dari pertempuran Serbu atau pencapaian koleksi untuk menempa monster langsung ke desa.

### Altar (Kawin Silang Monster)

1. Terbuka saat Balai Utama mencapai level `rules.mixer.unlockTownHallLevel`. Kedua induk harus dewasa.
2. **Gratis:** Kawin silang tidak memakan biaya emas atau kristal jiwa (biaya 0).
3. **Induk Tetap Ada:** Kedua induk **tidak dikonsumsi/dilebur**, tetap tinggal di desa pemain.
4. **Resep Definitif:** 65 resep kawin silang pasti di `data/monsters.json`. Jika pasangan induk cocok dengan resep, hasilnya 100% monster target.
5. **Pasangan Tanpa Resep:** Jika pasangan tidak memiliki resep terdaftar, menghasilkan monster acak tingkatan Common s/d Elite (Tier 1–4).
6. **Ramalan Jiwa:** pemain bisa membayar permata untuk mengintip hasil pencampuran di Altar sebelum menunggu waktu menetas selesai.

### Keunggulan elemen

Siklus ada di `elements.json → beats`.

- Siklus Alam (8 elemen): Api mengalahkan Es, Es mengalahkan Alam, Alam mengalahkan Tanah, Tanah mengalahkan Petir, Petir mengalahkan Air, Air mengalahkan Racun, Racun mengalahkan Angin, Angin mengalahkan Api (+20% kerusakan).
- Siklus Kosmik (4 elemen): Cahaya mengalahkan Kegelapan, Kegelapan mengalahkan Ruang, Ruang mengalahkan Waktu, Waktu mengalahkan Cahaya (+20% kerusakan).
- Siklus Alam vs Kosmik seimbang (1.0x). Normal netral (1.0x). Pengali diatur di `data/rules.json`.

### Pertarungan

- **Serbu (utama):** hingga `rules.battle.maxUnits` unit (monster dan prajurit), ditempatkan pemain di petak medan, dibatasi poin kekuatan (`rules.battle.powerPoints` per tingkat wujud, batas naik bersama gabungan level tiga barak prajurit). Pertempuran otomatis dan deterministik (RNG berbenih) agar bisa diputar ulang dan diverifikasi server.
- **Petualangan:** wilayah berisi titik sumber daya dan bos; bos yang dikalahkan menaikkan tingkat hasil maksimum Soul Mixer.
- **Arena:** mode sampingan 3 lawan 3.

## Dokumen desain lengkap

Desain lengkap ada di dokumen "Rencana Game Soul Monster" milik pengguna. Jika ada aturan yang tidak jelas di sini atau di `data/`, tanyakan ke pengguna, jangan menebak.
