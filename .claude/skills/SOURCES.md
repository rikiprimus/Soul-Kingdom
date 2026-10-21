# Sumber skill

| Skill | Sumber | Lisensi |
|---|---|---|
| soul-monster-art-style | dibuat untuk proyek ini | — |
| phaser-core, game-ui-ux, game-feel, create-game-assets, performance-optimization, save-systems, camera-systems | https://github.com/gamedev-skills/awesome-gamedev-agent-skills (commit 0a70cfc64672, 2026-10-09), disalin apa adanya tanpa diubah | Apache-2.0 (`GAMEDEV-SKILLS-LICENSE.txt`) |

Catatan pemakaian di proyek ini:
- `phaser-core` ditulis untuk Phaser 4.2; proyek ini tetap di **Phaser 3.90** (skill itu sendiri meminta tidak migrasi diam-diam). Pola scene/loader/kamera berlaku untuk keduanya.
- Contoh kode di skill lintas-engine memakai Godot/Unity; terapkan polanya ke Phaser + TypeScript.
- Skrip QA gambar `create-game-assets/scripts/*.py` butuh Python 3.10+ dan Pillow (belum terpasang).
- Tidak dipasang: `survival-crafting` (kebutuhan lapar/haus/inventaris tidak ada di desain), `phaser-arcade-physics` (game tidak memakai fisika), skill Godot/Unity/Unreal/Roblox.
