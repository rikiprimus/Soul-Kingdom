---
name: soul-monster-art-style
description: Panduan gaya seni Soul Monster. Pakai SETIAP KALI membuat, meminta (mis. lewat SpriteCook atau generator gambar), menggambar dengan kode, atau menilai aset visual game — bangunan isometrik, rintangan alam, hewan, monster, ikon, UI — dan sebelum memasang aset ke apps/game/art/. Berisi aturan perspektif dan titik jangkar, arah cahaya, palet, proporsi, keterbacaan di HP horizontal, konvensi nama file, dan langkah pnpm atlas.
---

# Gaya seni Soul Monster

Tujuan: desa isometrik yang **cerah, hangat, dan mudah dibaca di HP horizontal** — terasa seperti game pembangun desa kasual (sekelas Social Empires), tetapi **semua aset orisinal**. Jangan meniru aset, karakter, logo, atau gaya khas game lain secara persis (CLAUDE.md aturan 8).

## 1. Perspektif dan ukuran (wajib, kalau salah gambar tidak pas di ubin)

- Isometrik 2:1. Satu ubin dunia = **64 × 32 px** (`TILE_W`, `TILE_H` di `apps/game/src/art/iso.ts`).
- Semua aset digambar pada **2× ukuran dunia** (`BUILDING_RES = 2`). Jadi satu ubin di PNG = berlian **128 × 64 px**.
- Bangunan berukuran `n` ubin (`size` di `data/buildings.json`): berlian tapak di PNG = **n·128 × n·64 px**.
- **Titik jangkar:** ujung **bawah** berlian tapak berada **tepat di tengah sisi bawah gambar** (tanpa ruang kosong di bawah). Game menghitung sendiri pusat tapak dari situ.
- Lebar gambar = lebar berlian (n·128 px). Tinggi bebas (bangunan tinggi = gambar tinggi); sisakan ruang transparan seperlunya di atas.
- Latar **transparan** (PNG RGBA). Tanpa bayangan jatuh yang keluar dari tapak lebih dari ±¼ ubin.

| size | lebar PNG | tinggi berlian | contoh |
|---|---|---|---|
| 1 | 128 | 64 | Taman Bunga, Tembok, pohon/batu/semak, hewan |
| 2 | 256 | 128 | Pasar, Rumah, Tambang Emas, Penggilingan, Kuburan |
| 3 | 384 | 192 | Ladang, Kandang, Barak, Soul Mixer, Peternakan |
| 4 | 512 | 256 | Balai Utama |

## 2. Cahaya, bayangan, garis

- Cahaya dari **kiri atas**. Sisi kiri-depan dinding = warna dasar; sisi kanan-depan **20–30 % lebih gelap**; atap/permukaan atas **10–15 % lebih terang**.
- Garis tepi tipis, warna = warna isi digelapkan ±50 % (bukan hitam murni). Kira-kira 2 px pada PNG 2×.
- Bayangan kontak lembut di bawah bangunan/monster (elips hitam, opasitas ±20 %).
- Hindari detail lebih kecil dari ±3 px pada PNG 2× — akan hilang saat kamera diperkecil (zoom 0,6 di HP).

## 3. Palet

Pakai warna yang sudah ada agar aset baru menyatu dengan UI dan gambar buatan kode.

**Alam & bangunan** (`C` di `art/buildingArt.ts`): rumput `#6fbf4a`, daun `#3f9a45`, tanah `#8c5a32`, kayu `#a86b3c`, batu `#d9ccae` / gelap `#a99c82`, atap merah `#c94a3b`, atap biru `#3f6fb8`, atap cokelat `#6b4026`, emas `#ffcf40`, ungu `#8a5cd6`, air `#4fb3ff`.

**Unsur/elemen** (`art/palette.ts`): api `#ff6b35`, air `#3fa7ff`, tanah `#a8743f`, angin `#7fe0b0`, cahaya `#ffe066`, kegelapan `#7b4bb3`. Monster memakai warna unsur elemennya.

**Kelangkaan** (`ui/theme.ts`): biasa `#9aa0b4`, langka `#4fc3f7`, epik `#c77dff`, legenda `#ffc83d`.

**UI** (`ui/theme.ts`): panel `#2a2148`, panel terang `#3a2f63`, panel gelap `#1d1736`, garis `#4b3f7d`, aksen `#8a6cff`, baik `#3ccf91`, peringatan `#ffb347`, bahaya `#ff5c7a`, teks `#f4f0ff`, teks redup `#b4aad6`. Font: **Fredoka** (400/600/700).

**Musuh:** bandit memakai kain gelap + ikat kepala merah `#b8322a`; monster liar ditandai cincin merah `#d63c3c` di tanah (bukan warna tubuhnya).

## 4. Proporsi dan bentuk

- Bangunan: siluet jelas dan unik per jenis (bisa dikenali dari bentuk saja). Level lebih tinggi = sedikit lebih tinggi/megah, tambahan detail (bendera, menara, hiasan emas), **bukan** bangunan berbeda total.
- Monster: proporsi chibi (kepala besar, badan bulat), ramah. Tingkat 1 kecil dan imut → tingkat 5 besar dan megah. Peran terlihat: penahan kekar, petarung lincah, penembak ramping.
- **Tiga tahap per wujud, satu gambar per tahap** (keputusan pemilik 2026-10-21). Semua gambar monster yang sudah ada adalah tahap **bayi**.
  - **Bayi** (`bayi`): didapat dari menetas telur (Sarang Telur Jiwa) atau Soul Mixer. Kecil, chibi, sangat imut.
  - **Remaja** (`remaja`), evolusi pertama: lebih besar, terlihat seperti remaja; keimutan dikurangi (kepala lebih kecil, badan dan kaki lebih panjang).
  - **Dewasa** (`dewasa`), evolusi terakhir: paling besar, keren dan sangar, **tanpa kesan imut**.
  - Wujud, siluet dasar, dan arah hadap tetap sama di ketiga tahap agar evolusi mudah dikenali. Tubuh tetap abu netral (lihat bagian 5).
- Pekerja: manusia kecil dengan topi kuning; bandit: manusia dengan ikat kepala merah.
- Ikon UI: tebal, sederhana, terbaca pada 16–24 px.

## 5. Nama file dan pemasangan

1. Simpan PNG di `soul-monster-starter/apps/game/art/<atlas>/...`:
   - Bangunan, rintangan alam, hewan → atlas `buildings`: `art/buildings/<id>/lv<level>.png` (mis. `balai-utama/lv3.png`, `pohon/lv1.png`, `rusa/lv1.png`).
   - Varian keadaan: `art/buildings/<id>/lv<level>-<varian>.png` — varian yang dipakai game: `crop-growing`, `crop-ready` (Ladang; `lv<n>.png` = kosong), `ranch-<jumlah hewan>` (Peternakan; tanpa gambar ini hewan digambar kode di atas `lv<n>.png`).
   - **Tembok (dibangun sebaris):** bukan 16 gambar per sambungan, melainkan potongan `lv<n>-post`, `lv<n>-seg-xn/xp/yn/yp` yang disambung game. Minta satu gambar berisi tiang + ruas tembok lurus (dari kiri atas ke kanan bawah) per level, lalu `pnpm art:wall <gambar> apps/game/art/tembok-pieces.json apps/game/art/buildings/tembok` (atur kotak sel per level di config).
   - `id` = id di `data/buildings.json` / `data/wilds.json`.
   - **Monster** → atlas `monsters`: `art/monsters/<wujud>/<tahap>.png` (mis. `kucing/bayi.png`, `kucing/remaja.png`), `<wujud>` = id di `data/forms.json`, `<tahap>` = id di `rules.growth.stages`. Tubuh digambar **abu-abu netral tanpa warna** (hanya mata/mulut gelap); game mewarnainya dengan warna elemen. PNG persegi 256 px, kaki rata bawah, margin transparan ±4 % (tidak boleh menyentuh tepi). Tahap tanpa gambar memakai gambar `bayi` yang diperbesar.
2. **Normalisasi dulu** hasil generator: `pnpm art:iso <mentah.png> <ukuran ubin> apps/game/art/buildings/<id>/lv<n>.png` (dari `soul-monster-starter`). Skrip ini membuang alpha tipis, membersihkan warna tersembunyi di piksel transparan, mengukur berlian tapak, lalu menskalakannya tepat ke 2:1 (generator cenderung menggambar ±1,7:1) dengan ujung bawah di tengah bawah.
3. Jalankan `pnpm atlas` (dari `soul-monster-starter`). Ini menulis `apps/game/public/atlas/<atlas>.png/.json` dan `atlases.json`.
4. Game otomatis memakai frame atlas bila ada; level yang belum punya gambar memakai level di bawahnya, lalu gambar buatan kode sebagai cadangan.
5. Cek di browser (server `game` dari `.claude/launch.json`, ukuran 800×400): tapak pas di ubin, tidak melayang, terbaca saat diperkecil.

## 6. Saat meminta gambar ke generator (SpriteCook, dll.)

Pengaturan SpriteCook yang sudah terbukti (aset target Balai Utama Lv 1): `generate_game_art` dengan `pixel=false`, `model="gpt-image-2.5-flare"`, `resolution="1K"`, `quality="medium"`, `aspect_ratio="1:1"`, `bg_mode="transparent"`, palet dari bagian 3, ke proyek SpriteCook "Soul Monster" (8 kredit/gambar). Pakai aset yang sudah disetujui sebagai `style_asset_ids` agar bangunan lain seragam. Catat setiap aset di `apps/game/art/spritecook-assets.json` dan `apps/game/art/PROVENANCE.md`.


Sertakan: "isometric 2:1 game sprite, transparent background, cozy bright casual village builder style, soft light from top-left, thin dark-tinted outlines, no text, original design", ukuran PNG dari tabel di atas, dan warna dari palet. Minta beberapa level sekaligus dengan siluet yang sama agar seragam. Selalu periksa hasilnya terhadap aturan 1–4 sebelum dipasang.
