# Deploy Soul Monster (versi browser)

Versi browser saat ini adalah situs statis: tidak ada server, simpanan ada di `localStorage` browser pemain.

## 1. Build

```bash
pnpm install
pnpm build
```

Hasilnya ada di `apps/game/dist/`. Semua path relatif (`base: './'` di `apps/game/vite.config.ts`), jadi folder ini bisa ditaruh di domain mana pun atau sub-folder (misalnya GitHub Pages `https://<user>.github.io/<repo>/`).

Cek hasil build di komputer sendiri:

```bash
pnpm preview
```

### Build uji dengan panel debug

Panel debug (tambah sumber daya, lompati waktu, ubah level Balai Utama dan jumlah bos, reset simpanan) hanya muncul di `pnpm dev`. Untuk build penguji yang tetap memuat panel debug:

```bash
VITE_ENABLE_DEBUG=true pnpm build
```

Di PowerShell: `$env:VITE_ENABLE_DEBUG='true'; pnpm build`. Lewati kunci Soul Mixer (`rules.debug.skipMixerUnlock`) hanya berlaku di `pnpm dev`; di build uji, naikkan Balai Utama lewat panel debug atau upgrade biasa di desa.

## 2. Pilih hosting

### Netlify (paling cepat)

- Tanpa akun CLI: buka https://app.netlify.com/drop lalu seret folder `apps/game/dist`.
- Dengan CLI: `npx netlify-cli deploy --dir apps/game/dist --prod`.
- Dari repo Git: build command `pnpm build`, publish directory `apps/game/dist`.

### Vercel

- CLI: `npx vercel deploy apps/game/dist --prod`.
- Dari repo Git: Framework "Other", build command `pnpm build`, output directory `apps/game/dist`.

### GitHub Pages

Simpan proyek di repo GitHub, lalu tambahkan `.github/workflows/pages.yml`:

```yaml
name: Deploy Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/game/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

Aktifkan di Settings → Pages → Source: "GitHub Actions".

## 3. Layar penuh, horizontal & pasang sebagai aplikasi

Game dirancang untuk posisi **horizontal (landscape)**.

**Browser**

- Game masuk **layar penuh** pada ketukan atau klik pertama (browser mewajibkan gerakan pengguna).
- Tombol ⛶ di kanan atas HUD untuk masuk atau keluar layar penuh.

**Android (Chrome)**

- Setelah layar penuh, orientasi dikunci horizontal (`screen.orientation.lock`).
- Bila HP dipegang tegak, muncul layar "Putar HP".
- Lewat menu Chrome → "Instal aplikasi" / "Tambahkan ke layar utama", game terbuka layar penuh dan horizontal sesuai `public/manifest.webmanifest`.

**iPhone/iPad (Safari)**

- Safari tidak mendukung layar penuh untuk halaman web biasa.
- Gunakan Bagikan → **Tambahkan ke Layar Utama**: game terbuka tanpa bilah alamat (mode standalone).
- Orientasi tidak bisa dikunci; pemain memutar HP sendiri, dan layar "Putar HP" muncul bila tegak.

**Ikon aplikasi**

- Ikon sementara digambar dengan kode: `pnpm --filter @soul-monster/game icons`.
- Hasilnya di `apps/game/public/icons/`.

**Aplikasi Android (Capacitor, Tugas 2.4)**

- Kunci orientasi di `android/app/src/main/AndroidManifest.xml` pada `<activity>` utama: `android:screenOrientation="sensorLandscape"`.
- Sembunyikan bilah status untuk layar penuh: tema `Theme.AppCompat.NoActionBar` plus mode imersif, misalnya plugin `@capacitor/status-bar` dengan `StatusBar.hide()`.

## 4. Uji di HP

1. Buka tautan publik di browser HP (Chrome Android / Safari iOS).
2. Pastikan: tampilan pas dalam posisi horizontal (mis. 640×360 sampai 1280×720), monster bisa dibeli, diberi makan, dicampur, ditetaskan; muat ulang halaman tidak menghapus antrean Soul Mixer.
3. Opsional: "Tambahkan ke layar utama" agar terasa seperti aplikasi.

Selama pengembangan, HP di jaringan Wi-Fi yang sama juga bisa membuka `pnpm dev` lewat alamat "Network" yang dicetak Vite (server dev sudah memakai `host: true`).

## Catatan

- Simpanan per browser/perangkat (`localStorage`, kunci `soul-monster:save`). Mengganti browser = mulai dari awal.
- Jika format simpanan berubah, naikkan `SAVE_SCHEMA_VERSION` di `packages/shared/src/save.ts` dan tambahkan migrasi.
- Masukan penguji dicatat di `docs/FEEDBACK.md` (Gerbang Fase 0).
