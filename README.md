# Soul Monster

Game membangun desa ala Social Empires dengan monster dan **Soul Mixer** (campur dua monster dewasa menjadi monster baru). Saat ini berjalan di browser dalam posisi horizontal; rencana lengkap di [docs/PLAN.md](docs/PLAN.md), aturan proyek di [CLAUDE.md](CLAUDE.md), evaluasi terbaru di [docs/EVALUASI.md](docs/EVALUASI.md).

## Menjalankan

Butuh Node.js 20+ dan pnpm 10.

```bash
pnpm install
pnpm dev
```

Buka alamat yang dicetak Vite (biasanya http://localhost:5173). Di mode dev ada tombol **Debug** di kanan bawah (sumber daya, lompat waktu, level Balai, buka semua wilayah).

| Perintah           | Fungsi                                                                   |
| ------------------ | ------------------------------------------------------------------------ |
| `pnpm dev`         | game di browser                                                          |
| `pnpm test`        | semua tes (termasuk Monte Carlo Soul Mixer, musuh, dan simulasi)         |
| `pnpm lint`        | ESLint + Prettier                                                        |
| `pnpm build`       | typecheck + build statis ke `apps/game/dist`                             |
| `pnpm preview`     | jalankan hasil build                                                     |
| `pnpm atlas`       | kemas gambar `apps/game/art/` menjadi atlas di `apps/game/public/atlas/` |
| `pnpm sim:economy` | simulasi ekonomi 14 hari (`--seed N`, `--days N`, `--detail`)            |

Deploy: [docs/DEPLOY.md](docs/DEPLOY.md).

## Struktur

```
data/                  semua isi & angka game (elements, forms, recipes, rules, buildings, wilds, text)
packages/shared/src/   logika murni & deterministik: data, rng, elements, monster, mixer, state, save,
                       village (plot, bangunan, produksi), workers, wilds, animals, barracks,
                       encounters, missions, sim (simulasi ekonomi)
apps/game/src/         client Phaser 3: VillageScene (desa) + UIScene (HUD & panel), art (gambar
                       buatan kode + atlas), fx (game feel), views, debug
apps/game/art/         sumber PNG untuk atlas (lihat README di sana)
```

## Cara bermain

- **Desa:** geser peta, roda mouse / cubit dua jari untuk zoom. Ketuk bangunan untuk info, upgrade, dan pindah.
- **Wilayah:** desa dimulai di beberapa plot terang di tengah. Lahan gelap dibeli dengan emas (ketuk papan harga).
- **Pekerja & populasi:** latih pekerja di Balai Utama. Rumah menambah populasi, yang dipakai pekerja dan monster (sesuai tingkat wujudnya).
- **Bangun:** tombol _Bangun_ → pilih bangunan → atur jumlah pekerja (makin banyak, makin cepat) → _Pasang_.
- **Alam liar:** kirim pekerja ke pohon (kayu), batu (batu), atau semak (makanan); hanya berjalan selama game dibuka, dan alam tumbuh lagi. Buru atau tangkap hewan; tangkapan tinggal di Peternakan.
- **Produksi:** ketuk gelembung untuk memungut (Pasar, Tambang Emas, Penggilingan, Peternakan, Ladang); ikon sumber daya terbang ke HUD. Tambang dan Penggilingan butuh pekerja di dalamnya dan tetap berjalan saat game ditutup.
- **Monster:** dimulai dengan 1 monster. Prajurit Dewasa dilatih di Barak, Arena Petarung, dan Lapangan Panah; monster baru lainnya dari **Soul Mixer** (butuh Balai Utama Lv 4).
- **Musuh liar:** ketuk bandit/monster liar, pilih tim, kirim. Kalah berarti monster bisa gugur dan masuk **Kuburan**, tempat ia bisa dihidupkan kembali dengan emas + makanan atau permata.
- **Suara:** tombol speaker di kanan atas menyalakan/mematikan suara. Cara mengganti suara buatan kode dengan file rekaman ada di [docs/SUARA.md](docs/SUARA.md).
- **Simpanan** disimpan di browser (dengan cadangan terakhir yang baik bila simpanan utama rusak).

Semua angka bangunan ada di `data/buildings.json`, alam liar dan musuh di `data/wilds.json`, angka monster, Soul Mixer, pekerja, dan pertarungan cepat di `data/rules.json`.
