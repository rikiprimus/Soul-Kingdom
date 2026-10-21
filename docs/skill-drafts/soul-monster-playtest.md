---
name: soul-monster-playtest
description: Cara menjalankan dan menguji tampilan/alur game Soul Monster di panel browser. Pakai saat diminta menjalankan game, memeriksa perubahan visual atau fitur di game sungguhan, mengambil tangkapan layar sebelum/sesudah, atau melakukan uji main Gerbang Fase. Berisi cara start server, ukuran layar horizontal, kebiasaan panel tersembunyi, cara mencadangkan simpanan pemain sebelum uji yang mengubah data, dan daftar periksa.
---

# Uji main Soul Monster

Proyek: `I:\Script\Soul Monster\soul-monster-starter` (pnpm workspace). Konfigurasi server ada di `I:\Script\Soul Monster\.claude\launch.json`.

## 1. Menjalankan

- Mulai server dengan `preview_start` nama **`game`** (Vite di port 5173). Jangan jalankan `pnpm dev` lewat Bash.
- Untuk build produksi: `game-build-preview` (port 4173) setelah `pnpm build`.
- Buka `http://localhost:5173/?timer=1` saat panel browser tersembunyi — `?timer=1` memaksa loop setTimeout karena requestAnimationFrame berhenti di tab tersembunyi.

## 2. Ukuran layar

- Uji utama: **800 × 400** (HP horizontal), lalu 640 × 360 untuk layar kecil. Potret hanya memeriksa layar "putar HP".
- Selalu kembalikan dengan `resize_window` preset `desktop` setelah selesai.

## 3. Kebiasaan panel browser (penting)

- Klik pertama setelah navigasi kadang hilang, dan input diproses terlambat saat panel tersembunyi. Beri jeda 2 detik setelah klik, ambil screenshot, ulangi klik bila perlu.
- Modal/tween muncul dengan animasi; tunggu ±2 detik sebelum menilai tampilan.
- Setelah memuat ulang, panel UI yang terbuka tertutup lagi.
- Penyimpanan panel browser pernah ter-reset sendiri; jangan anggap simpanan pemain selalu ada.

## 4. Melindungi simpanan pemain

Sebelum uji yang menghabiskan sumber daya, membunuh monster, atau menyuntikkan data:

1. Navigasi ke `http://localhost:5173/manifest.webmanifest` (asal sama, game tidak berjalan sehingga tidak menyimpan ulang).
2. `localStorage.setItem('soul-monster:save:backup-<tugas>', localStorage.getItem('soul-monster:save'))` dan catat `soul-monster:clock-offset`.
3. Lakukan uji (boleh menyuntikkan bangunan/monster lewat JSON simpanan, lalu muat ulang game).
4. Pulihkan dari halaman manifest yang sama: kembalikan `soul-monster:save` dan `clock-offset`, hapus kunci cadangan, lalu muat ulang game.

Tombol **Debug** (kanan bawah, DOM) bisa menambah sumber daya, melompati waktu (+1m/+10m/+1j/+1h), mengubah level Balai, dan membuka semua wilayah. Lompat waktu menggeser `clock-offset`.

## 5. Daftar periksa tampilan

- HUD satu baris terbaca; dock (Bangun, Pedia) tidak menutupi kartu; kartu info di kanan tidak terpotong.
- Bangunan baru/aset atlas: tapak pas di ubin (lihat skill `soul-monster-art-style`), urutan gambar benar saat berdekatan, tidak buram saat zoom 0,6–2,2.
- Teks memakai font Fredoka, tidak melebihi tombol (label panjang dibungkus).
- Lahan terkunci gelap, lahan terbuka terang, papan harga terbaca.
- Pekerja, hewan, musuh, monster terlihat dan tidak tertutup bangunan secara aneh.

## 6. Gerbang Fase 1A (sesi 10 menit, horizontal)

Latih pekerja → kirim ke hutan → bangun dengan banyak pekerja → beli wilayah → latih prajurit → kalahkan bandit. Catat yang lambat, membingungkan, atau susah diketuk.

## 7. Laporan

Sertakan tangkapan layar sebelum/sesudah untuk perubahan visual, sebut ukuran layar yang diuji, dan katakan jujur bagian yang tidak bisa diuji (mis. HP sungguhan, fullscreen Android).
