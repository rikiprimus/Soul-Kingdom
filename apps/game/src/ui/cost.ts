import {
  gameData,
  VILLAGE_RESOURCES,
  type BattleReward,
  type Prize,
  type VillageAmount,
} from '@soul-monster/shared';
import { formatNumber, t } from '../text';

/** "500 emas + 200 kayu" — only the resources that are actually needed. */
export function costLabel(amount: VillageAmount): string {
  const parts = VILLAGE_RESOURCES.filter((r) => amount[r] > 0).map((r) =>
    t(`cost.${r}`, { n: formatNumber(amount[r]) }),
  );
  return parts.length > 0 ? parts.join(' + ') : t('cost.free');
}

/** "500 emas + 2 Kristal Jiwa + 5 Permata" — a reward with crystals and gems too. */
export function rewardLabel(r: BattleReward): string {
  const parts = VILLAGE_RESOURCES.filter((k) => r[k] > 0).map((k) =>
    t(`cost.${k}`, { n: formatNumber(r[k]) }),
  );
  if (r.soulCrystal) parts.push(`${r.soulCrystal} ${t('res.soulCrystal')}`);
  if (r.gems) parts.push(`${r.gems} ${t('res.gems')}`);
  return parts.length > 0 ? parts.join(' + ') : t('cost.free');
}

/** A quest or set prize: resources, then Telur Jiwa and the Keajaiban. */
export function prizeLabel(p: Prize): string {
  const parts =
    VILLAGE_RESOURCES.some((k) => p[k] > 0) || p.soulCrystal || p.gems ? [rewardLabel(p)] : [];
  if (p.soulEggs) parts.push(t('prize.soulEggs', { n: p.soulEggs }));
  for (const d of p.decorations) parts.push(gameData.buildingById.get(d)?.name ?? d);
  if (p.wonder) parts.push(gameData.buildingById.get(p.wonder)?.name ?? p.wonder);
  return parts.length > 0 ? parts.join(' + ') : t('cost.free');
}
