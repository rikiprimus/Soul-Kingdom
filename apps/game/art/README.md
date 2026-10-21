# Sumber seni Soul Monster

Gambar PNG mentah untuk game. Jalankan `pnpm atlas` untuk mengemasnya menjadi atlas Phaser di `public/atlas/`.

- Setiap subfolder (`buildings/`, `ui/`, `monsters/`, ...) menjadi satu atlas: `public/atlas/<folder>.png` + `.json`.
- Nama frame = jalur file di dalam folder tanpa ekstensi, misalnya `buildings/balai-utama/lv1.png` → frame `balai-utama/lv1`.
- Ikuti panduan gaya di skill `soul-monster-art-style` (`I:\Script\Soul Monster\.claude\skills\soul-monster-art-style\SKILL.md`): ukuran PNG, titik jangkar, palet, dan nama file `<id>/lv<level>.png`.
- **Aturan aset (CLAUDE.md aturan 8):** hanya gambar orisinal (buatan sendiri, ilustrator, atau generator seperti SpriteCook). Jangan memakai gambar, karakter, atau aset dari game lain.
