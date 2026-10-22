# Masukan Penguji — Gerbang Fase 0

Target: 10–20 penguji. Pertanyaan kunci: **apakah penguji ingin mencampur lagi tanpa disuruh?**

| #   | Penguji | Tanggal | Perangkat | Lama main | Mencampur lagi tanpa disuruh? (ya/tidak) | Hal paling seru | Hal paling membingungkan | Bug | Catatan |
| --- | ------- | ------- | --------- | --------- | ---------------------------------------- | --------------- | ------------------------ | --- | ------- |
| 1   |         |         |           |           |                                          |                 |                          |     |         |

## Ringkasan

- Jumlah penguji:
- Yang ingin mencampur lagi: … dari …
- Perubahan `rules.json` yang diusulkan:

# Uji Gerbang Fase 1 — sesi 10 menit

Pertanyaan kunci: **apakah satu sesi 10 menit terasa lengkap?** (panen, kirim pekerja, campur,
bertarung, upgrade). Mainkan dari game baru: panel Debug → Reset simpanan, atau buka di
browser/profil lain. Saat online, setiap penguji otomatis dapat akun anonim sendiri.

Urutan yang diharapkan (ikuti kartu misi di kanan atas, jangan dibantu):

1. Ambil Bonus Harian, tetaskan telur di Kandang.
2. Tanam dan panen Ladang; pungut hasil Pasar.
3. Kirim pekerja ke pohon/semak; bangun Ladang kedua dan Rumah.
4. Kirim tim melawan bandit (pilih monster/prajurit → serang).
5. Upgrade Balai Utama ke Lv 2.
6. Mencampur butuh Balai Lv 4 dan Soul Mixer: catat **berapa lama** sampai bisa mencampur
   pertama kali (target rencana ±4 hari bermain normal; Debug boleh dipakai untuk
   melompat waktu **hanya** saat offline).

| #   | Penguji | Tanggal | Perangkat | Online/offline | Langkah terakhir yang dicapai dalam 10 menit | Bagian yang menunggu terlalu lama | Bagian yang membingungkan | Bug | Ingin main lagi besok? |
| --- | ------- | ------- | --------- | -------------- | -------------------------------------------- | --------------------------------- | ------------------------- | --- | ---------------------- |
| 1   |         |         |           |                |                                              |                                   |                           |     |                        |

## Catatan uji otomatis (2026-10-22)

- Uji lewat panel browser Claude Code tidak bisa menilai rasa bermain: panel itu hanya
  berjalan ±5 fps, sehingga waktu game, animasi, dan toast melambat. Yang sudah terverifikasi
  di sana: game baru online (akun anonim, bonus harian, telur menetas → misi berikutnya,
  tanam ladang, kirim pekerja) tersimpan di server dan sama dengan client.
- Kandidat temuan untuk dicek ulang di HP/browser biasa: gelembung telur di atas Kandang
  tertutup HUD pada posisi kamera awal; ketukan pertama setelah game dimuat kadang tidak
  terbaca (bisa jadi akibat permintaan layar penuh pada ketukan pertama).
