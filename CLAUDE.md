# Soul Monster — panduan proyek untuk Claude Code

Game strategi koleksi monster terinspirasi Social Empires. Fitur inti: **Soul Mixer**, mencampur dua monster dewasa menjadi monster baru (bayi) lewat resep rahasia atau hasil acak terarah. Dibuat di **browser dulu**, lalu dibungkus menjadi aplikasi **Android** dengan Capacitor.

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
    elements.json         66 elemen: komposisi unsur, siklus keunggulan, resep elemen rahasia
    forms.json            23 wujud monster per tingkat dan peran
    recipes.json          resep rahasia tingkat monster
    rules.json            semua angka penyeimbangan (peluang, biaya, statistik, batas)
    buildings.json        bangunan desa, desa awal, wilayah (plot)
    wilds.json            alam liar: pohon/batu/semak, hewan, musuh liar, Kuburan
    text.json             semua teks UI (bahasa Indonesia)
  packages/shared/src/    logika murni: elemen, mixer, pertumbuhan, pertarungan, ekonomi
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

Setelah mengubah kode, selalu jalankan `pnpm test` dan `pnpm lint` sebelum menyatakan tugas selesai.

## Aturan wajib

1. **Jangan menulis angka penyeimbangan di kode.** Peluang, biaya, waktu, statistik, batas kekuatan, dan sebagainya selalu dibaca dari `data/rules.json`. Kalau butuh angka baru, tambahkan ke `rules.json`.
2. **Logika game di `packages/shared` harus murni dan deterministik.** Tidak boleh memakai `Math.random()`, `Date.now()`, DOM, atau Phaser. Keacakan lewat RNG berbenih (seeded) yang dioper sebagai parameter; waktu dioper sebagai parameter.
3. **Validasi data saat dimuat** dengan zod. Data tidak valid harus gagal keras dengan pesan jelas.
4. **Setiap fungsi logika baru wajib punya tes.** Untuk peluang, pakai tes Monte Carlo (misalnya 100.000 percobaan) dengan toleransi yang wajar.
5. **Kode berbahasa Inggris, teks yang dilihat pemain berbahasa Indonesia.** Nama elemen, wujud, dan teks UI diambil dari data, bukan ditulis ulang di kode.
6. **Server adalah sumber kebenaran (mulai tugas 1.6).** Hasil acak, saldo, timer, dan hasil pertarungan dihitung di server; client hanya meminta dan menampilkan.
7. **Tidak ada monster yang bisa dibeli dengan uang asli.** Monster hanya lahir dari menetas telur (telur awal, Sarang Telur Jiwa), Soul Mixer, atau hadiah — tidak dari barak maupun toko (telur tidak dijual dengan uang asli maupun permata). Barak melatih prajurit manusia, bukan monster (Tugas 1A.13). Permata hanya untuk: buka slot, mempercepat waktu, Ramalan Jiwa, dan menghidupkan kembali monster yang mati di Kuburan.
8. **Aset gambar:** boleh gambar buatan kode, ilustrator, atau generator (mis. SpriteCook), asal **orisinal** dan mengikuti skill `soul-monster-art-style`. Jangan memakai gambar, karakter, atau aset dari game lain (termasuk meniru gaya khas Social Empires secara persis). Aset yang belum dibuat tetap memakai gambar buatan kode sebagai cadangan.
9. Setelah tugas selesai, centang tugas itu di `docs/PLAN.md` dan tulis ringkasan singkat perubahan.

## Ringkasan aturan game (detail angka di `data/`)

### Monster = wujud + elemen + tahap tumbuh

- **Wujud** tingkat 1–5: hewan kecil (kucing, anjing, landak...) → hewan liar → pemburu & makhluk gaib (elang, hantu...) → makhluk perkasa (naga...) → legenda (naga purba, titan...). Lihat `forms.json`.
- **Elemen** disusun dari 6 unsur dasar: api, air, tanah, angin, cahaya, kegelapan. Setiap elemen punya `composition` (daftar unsur). Jumlah unsur = tingkat elemen. Lihat `elements.json`.
- **Tahap tumbuh:** bayi → remaja → dewasa, naik dengan diberi makanan. Statistik dikali pengali tahap. Hanya dewasa yang bisa jadi induk.
- **Kelangkaan** dari jumlah unsur elemen: 1 = biasa, 2 = langka, 3 = epik, 4+ = legenda; wujud tingkat 5 atau elemen rahasia selalu legenda.
- **Batas elemen per wujud:** wujud tingkat N hanya boleh memiliki elemen dengan unsur ≤ `rules.mixer.maxElementUnitsByFormTier[N]`.

### Soul Mixer (urutan perhitungan)

1. Terbuka saat Balai Utama mencapai level `rules.mixer.unlockTownHallLevel`. Kedua induk harus dewasa.
2. **Resep monster rahasia** (`recipes.json`): pasangan wujud+elemen tertentu → hasil pasti.
3. **Wujud hasil:** tingkat dasar = tingkat induk tertinggi, lalu diacak: sama / naik / turun / mutasi menurut `rules.mixer.formTierOdds`. Dibatasi tingkat maksimum dari jumlah bos Petualangan yang dikalahkan. Wujud dipilih acak dari tingkat itu.
4. **Elemen hasil:**
   - Cek pasangan elemen rahasia (`elements.json → secretRecipes`) dengan peluangnya.
   - Selain itu, gabungkan unsur kedua induk (union). Peluang: elemen gabungan penuh / salah satu elemen induk / elemen dari sebagian unsur gabungan (`rules.mixer.elementOdds`).
   - Jika unsur melebihi batas wujud, buang unsur secara acak sampai memenuhi batas.
   - Elemen rahasia tidak pernah didapat lewat pencarian komposisi biasa.
5. **Mutasi:** wujud naik satu tingkat dan elemen mendapat satu unsur dasar tambahan acak.
6. **Pity:** setiap `rules.mixer.pity.streak` campuran berturut-turut tanpa hasil epik ke atas, peluang mutasi bertambah.
7. Hasil menetas sebagai **bayi** setelah waktu campur selesai.
8. **Ramalan Jiwa:** hasil diacak dan dikunci saat pencampuran disiapkan; pemain bisa membayar permata untuk melihatnya, lalu memilih lanjut atau batal (induk dan emas kembali).

### Keunggulan elemen

Siklus dasar ada di `elements.json → beats`. Untuk penyerang A dan bertahan D: skor = jumlah pasangan unsur (a, d) di mana a mengalahkan d, dikurangi pasangan di mana d mengalahkan a. Pengali kerusakan = `clamp(1 + skor × advantageStep, advantageMin, advantageMax)` dari `rules.battle`.

### Pertarungan

- **Serbu (utama):** hingga `rules.battle.maxUnits` unit (monster dan prajurit), ditempatkan pemain di petak medan, dibatasi poin kekuatan (`rules.battle.powerPoints` per tingkat wujud, batas naik bersama gabungan level tiga barak prajurit). Pertempuran otomatis dan deterministik (RNG berbenih) agar bisa diputar ulang dan diverifikasi server.
- **Petualangan:** wilayah berisi titik sumber daya dan bos; bos yang dikalahkan menaikkan tingkat hasil maksimum Soul Mixer.
- **Arena:** mode sampingan 3 lawan 3.

## Dokumen desain lengkap

Desain lengkap ada di dokumen "Rencana Game Soul Monster" milik pengguna. Jika ada aturan yang tidak jelas di sini atau di `data/`, tanyakan ke pengguna, jangan menebak.
