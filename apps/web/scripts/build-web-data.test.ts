import { describe, expect, it } from 'vitest';
import { gameData } from '@soul-monster/shared';
import { buildWebData } from './build-web-data';

describe('buildWebData generator', () => {
  it('extracts only allowed public data and strips secret recipes', () => {
    const data = buildWebData(gameData);

    // Text prefix check
    for (const key of Object.keys(data.text)) {
      expect(key.startsWith('web.') || key.startsWith('time.')).toBe(true);
    }

    // Arena tiers check
    expect(data.arenaTiers.length).toBe(gameData.rules.arena.tiers.length);

    // Monsters check
    expect(data.allMonsters.length).toBe(100);
    expect(data.featured.length).toBe(5);

    // Element and tier names come from the data files, not the raw ids.
    const element = gameData.elements.elements.find((e) => e.id === data.allMonsters[0]!.element);
    expect(data.allMonsters[0]!.elementName).toBe(element?.name);
    expect(data.tiers).toHaveLength(8);
    expect(data.arenaTiers[0]!.rewardLabel).not.toMatch(/(^|, )0 /);

    // Crucial security constraint: recipes and secret clues never leak into web data!
    const json = JSON.stringify(data);
    expect(json).not.toContain('"parentA"');
    expect(json).not.toContain('"parentB"');
    expect(json).not.toContain('"recipe":{');
    expect(json).not.toContain('"secretRecipes"');
  });
});
