# Asal-usul gambar website

Website (`apps/web`) boleh memakai SpriteCook (keputusan pemilik 2026-10-29); game tetap memakai gambar buatan kode. Semua gambar orisinal dan mengikuti skill `soul-monster-art-style`. Desain halaman mengikuti `docs/web-design/target-mockup.webp`; desain sebelumnya diarsipkan di `docs/archive/web-v1-2026-10-29.zip`.

| File                                                    | Sumber                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `public/img/island.webp`, `island-640.webp`, `sky.webp` | SpriteCook (key art), lihat `spritecook-assets.json`         |
| `public/img/feature-*.webp`                             | SpriteCook (grid ilustrasi), lihat `spritecook-assets.json`  |
| `public/img/logo-small.webp`                            | SpriteCook (logo), lihat `spritecook-assets.json`            |
| `public/img/leaves.webp`                                | SpriteCook (dedaunan), lihat `spritecook-assets.json`        |
| `public/img/frame.webp`                                 | SpriteCook (bingkai berukir), lihat `spritecook-assets.json` |
| `public/img/shot-*.webp`                                | Tangkapan layar game (`apps/game`) mode offline              |
| `public/favicon.png`                                    | Salinan `apps/game/public/icons/icon-192.png`                |
| Ikon menu, lencana, dan bar statistik                   | SVG buatan kode (`src/ui/icons.ts`)                          |

Semua sumber mentah dari SpriteCook disimpan di `art/*-raw.png`. Pengaturan umum: `generate_game_art`, `pixel=false`, `model="gpt-image-2.5-flare"`, `resolution="1K"`, `quality="medium"`, `aspect_ratio="1:1"` (16:9 butuh render 2K = 14 kredit). Memakai acuan gaya (`style_asset_ids`) menggandakan biaya menjadi 16 kredit.

## Prompt (ringkas)

- **Key art** (`bg_mode="include"`, 8 kredit): desa di pulau melayang tampak isometrik 3/4 — balai utama beratap merah berhias emas, altar kristal ungu bercahaya, arena pasir bundar berpanji ungu-emas, rumah kecil, pohon, taman bunga, air terjun dari tepi pulau; monster chibi (slime air biru, rubah api, makhluk daun hijau, naga ungu kecil terbang); langit senja ungu dengan cahaya emas, pulau kecil di kiri-kanan, kilau sihir; tanpa teks/logo/UI; desain orisinal.
  - **Pulau** (`island.webp`): `remove_background` (1 kredit) → `art/island-cutout-raw.png`; hanya pulau utama dan naga yang disimpan, lalu dipangkas.
  - **Langit** (`sky.webp`): area pulau dihapus dari gambar asli, lubangnya diisi warna langit sekitar, lalu dihaluskan. Latar semua halaman.
- **Ilustrasi kartu fitur** (transparan, acuan gaya = key art yang diunggah, 16 kredit): grid 2×2 — desa dengan balai yang sedang dibangun (palu, perancah), rubah api dan naga biru kecil dengan hati merah muda di antaranya, naga ungu bercakar sihir melawan ksatria kecil berperisai, pulau kecil dengan air terjun dan peti harta (cadangan, belum dipakai).
- **Logo** (mode `ui`, transparan, 8 kredit): tulisan "SOUL MONSTER" dua baris, huruf serif emas tebal bergaris ungu gelap, kristal jiwa ungu di antara dua sayap emas di atas, kristal kecil di bawah, ukiran emas di kiri-kanan.
- **Dedaunan** (transparan, 8 kredit): rimbun daun hutan lebar dan sulur dengan bunga merah muda-ungu, masuk dari tepi kiri. Di website dicerminkan untuk sisi kanan dan diburamkan dengan CSS.
- **Bingkai** (mode `ui`, transparan, 8 kredit): bingkai panel emas mengkilap, sudut berukir, permata ungu di tengah atas dan bawah, tengah kosong. Diolah menjadi 9-slice (`public/img/frame.webp`, potongan 80 px) untuk kartu fitur, bar statistik, dan menu; sisi-sisinya diganti garis polos agar tidak melar.
