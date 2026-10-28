# Desain Website Soul Monster (Tugas 2C.2)

Tanggal: 2026-10-28 · Status: menunggu tinjauan pemilik · Rencana induk: Fase 2C di [docs/PLAN.md](../../PLAN.md)

## 1. Tujuan

Website terpisah dari game, untuk **promosi sekaligus pusat pemain**:

- Pengunjung baru mengenal game dan menekan **Main Sekarang**.
- Pemain melihat berita, peringkat Arena, dan koleksi monster mereka.

Website dan game memakai **satu akun** (Supabase Auth yang sama). Game sendiri wajib login (Fase 2C.1); website boleh dibuka tanpa login.

**Berhasil bila:**

- Keempat halaman publik tampil di desktop dan HP, termasuk saat server tidak bisa dihubungi (bagian yang butuh server menampilkan pesan).
- Pemain yang masuk melihat monster yang pernah mereka dapatkan terbuka di Ensiklopedia dan posisinya di Peringkat.
- Pemilik bisa menulis, menerbitkan, menyembunyikan, dan menghapus berita dari Panel Admin tanpa deploy ulang.
- Tidak ada resep Altar, berita draf, atau isi simpanan pemain lain yang bisa dibaca pengunjung.

## 2. Keputusan pemilik

| Topik            | Keputusan                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tujuan           | Promosi dan pusat pemain, seimbang                                                                                                                                                         |
| Halaman          | Beranda + Main Sekarang, Berita/Update, Peringkat Arena, Ensiklopedia Monster, Panel Admin                                                                                                 |
| Gaya             | **C · Epik Gelap**: latar gelap sinematik (`#0b0a12`), aksen emas (`#ffc83d`, tombol gradasi `#ffd866 → #e0a21a`), siluet monster bercahaya, font Fredoka 400/500                          |
| Ensiklopedia     | Ke-100 monster ditampilkan; **5 monster pilihan** selalu terbuka; sisanya siluet hitam "???" sampai pemain yang masuk **pernah mendapatkannya** (tetap terbuka walau monster mati/dibuang) |
| Login di website | Tombol **Masuk** di menu atas; tanpa halaman Akun terpisah untuk versi pertama                                                                                                             |
| Berita           | Ditulis lewat **Panel Admin** di website, disimpan di Supabase                                                                                                                             |
| Admin            | Hanya akun yang ditandai pemilik di dashboard Supabase (tabel `admins`); tidak ada halaman untuk mengangkat admin                                                                          |
| Teknologi        | **Vite + TypeScript** multi-halaman di `apps/web`, tanpa framework                                                                                                                         |

## 3. Halaman

Mockup yang disetujui: Beranda, Ensiklopedia, Peringkat/Berita/Admin (sesi brainstorming 2026-10-28, folder `.superpowers/brainstorm/`).

### 3.1 Menu atas & kaki halaman (semua halaman)

- Menu: logo "✦ SOUL MONSTER", Berita, Peringkat, Monster, tombol **Masuk** (berubah menjadi nama pemain + **Keluar** setelah masuk). Tautan "Admin" hanya muncul untuk akun admin.
- Kaki halaman: hak cipta, Privasi, Syarat, Kontak (isi halaman Privasi/Syarat mengikuti Tugas 3.2; sementara halaman sederhana).

### 3.2 Beranda (`index.html`)

Urutan dari atas:

1. Bagian utama: judul "BANGKITKAN YANG MITIS", kalimat singkat (desa, Altar, Arena, 100 monster · 8 tingkatan), tombol **MAIN SEKARANG** ke alamat game, catatan "Gratis · main di browser · Android menyusul", siluet monster Mythical bercahaya.
2. Tiga kartu fitur: Bangun Desa, Altar, Arena & Serbu.
3. Monster pilihan: 5 kartu monster pilihan (gambar, nama, tingkatan) + tautan "Lihat semua" ke Ensiklopedia.
4. Berita terbaru (3 terakhir) di samping Peringkat Arena (3 besar + "Lihat 50 besar").

### 3.3 Ensiklopedia (`monster.html`)

- Grid 100 kotak berurutan per tingkatan (Common → Mythical), saringan per tingkatan.
- Kotak terbuka: gambar, nama, tingkatan, elemen. Kotak tertutup: siluet hitam, "???" dan nomor saja; nama, tingkatan, elemen, dan cara mendapatkan tidak dikirim ke browser.
- Monster pilihan ditandai "★ pilihan".
- **Belum masuk:** hanya monster pilihan yang terbuka; ajakan "Masuk untuk membuka koleksimu".
- **Sudah masuk:** monster pilihan + monster yang pernah didapat (bingkai hijau); bilah progres "N / 100 terbuka"; saringan tambahan "Sudah dimiliki".
- Klik kotak terbuka → panel detail: nama, tingkatan, elemen, deskripsi bentuk, cara mendapatkan. **Resep Altar tidak pernah ditampilkan.**

### 3.4 Peringkat (`peringkat.html`)

- 50 besar musim Arena berjalan (hanya pemain aktif musim ini), hitung mundur reset musim, tier dan poin.
- Tab "Hadiah tier": tabel hadiah mingguan per tier dari `rules.arena.tiers`.
- Sudah masuk: baris pemain ditandai hijau; bila di luar 50 besar, posisinya ditampilkan di bawah daftar.

### 3.5 Berita (`berita.html`, `baca.html?id=…`)

- Daftar kartu (sampul, judul, tanggal, kategori), saringan Update / Event / Patch, terbaru di atas.
- Halaman satu berita: judul, tanggal, kategori, sampul, isi.

### 3.6 Panel Admin (`admin.html`)

- Hanya untuk akun admin; akun lain yang membuka alamat ini melihat "Halaman tidak tersedia".
- Formulir: judul, kategori (Update / Event / Patch), unggah gambar sampul, isi berformat Markdown (judul kecil, tebal, daftar, tautan); tombol Pratinjau, Simpan draf, Terbitkan.
- Daftar semua berita dengan status (Draf / Terbit / Tersembunyi) dan aksi Ubah, Sembunyikan, Hapus (dengan konfirmasi).

## 4. Susunan teknis

### 4.1 Paket `apps/web`

```
apps/web/
  index.html  berita.html  baca.html  peringkat.html  monster.html  admin.html
  src/
    auth.ts        masuk/keluar lewat Supabase Auth (akun sama dengan game)
    api.ts         semua panggilan ke edge function `web`
    pedia.ts       logika murni: kotak mana yang terbuka (dites)
    markdown.ts    ubah Markdown berita menjadi HTML aman (dites)
    ui/            menu, tombol, kartu, kaki halaman, gaya Epik Gelap
    pages/         satu modul per halaman
  vite.config.ts   build multi-halaman
```

- Data monster (nama, tingkatan, elemen, deskripsi, sumber) dan daftar 5 monster pilihan diambil dari `data/` lewat `@soul-monster/shared`. Daftar pilihan disimpan di data (mis. `rules.json → web.featuredMonsters`), bukan di kode.
- **Resep Altar tidak boleh masuk bundel website:** halaman mengimpor hanya bagian data yang dibutuhkan; ada tes yang memastikan bundel build tidak berisi data resep.
- Teks yang dilihat pengunjung berbahasa Indonesia dan diambil dari `data/text.json` (kunci `web.*`).
- Perintah baru: `pnpm dev:web`, `pnpm build:web`. `pnpm test`, `pnpm lint`, `pnpm typecheck` mencakup `apps/web`. Konfigurasi pratinjau `web` ditambahkan ke `.claude/launch.json`.

### 4.2 Edge function `web` (baru)

| Permintaan                                                                  | Butuh login | Isi                                                            |
| --------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------- |
| `news.list`, `news.get`                                                     | tidak       | Hanya berita berstatus Terbit                                  |
| `leaderboard`                                                               | tidak       | 50 besar musim berjalan; bila ada sesi, juga posisi pemain itu |
| `myCollection`                                                              | ya          | Hanya `pedia.monsters` dari simpanan pemain itu                |
| `news.save`, `news.publish`, `news.hide`, `news.delete`, `news.uploadCover` | admin       | Diperiksa di server terhadap tabel `admins`                    |

- Peringkat dipindah dari function `arena` ke `web` agar bisa dibuka tanpa login; `arena` tetap mewajibkan login untuk duel.
- CORS dibatasi ke domain website dan game (bersama Tugas 2C.3).

### 4.3 Database (migrasi baru)

- Tabel `news`: id, judul, kategori, url sampul, isi (Markdown), status (`draft` / `published` / `hidden`), dibuat, diterbitkan, diubah.
- Tabel `admins`: id pemain; diisi pemilik lewat dashboard Supabase.
- Bucket Supabase Storage `news-covers` (gambar sampul, batas ukuran dan jenis file: png/jpg/webp).
- RLS aktif tanpa kebijakan untuk klien di semua tabel baru: hanya function (service role) yang membaca/menulis.

## 5. Keamanan

- Izin admin diperiksa di server untuk setiap aksi admin; menyembunyikan menu di tampilan hanya kenyamanan.
- Isi berita dibersihkan saat diubah menjadi HTML (tanpa `<script>`, atribut `on*`, atau tautan `javascript:`).
- `myCollection` hanya mengembalikan daftar monster yang pernah didapat, bukan simpanan lengkap.
- Kotak Ensiklopedia yang tertutup tidak membawa data monster di halaman (hanya nomor), sehingga tidak bisa diintip lewat kode halaman.

## 6. Bila ada gangguan

- Server tidak bisa dihubungi: Beranda tetap tampil (teks dan monster pilihan ada di bundel); bagian Berita/Peringkat menampilkan "Belum bisa dimuat" dengan tombol coba lagi.
- Sesi login habis atau tidak sah: kembali ke tampilan belum masuk tanpa pesan galat.
- Gagal menyimpan/terbitkan di Panel Admin: pesan jelas, isi formulir tidak hilang.

## 7. Pengujian

- Vitest: `pedia.ts` (terbuka/tertutup untuk belum masuk, sudah masuk, monster pilihan), `markdown.ts` (pembersihan), pengurutan peringkat dan posisi pemain di luar 50 besar.
- Tes aturan izin function `web` (logika murni dipisah agar bisa dites tanpa jaringan): bukan admin ditolak, berita draf/tersembunyi tidak muncul di `news.list`/`news.get`.
- Tes bundel: hasil `pnpm build:web` tidak berisi data resep Altar.
- Pengecekan tampilan di panel pratinjau (desktop dan lebar HP).

## 8. Ketergantungan & urutan

- **Ensiklopedia** butuh `data/monsters.json` dari Tugas 2B.1 (dan gambar dari 2B.7; sampai ada, blok warna elemen sebagai cadangan).
- **Masuk dengan email** mengikuti keputusan 2C.0 (kata sandi / magic link); Masuk dengan Google bisa lebih dulu.
- **Domain & hosting** dari Tugas 2C.3.
- Bisa dikerjakan lebih dulu: kerangka `apps/web`, gaya, Beranda, Berita + Panel Admin, Peringkat.

## 9. Di luar cakupan versi pertama

Halaman Akun terpisah, komentar/suka pada berita, berita multi-bahasa, render server untuk mesin pencari (bisa ditambahkan ke halaman Berita nanti tanpa mengubah halaman lain).
