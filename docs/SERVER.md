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

## Catatan

- Sudah di-deploy dan diuji di proyek `alrkfeyjcsoqarcstymi` (2026-10-22).
- Pertarungan Serbu/Petualangan dan pertarungan musuh liar dihitung di server lewat aksi
  yang sama (bukan fungsi `battle-resolve` terpisah).
- File lokal Supabase CLI (`supabase/.temp`) dan bundel `game.js` tidak di-commit.
