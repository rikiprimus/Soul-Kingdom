import { encounterGroup, monsterName, type WildEncounter } from '@soul-monster/shared';
import { t } from '../text';

/** "Bandit ×3" or "Monster liar ×2 (Kucing Api, …)". */
export function encounterTitle(e: WildEncounter): string {
  const { kind } = encounterGroup(e);
  if (kind === 'bandit') return t('enemy.bandits', { n: e.count });
  if (kind === 'goblin') return t('enemy.goblins', { n: e.count });
  return t('enemy.monsters', { n: e.count });
}

/** The distinct enemy monsters of a group, by name. */
export function encounterMembers(e: WildEncounter): string {
  const names = [...new Set(e.enemies.map((x) => monsterName(x)))];
  return names.join(', ');
}
