# Server Supabase (Tugas 1.6)

Game berjalan **offline** (simpanan di browser) selama `apps/game/.env.local` belum berisi
alamat Supabase. Setelah diisi, server menjadi sumber kebenaran: setiap aksi dihitung ulang
di server dengan jam server, dan hasilnya menggantikan tebakan client.

## Cara kerjanya

- **Tabel `players`** (`supabase/migrations/…_players.sql`): satu baris per pemain berisi
  seluruh `PlayerState` (format `serializeState`), nomor `revision` untuk menolak tulisan
  ganda, dan `beat_at` (waktu detak terakhir). Pemain hanya bisa **membaca** barisnya;
  yang menulis hanya edge function.
- **Satu edge function `action`** (`supabase/functions/action/index.ts`) menerima:
  - `{ kind: 'load' }` — keadaan terbaru (timer diselesaikan dulu);
  - `{ kind: 'beat', seconds }` — detik bermain untuk pengambilan alam dan serangan desa;
    server hanya menerima paling banyak waktu nyata sejak detak sebelumnya +
    `rules.server.beatSlackSeconds`, maksimal `rules.server.maxBeatSeconds`;
  - `{ kind: 'action', name, params }` — salah satu aksi di
    `packages/shared/src/server/actions.ts` (bangun, panen, campur, serbu, misi, pulau, …),
    parameternya dicek zod. Saklar pengembangan (`skipUnlock`) selalu dibuang.
- Logikanya sama persis dengan client: `pnpm build:server` membundel `packages/shared`
  menjadi `supabase/functions/_shared/game.js` yang diimpor edge function.
- **Login anonim**: client mendaftar sebagai pengguna anonim Supabase saat pertama main
  dan menyimpan sesinya di browser. Google menyusul di Tugas 2.1.
- **Migrasi simpanan lama**: saat pertama tersambung, client mengirim simpanan lokalnya;
  server memakainya (setelah divalidasi seperti memuat simpanan biasa) hanya bila pemain
  itu belum punya baris di server.
- **Offline sementara**: bila server tidak terjangkau, game tetap jalan di perangkat dan
  menampilkan peringatan; jawaban server berikutnya menggantikan keadaan lokal.
- **Panel debug** (tambah sumber daya, lompati waktu) hanya berlaku offline; saat online
  server menimpanya.

## Menyiapkan proyek (sekali)

1. Buat proyek di <https://supabase.com/dashboard>.
2. **Authentication → Sign In / Providers → Allow anonymous sign-ins**: aktifkan.
3. Masuk ke Supabase CLI (lewat `npx`, tidak perlu dipasang global). Jalankan dari folder
   proyek; browser akan terbuka untuk login:

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref <ref-proyek>
   ```

   `<ref-proyek>` adalah bagian depan Project URL (`https://<ref-proyek>.supabase.co`).

4. Buat tabel:

   ```bash
   npx supabase db push
   ```

5. Bundel logika game lalu deploy edge function (`--use-api` membundel di server
   Supabase, jadi tidak butuh Docker):

   ```bash
   pnpm build:server
   ```

   ```bash
   npx supabase functions deploy action --use-api
   ```

6. Salin `apps/game/.env.example` menjadi `apps/game/.env.local`, isi
   `VITE_SUPABASE_URL` (Project Settings → API → Project URL) dan `VITE_SUPABASE_ANON_KEY`
   (kunci `anon`/publishable, **bukan** service role), lalu jalankan `pnpm dev`.

Ulangi langkah 5 setiap kali logika di `packages/shared` atau isi `data/` berubah, supaya
server dan client menghitung dengan aturan yang sama.

- **Login Wajib & Keamanan Akun (Fase 2C.1)**:
  - Game mewajibkan login sebelum masuk ke desa (`LoginScene`).
  - Metode yang didukung: **Google Sign-In (OAuth)** dan **Email & Kata Sandi**.
  - Fitur pemulihan kata sandi (Forgot Password) dan tautan akun tamu lama (`linkWithEmail`).
  - Tidak membuat akun anonim otomatis saat pertama kali buka.
  - Sesi disimpan aman di `localStorage` dan di-refresh otomatis sebelum kedaluwarsa.

- **Web Portal Game & Edge Function `web` (Fase 2C.2)**:
  - Aplikasi web multi-halaman Vite + TypeScript di `apps/web` dengan tema Epik Gelap (`#0b0a12`, Fredoka).
  - Edge function `supabase/functions/web/index.ts` menangani:
    - `news.list`: daftar berita publik dengan paginasi & filter kategori.
    - `news.get`: membaca artikel berita aman (markdown XSS-sanitized).
    - `leaderboard`: klasemen 50 besar gladiator dari `arena_snapshots`.
    - `myCollection`: daftar ID monster yang sudah terbuka di pedia pemain.
    - `admin.check` & `news.save`/`publish`/`hide`/`delete`: manajemen berita oleh pengguna yang memiliki peran `admin` di tabel `public.admins`.
  - Storage bucket `news-covers`: penyimpanan publik untuk gambar sampul berita.
  - **Keamanan Resep Altar**: Data publik generator (`build-web-data.ts`) secara ketat membersihkan field resep kawin silang Altar (`parentA`, `parentB`, `recipe`) sebelum dimasukkan ke dalam bundle web.

## Menyiapkan Proyek & Database (Fase 2C)

1. Jalankan migrasi database:

   ```bash
   npx supabase db push
   ```

   Ini akan membuat tabel `news`, `admins`, dan bucket `news-covers`.

2. Daftarkan administrator pertama di database:

   ```sql
   insert into public.admins (user_id, role)
   values ('<uuid-user-anda-dari-auth.users>', 'admin');
   ```

3. Bundel server dan deploy edge function:
   ```bash
   pnpm build:server
   npx supabase functions deploy action --use-api
   npx supabase functions deploy arena --use-api
   npx supabase functions deploy pvp --use-api
   npx supabase functions deploy social --use-api
   npx supabase functions deploy web --use-api
   ```

## Konfigurasi CORS & Domain (Fase 2C.3)

Semua edge function (`_shared/db.ts`) membaca environment variable `WEB_APP_ORIGIN`:

- Di lingkungan **pengembangan lokal**, jika tidak disetel, defaultnya adalah `*` agar `localhost:5173` (game) dan `localhost:5174` (web) dapat berkomunikasi secara leluasa.
- Di lingkungan **produksi**, setel variabel rahasia di Supabase Dashboard:
  ```bash
  npx supabase secrets set WEB_APP_ORIGIN="https://soulmonster.game,https://play.soulmonster.game,https://localhost"
  ```
  Daftarkan **semua** asal yang memanggil server, termasuk game di Android (Capacitor memakai `https://localhost`). Server mengembalikan asal pemanggil bila ada di daftar; asal lain ditolak browser.

### Rekomendasi Domain & Hosting

1. **Website Portal (`apps/web`)**:
   - Domain: `https://soulmonster.game` atau `https://www.soulmonster.game`
   - Hosting: Cloudflare Pages / Vercel / Netlify (Build command: `pnpm --filter @soul-monster/web build`, Output dir: `apps/web/dist`)
   - Alamat tanpa `.html`: `/`, `/berita`, `/berita/<slug>`, `/peringkat`, `/monster`, `/admin` (daftar di `apps/web/src/routes.ts`). Setiap halaman adalah folder berisi `index.html`; `/berita/<slug>` diarahkan ke halaman artikel oleh `apps/web/public/_redirects` (Cloudflare Pages, Netlify) atau `apps/web/vercel.json` (Vercel, set Root Directory ke `apps/web`). Website harus dipasang di akar domain, bukan sub-folder.
2. **Game Client (`apps/game`)**:
   - Subdomain: `https://play.soulmonster.game`
   - Hosting: Cloudflare Pages / Vercel (Build command: `pnpm --filter @soul-monster/game build`, Output dir: `apps/game/dist`)
3. **Redirect URL di Supabase Authentication**:
   - Di Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs:
     - `https://soulmonster.game/**`
     - `https://play.soulmonster.game/**`
     - `http://localhost:5173/**`
     - `http://localhost:5174/**`

## Catatan

- Sudah di-deploy dan diuji di proyek `alrkfeyjcsoqarcstymi` (2026-10-22).
- Pertarungan Serbu/Petualangan dan pertarungan musuh liar dihitung di server lewat aksi
  yang sama (bukan fungsi `battle-resolve` terpisah).
- File lokal Supabase CLI (`supabase/.temp`) dan bundel `game.js` tidak di-commit.
