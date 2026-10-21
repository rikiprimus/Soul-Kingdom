/**
 * pnpm sim:economy [--seed N] [--days N] [--detail]
 * Plays the village with a simple bot and prints the milestones, daily income and
 * the population split. --detail adds the bot's village at the end.
 */
import { gameData } from '../src/data';
import { DEFAULT_SIM_PLAYER, formatSimTime, simulateEconomy } from '../src/sim/economy';

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : undefined;
};
const player = {
  ...DEFAULT_SIM_PLAYER,
  seed: option('seed') ?? DEFAULT_SIM_PLAYER.seed,
  days: option('days') ?? DEFAULT_SIM_PLAYER.days,
};
const started = Date.now();
const report = simulateEconomy(player);

const sessions = player.sessionStarts.length;
console.log(
  `\nSimulasi ekonomi Soul Monster — ${player.days} hari, ${sessions} sesi × ${player.sessionMinutes} menit per hari (benih ${player.seed})\n`,
);
console.log('Tonggak:');
for (const m of report.milestones) console.log(`  ${formatSimTime(m.at).padEnd(14)}  ${m.label}`);

const n = (x: number) => Math.round(x).toLocaleString('id-ID');
console.log('\nPer hari (pendapatan, bukan saldo):');
console.log(
  '  hari  balai  plot    emas+  makanan+   kayu+   batu+  kristal+  pekerja  monster(slot)/populasi  menang/kalah  tingkat',
);
for (const d of report.days) {
  console.log(
    [
      String(d.day).padStart(6),
      String(d.townHall).padStart(6),
      String(d.plots).padStart(5),
      n(d.earned.gold).padStart(8),
      n(d.earned.food).padStart(9),
      n(d.earned.wood).padStart(7),
      n(d.earned.stone).padStart(7),
      String(d.earned.soulCrystal).padStart(9),
      String(d.workers).padStart(8),
      `${d.monsters}(${d.monsterSlots})/${d.populationCap}`.padStart(23),
      `${d.fightsWon}/${d.fightsLost}`.padStart(13),
      String(d.maxFormTier).padStart(8),
    ].join(''),
  );
}

if (args.includes('--detail')) {
  const s = report.final;
  console.log('\nDesa di akhir simulasi:');
  const byType = new Map<string, number[]>();
  for (const b of s.village.buildings) {
    byType.set(b.type, [...(byType.get(b.type) ?? []), b.level]);
  }
  for (const [type, levels] of byType) {
    console.log(
      `  ${(gameData.buildingById.get(type)?.name ?? type).padEnd(20)} Lv ${levels.join(', ')}`,
    );
  }
  console.log(`  Saldo: ${JSON.stringify(s.resources)}`);
  const tasks = new Map<string, number>();
  for (const w of s.workers) tasks.set(w.task.kind, (tasks.get(w.task.kind) ?? 0) + 1);
  console.log(`  Pekerja: ${[...tasks].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`  Monster: ${s.monsters.length}, Kuburan: ${s.graveyard.length}`);
}
console.log(`\nSelesai dalam ${((Date.now() - started) / 1000).toFixed(1)} detik.\n`);
