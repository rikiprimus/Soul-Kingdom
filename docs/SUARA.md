# Suara Soul Monster

Game sudah punya suara: **semua efek dibuat oleh kode** (`apps/game/src/audio/synth.ts`, orisinal, tanpa file). File rekaman (misalnya dari **Ludo.ai**) dengan nama yang sama otomatis **menggantikan** suara buatan kode. Musik dan suara suasana (ambience) tidak dibuat oleh kode; keduanya hanya diputar bila filenya dipasang.

Tombol speaker di HUD (kanan atas) menyalakan/mematikan semua suara; pilihan diingat browser.

## Membuat suara di Ludo.ai

Menurut panduan resmi Ludo ([Audio Generator](https://ludo.ai/docs/audio-generator)):

1. Buka **Audio Generator** dari menu utama.
2. Pilih **Generation Mode**: **Sound Effects (SFX)** untuk efek, **Music** untuk musik.
3. Tempel prompt dari tabel di bawah. Ludo menyarankan deskripsi **sumber bunyi dan aksinya secara harfiah**, dan **tidak menulis durasi di prompt**.
4. Atur **Duration** sesuai kolom tabel (efek: 0–10 detik, kelipatan 0,5; musik: sampai ±3 menit). **Loop** dimatikan untuk efek; musik otomatis dibuat bisa berulang.
5. Klik **Generate**. Kalau kurang cocok, pakai **Try Again** atau **Remix** untuk variasi.
6. Unduh hasilnya (menu konteks hasil → **Download**, MP3) dan **ganti nama file persis seperti id-nya**, misalnya `coin.mp3`, `build-done.mp3`, `village.mp3`.

Sebelum dipakai di game yang dijual: pastikan paket Ludo Anda memberi **izin komersial** atas hasil suara.

## Memasang file ke game

1. Simpan file di `apps/game/public/audio/`.
2. Daftarkan **hanya file yang sudah ada** di `apps/game/public/audio/sounds.json` (contoh lengkap bila semuanya sudah dibuat):

   ```json
   {
     "sfx": {
       "click": "click.mp3",
       "tap": "tap.mp3",
       "collect": "collect.mp3",
       "coin": "coin.mp3",
       "pickup": "pickup.mp3",
       "place": "place.mp3",
       "build-done": "build-done.mp3",
       "gather": "gather.mp3",
       "ready": "ready.mp3",
       "error": "error.mp3",
       "win": "win.mp3",
       "lose": "lose.mp3",
       "mixer": "mixer.mp3",
       "hatch": "hatch.mp3",
       "panel": "panel.mp3",
       "unlock-land": "unlock-land.mp3",
       "grow": "grow.mp3",
       "march": "march.mp3",
       "revive": "revive.mp3",
       "prophecy": "prophecy.mp3",
       "rare-hatch": "rare-hatch.mp3",
       "enemy": "enemy.mp3"
     },
     "music": { "village": "village.mp3", "ambience": "ambience.mp3" }
   }
   ```

   Efek yang tidak terdaftar tetap memakai suara buatan kode, jadi file boleh dipasang satu per satu. Id yang tidak dikenal diabaikan.

3. Catat asal-usulnya di tabel **Asal suara** di bawah (tanggal, paket Ludo, izin komersial).
4. Muat ulang game.

Volume tiap efek diatur di `apps/game/src/audio/sound.ts` (`VOLUME`). Musik: semua id `village`, `village-2`, `village-3`, … di `sounds.json` diputar bergantian mulai dari lagu acak, kerasnya disamakan otomatis. Musik diunduh satu per satu setelah desa tampil: lagu pertama, lalu ambience, dan lagu berikutnya baru diunduh saat gilirannya tiba. Ambience berulang di bawahnya. Jeda hening di awal efek dilewati otomatis, dan efek yang terlalu pelan dikeraskan (sampai 4×). Hasil Ludo yang punya jeda hening di awal sebaiknya dipotong (misalnya dengan Audacity) supaya terasa langsung saat diketuk.

**Ukuran musik untuk HP.** File musik Ludo saat ini ±2,7 MB per ±114 detik (±192 kbps stereo), total 10,6 MB untuk 3 lagu + ambience. Untuk musik latar di HP cukup:

| File                                 | Saran                 | Perkiraan ukuran |
| ------------------------------------ | --------------------- | ---------------- |
| `villager*.mp3` (lagu desa)          | MP3 96 kbps, stereo   | ±1,4 MB per lagu |
| `ambience.mp3` (suara alam berulang) | MP3 64 kbps, **mono** | ±0,9 MB          |

Total turun dari 10,6 MB ke ±5 MB tanpa beda yang terdengar di speaker HP. Cara mengubah: Audacity → File → Export Audio → MP3 → Bitrate Mode _Constant_, Quality 96 kbps (ambience: 64 kbps dan Channels _Mono_). Dengan ffmpeg: `ffmpeg -i villager.mp3 -b:a 96k villager-kecil.mp3` dan `ffmpeg -i ambience.mp3 -ac 1 -b:a 64k ambience-kecil.mp3`. Ganti file di `apps/game/public/audio/` dengan nama yang sama dan perbarui baris ukurannya di tabel **Asal suara**.

## Daftar suara dan prompt

Semua prompt berbahasa Inggris (hasil generator biasanya lebih baik).

| Id            | Kapan diputar                                            | Duration | Prompt Ludo (Sound Effects)                                                                                             |
| ------------- | -------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `click`       | Menekan tombol apa pun                                   | 0,5 s    | Soft click of a small wooden button being pressed, single short tap, clean, no echo                                     |
| `tap`         | Mengetuk bangunan, hewan, atau musuh di desa             | 0,5 s    | Gentle soft pop of a small soap bubble bursting, light and airy, single pop                                             |
| `collect`     | Sumber daya mulai terbang ke HUD                         | 0,5 s    | Quick magical whoosh rising upward and ending in a soft sparkle pop, fantasy game reward pickup                         |
| `coin`        | Ikon emas/permata/kristal mendarat di HUD                | 0,5 s    | Single small gold coin dropping onto a pile of coins, bright metallic clink                                             |
| `pickup`      | Ikon makanan/kayu/batu mendarat di HUD                   | 0,5 s    | Small wooden block dropped into a wicker basket, soft hollow wooden knock                                               |
| `place`       | Memasang atau memindah bangunan, membangun tembok        | 1 s      | Heavy wooden crate set down onto soft grass, low soft thud with a light puff of dust                                    |
| `build-done`  | Konstruksi/upgrade selesai                               | 1,5 s    | Short cheerful fanfare played on bells and marimba, rising melody celebrating a finished building, cartoon village game |
| `gather`      | Pekerja menyelesaikan pohon/batu/semak, berburu          | 0,5 s    | Single axe chop into a wooden log, crisp thunk with small wood chips flying                                             |
| `ready`       | Pekerja/prajurit siap, hewan tertangkap                  | 1 s      | Two-note friendly notification chime on a glockenspiel, bright and pleasant                                             |
| `error`       | Aksi gagal (sumber daya kurang, dsb.)                    | 0,5 s    | Two short soft muted wooden bonks meaning wrong, low and gentle, not harsh                                              |
| `win`         | Tim menang melawan musuh liar                            | 2 s      | Short triumphant victory jingle on brass and xylophone, cute cartoon style, ending on a bright chord                    |
| `lose`        | Tim kalah                                                | 2 s      | Short sad descending three-note melody on a muted trombone, gentle cartoon failure sting                                |
| `mixer`       | Soul Mixer mulai mencampur                               | 1,5 s    | Magic cauldron bubbling with a swirling mystical whoosh rising up and sparkling chimes                                  |
| `hatch`       | Telur menetas di Soul Mixer                              | 1,5 s    | Eggshell cracking open followed by a magical sparkling chime arpeggio                                                   |
| `panel`       | Membuka panel (Bangun, Monster, Soul Mixer, Barak, dll.) | 0,5 s    | Soft whoosh of a parchment scroll being unrolled quickly, light paper swish                                             |
| `unlock-land` | Membeli lahan baru                                       | 1,5 s    | Wooden stake hammered into the ground followed by a short bright rising chime, new land claimed, cheerful               |
| `grow`        | Monster naik tahap (bayi → remaja → dewasa)              | 1,5 s    | Magical rising shimmer with a soft sparkle and a happy little chime, a creature growing bigger, cute                    |
| `march`       | Mengirim tim melawan musuh liar                          | 1,5 s    | Two deep war drum hits followed by a short heroic horn call, small cartoon army setting off                             |
| `revive`      | Menghidupkan monster di Kuburan                          | 2 s      | Gentle angelic choir pad swelling up with soft bells, warm holy light, peaceful revival                                 |
| `prophecy`    | Ramalan Jiwa memperlihatkan hasil campuran               | 1,5 s    | Mysterious crystal ball reveal, soft shimmering magical hum rising into a single clear bell                             |
| `rare-hatch`  | Bayi epik atau legenda menetas (diputar setelah `hatch`) | 2 s      | Grand magical fanfare with harp glissando and bright bells, rare treasure discovered, triumphant and sparkling          |
| `enemy`       | Musuh liar baru muncul di peta                           | 1 s      | Distant low warning horn, short and soft, cartoon village alert, not scary                                              |

| Id musik   | Kapan diputar                      | Duration    | Prompt Ludo (Music)                                                                                                                                                                               |
| ---------- | ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `village`  | Berulang selama di desa            | 1,5–2 menit | Cozy peaceful fantasy village background music, acoustic guitar, flute and light hand percussion, warm, cheerful and relaxed, medium-slow tempo, instrumental, for a casual village-building game |
| `ambience` | Berulang pelan di bawah musik desa | 1–2 menit   | Peaceful countryside ambience, gentle breeze through trees, distant birds chirping, soft rustling leaves, no music                                                                                |

## Asal suara

Catatan per file suara yang dikirim bersama game. Periksa ketentuan Ludo.ai (izin komersial pada paket yang dipakai) sebelum rilis.

| File              | Sumber                                                                            | Tanggal    | Paket / izin                             | Catatan                                   |
| ----------------- | --------------------------------------------------------------------------------- | ---------- | ---------------------------------------- | ----------------------------------------- |
| _(cadangan)_      | Dibuat oleh kode (`synth.ts`)                                                     | 2026-10-20 | Orisinal                                 | Dipakai hanya bila file rekaman tidak ada |
| `click.mp3`       | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `b24d75a8a67c`, 13 KB               |
| `tap.mp3`         | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `c1a5268d6da0`, 5 KB                |
| `collect.mp3`     | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `9a23d7276453`, 13 KB               |
| `coin.mp3`        | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `510ffb942ea7`, 11 KB               |
| `pickup.mp3`      | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `76d2ffcd7386`, 11 KB               |
| `place.mp3`       | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `e89e1eec4744`, 13 KB               |
| `build-done.mp3`  | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `33fcf942e6d1`, 30 KB               |
| `gather.mp3`      | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `d66731e2738b`, 13 KB               |
| `ready.mp3`       | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `b9cdcc5c1e24`, 13 KB               |
| `error.mp3`       | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `9a4922bdb1bc`, 10 KB               |
| `win.mp3`         | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `8ebfdbc0805d`, 26 KB               |
| `lose.mp3`        | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `6d9e1203f2cd`, 49 KB               |
| `mixer.mp3`       | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `ca2dba88a813`, 24 KB               |
| `hatch.mp3`       | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-20 | Paket belum dicatat — cek izin komersial | sha12 `ce382c737ddd`, 35 KB               |
| `panel.mp3`       | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `35cbe02a286b`, 13 KB               |
| `unlock-land.mp3` | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `2c002b233e0b`, 32 KB               |
| `grow.mp3`        | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `a9d45ae2e8e0`, 37 KB               |
| `march.mp3`       | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `40d20edf20d5`, 34 KB               |
| `revive.mp3`      | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `d5b9e549cda3`, 44 KB               |
| `prophecy.mp3`    | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `5d35a11799fc`, 23 KB               |
| `rare-hatch.mp3`  | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `68351930c381`, 31 KB               |
| `enemy.mp3`       | Ludo.ai, Audio Generator (Sound Effects), prompt dari tabel di atas               | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `de2e3f92afa5`, 30 KB               |
| `villager.mp3`    | Ludo.ai, Audio Generator (Music → `village`), prompt dari tabel di atas           | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `866128f9ab51`, 2674 KB             |
| `villager_2.mp3`  | Ludo.ai, Audio Generator (Music → `village-2`), prompt dari tabel di atas         | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `8ad0d791da17`, 2740 KB             |
| `villager_3.mp3`  | Ludo.ai, Audio Generator (Music → `village-3`), prompt dari tabel di atas         | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `9279747007f2`, 2627 KB             |
| `ambience.mp3`    | Ludo.ai, Audio Generator (Music/ambience → `ambience`), prompt dari tabel di atas | 2026-10-21 | Paket belum dicatat — cek izin komersial | sha12 `1c9d1082567e`, 2646 KB             |
