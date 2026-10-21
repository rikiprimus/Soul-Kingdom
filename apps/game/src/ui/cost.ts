import { VILLAGE_RESOURCES, type VillageAmount } from '@soul-monster/shared';
import { formatNumber, t } from '../text';

/** "500 emas + 200 kayu" — only the resources that are actually needed. */
export function costLabel(amount: VillageAmount): string {
  const parts = VILLAGE_RESOURCES.filter((r) => amount[r] > 0).map((r) =>
    t(`cost.${r}`, { n: formatNumber(amount[r]) }),
  );
  return parts.length > 0 ? parts.join(' + ') : t('cost.free');
}
