import type { Valuation } from "./AccountValuation";
import policies from "../data/account-vehicle-policies.json";

const initialFreeIds = new Set(
  policies.vehicles
    .filter(
      (v) =>
        v.classification === "initial_free" && v.freeResearch === true && v.freePurchase === true,
    )
    .map((v) => v.id),
);
/** Presentation only: never modifies server-calculated amounts or the saved payload. */
export function visibleValuation(raw: Valuation | null): Valuation | null {
  if (!raw) return null;
  const removed = new Map<string, boolean | undefined>();
  for (const row of [
    ...raw.research,
    ...raw.gold,
    ...raw.market,
    ...raw.unpriced,
    ...raw.unpriced.flatMap((v) => v.vehicles || []),
    ...raw.packs.flatMap((p) => p.vehicles),
    ...(raw.excluded || []),
    ...(raw.manual || []),
  ]) {
    if (initialFreeIds.has(row.id)) {
      const observed = "observed" in row ? row.observed : undefined;
      if (!removed.has(row.id) || observed !== undefined) removed.set(row.id, observed);
    }
  }
  const keep = (row: { id: string }) => !initialFreeIds.has(row.id);
  const ownership = raw.ownership
    ? {
        ...raw.ownership,
        ownedCount:
          raw.ownership.ownedCount === null
            ? null
            : Math.max(0, raw.ownership.ownedCount - removed.size),
        unplayedCount:
          raw.ownership.unplayedCount === null
            ? null
            : Math.max(
                0,
                raw.ownership.unplayedCount -
                  [...removed.values()].filter((v) => v === false).length,
              ),
      }
    : undefined;
  return {
    ...raw,
    ownership,
    observedCount: Math.max(
      0,
      raw.observedCount - [...removed.values()].filter((v) => v === true).length,
    ),
    researchCount: raw.research.filter(keep).length,
    gold: raw.gold.filter(keep),
    market: raw.market.filter(keep),
    research: raw.research.filter(keep),
    excluded: raw.excluded?.filter(keep),
    manual: raw.manual?.filter(keep),
    packs: raw.packs
      .map((p) => ({ ...p, vehicles: p.vehicles.filter(keep) }))
      .filter((p) => p.vehicles.length),
    unpriced: raw.unpriced.filter(keep).map((v) => ({ ...v, vehicles: v.vehicles?.filter(keep) })),
  };
}
