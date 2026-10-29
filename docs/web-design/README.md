# Desain website berikutnya

Acuan dari pemilik (2026-10-29): `target-mockup.webp`. Desain website saat ini diarsipkan di `docs/archive/web-v1-2026-10-29.zip` (isi `apps/web` tanpa `node_modules`, `dist`, `src/generated`, ditambah `data/text.json` pada saat itu).

Mockup memakai nama "Skyrealm" dan teks bahasa Inggris. Di website tetap dipakai **nama Soul Monster** dan **teks bahasa Indonesia dari `data/text.json`** (CLAUDE.md aturan 5); semua gambar orisinal (aturan 8).

## Ciri desain yang diminta

1. **Satu layar pembuka penuh:** langit senja ungu + awan memenuhi layar, pulau melayang besar di kanan (sudah ada: `apps/web/public/img/sky.webp`, `island.webp`), pulau kecil di kejauhan, dedaunan buram di tepi kiri/kanan depan (kedalaman).
2. **Header berbingkai ornamen:** logo game besar berhias (permata, sayap kecil) di kiri atas, menu dengan ikon kecil per item, tombol Masuk (bingkai gelap) dan Main Sekarang (emas) berbentuk pipih dengan ujung lancip dan permata kecil.
3. **Judul besar berhuruf serif emas** dua baris + garis pemisah berpermata + subjudul.
4. **Tombol ajakan besar** emas berujung lancip ("Mulai Petualangan ›") + dua lencana kecil (Gratis Dimainkan, Strategi RPG di Browser).
5. **Tiga kartu fitur berbingkai emas berukir** (Bangun, Kawin Silang, Bertarung), masing-masing dengan ilustrasi adegan sendiri di atas judul.
6. **Bar sumber daya** berbingkai (ikon emas, batu, makanan, kristal jiwa, permata) di bawah kartu, gaya HUD game.
7. **Petunjuk "gulir ke bawah"** dengan ikon tetikus kecil.

## Aset yang dibutuhkan

| Aset                                                                    | Cara                                                       | Perkiraan kredit SpriteCook |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------- |
| Langit + pulau besar                                                    | sudah ada                                                  | 0                           |
| Logo "Soul Monster" berhias                                             | SpriteCook mode `ui`                                       | 8                           |
| 3 ilustrasi kartu fitur (desa, dua monster + hati, monster vs pahlawan) | SpriteCook, satu grid 3 sel                                | 8                           |
| Ikon sumber daya                                                        | sudah ada di game (`apps/game/art/ui/icon-*.png`)          | 0                           |
| Dedaunan depan buram                                                    | SpriteCook, latar transparan                               | 8                           |
| Pulau kecil di kejauhan                                                 | potong dari `art/hero-raw.png`                             | 0                           |
| Bingkai ornamen kartu, tombol berujung lancip, garis berpermata         | CSS / SVG buatan kode                                      | 0                           |
| Huruf serif emas judul                                                  | font web (Cinzel atau sejenis, Google Fonts / @fontsource) | 0                           |

Status 2026-10-29: layar pembuka sudah dibangun mengikuti mockup (logo, ilustrasi kartu fitur, dan dedaunan dibuat dengan SpriteCook di akun `bungee_upside_deuce`; lihat `apps/web/art/PROVENANCE.md`). Sisa kredit akun itu: 0 (8 kredit terakhir dipakai untuk bingkai emas berukir). Bar sumber daya pada mockup diganti bar statistik game (jumlah monster, elemen, resep Altar, tingkatan, Arena 3v3) karena website tidak punya data sumber daya pemain.
