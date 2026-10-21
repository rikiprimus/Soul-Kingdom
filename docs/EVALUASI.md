# Evaluasi progres — 2026-10-20

Disusun dari kondisi kode saat ini, bukan dari rencana: `pnpm test` (165 tes, 17 file) lulus, `pnpm lint` bersih, `pnpm build` berhasil, dan game dijalankan di browser pada 800×400.

## Teknologi (dipertahankan)

- **Stack:** TypeScript strict, pnpm workspace, Phaser **3.90** + Vite 6, logika murni di `packages/shared` (zod, RNG berbenih, Vitest).
- **Alasan dipertahankan:** stack ini layak untuk game desa isometrik 2D di browser dan Android (Capacitor). Migrasi ke Phaser 4 tidak diperlukan sekarang.
- **Tambahan baru:**
  - font Fredoka;
  - `phaser3-rex-plugins` (terpasang, belum dipakai);
  - pembuat atlas `pnpm atlas`, sudah tersambung ke game dengan gambar buatan kode sebagai cadangan;
  - simulasi `pnpm sim:economy`.

## Sudah berfungsi

- **Inti monster:** mesin elemen, Soul Mixer (resep, mutasi, pity, Ramalan Jiwa), tumbuh kembang, Monsterpedia, efek kelangkaan.
- **Desa (Fase 1A lengkap):**
  - peta 48×48 dengan plot yang dibeli;
  - populasi dan Rumah;
  - pekerja yang membangun (makin banyak, makin cepat) dan mengambil pohon/batu/semak (hanya saat main);
  - Tambang Emas, Penggilingan, Pasar, dan Ladang;
  - hewan liar (buru/tangkap) dan Peternakan;
  - tiga barak yang melatih prajurit Dewasa;
  - musuh liar, kirim tim, dan Kuburan;
  - tembok sebaris.
- **Simpanan:** versi 10 dengan rantai migrasi v1→v10, validasi zod, dan salinan `:broken` bila gagal dimuat.
- **UI horizontal:** HUD satu baris, dock mengambang, kartu info, panel, dan penggeser jumlah pekerja.
- **Penyeimbangan:** Balai Lv 4 (Soul Mixer) tercapai hari ke-2–3 menurut `pnpm sim:economy`, dan tes regresinya ada.

## Belum selesai

- **Tugas 0.11:** deploy ke tautan publik dan uji di HP (butuh akun hosting pemilik).
- **Tugas 1A.1:** layar penuh dan kunci orientasi belum diuji di Android sungguhan.
- **Gerbang Fase 0/1A:** `docs/FEEDBACK.md` masih kosong; uji main pengguna sedang berjalan.
- **Fase 1B** (XP/level, misi dan tutorial, Sarang Telur Jiwa, set/Keajaiban, putar bangunan/Gudang, pulau tambahan), **pertarungan Fase 1** (simulator, Serbu, Petualangan, serangan desa), dan **server Supabase**: belum dimulai.
- **Bonus kecil per level Kandang:** disebut di aturan Fase 1A, belum ada di kode maupun data.
- **Aset gambar:** masih buatan kode. Plugin SpriteCook dan Design belum dipasang pemilik.
- **Suara:** sistem suara ada (2026-10-20): 14 efek dibuat oleh kode sebagai suara sementara, tombol suara di HUD. File dari Ludo.ai dan musik belum dipasang — lihat [SUARA.md](SUARA.md).

## Bug atau masalah teknis

1. **Umpan balik aksi lemah (game feel).** Memungut, menaruh bangunan, konstruksi selesai, dan panen node hanya mengubah angka atau memunculkan teks. Tidak ada animasi "pop", partikel, atau ikon yang terbang ke HUD. Inilah penyebab utama "tampilan masih kurang" di luar soal gambar. Hanya 19 `tweens.add` di seluruh client, dan sebagian besar untuk Soul Mixer dan monster.
2. **Simpanan tanpa salinan cadangan yang baik.** Kalau simpanan gagal dimuat, permainan baru langsung menimpa `soul-monster:save`. Kegagalan kedua juga menimpa `:broken` yang pertama. Belum ada salinan "terakhir yang baik" yang dirotasi (lihat skill `save-systems`).
3. **README usang.** Masih menyebut Toko, `village.builders`, kapasitas Kandang, membersihkan rintangan dengan emas, dan tombol Debug di kiri bawah. Sistem baru juga belum disebut.
4. **Ukuran bundle** 1,77 MB (gzip 427 KB) dalam satu chunk. Sebagian besar adalah Phaser. Belum masalah di desktop, tapi perlu diukur di HP sebelum rilis (skill `performance-optimization`: ukur dulu).
5. **Keseimbangan ekonomi** (dari simulasi):
   - mulai hari ke-5 emas dan makanan berlebih;
   - batu menjadi penghambat;
   - setelah Balai Lv 4, musuh berisi monster tingkat 2 sehingga jarang bisa dilawan tanpa Soul Mixer.

## Fitur berikutnya yang paling penting

1. **Game feel inti — selesai 2026-10-20.** Gerbang Fase 1A menuntut sesi 10 menit yang terasa seperti Social Empires, dan pengguna menilai tampilannya masih kurang. Umpan balik yang hidup pada aksi inti tidak butuh aset baru, cakupannya jelas, dan langsung terasa.
2. **Salinan cadangan simpanan — selesai 2026-10-20.** Kecil dan mencegah hilangnya progres pemain.
3. **README diperbarui — selesai 2026-10-20.** Juga: indeks atlas dibaca dengan aman (sebelumnya file yang hilang memicu galat JSON tak tertangkap di konsol).
4. Aset gambar orisinal untuk tanah dan bangunan utama setelah SpriteCook dipasang (skill `create-game-assets` + `soul-monster-art-style`).
5. Fase 1B.1 Level & XP pemain, yang juga menjadi penyerap kelebihan emas/makanan.
6. Suara dasar (klik, pungut, selesai bangun).
