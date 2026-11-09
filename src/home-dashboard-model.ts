import type { VehicleTileUnit } from "./VehicleTile";
import type { SaleVehicle } from "./sale-calendar-model";
import homeNames from "../data/home-vehicle-names.json";
import bootstrap from "./generated/bootstrap.json";
import { validLineups } from "./lineups";
import { validLoadoutPlans } from "./loadouts";
import { normalizeSaleWatch, saleWatchKey } from "./sale-watch-storage";
import { vehicleDisplayName } from "./vehicle-display-name";
import { object, integer, strings } from "./validation";

export const HOME_SUMMARY_LIMIT = 4;

/** Summaries read saved documents, never country packages or official player queries. */
export function homeDashboardSummary(documents: Record<string, unknown>) {
  const plans: {
    key: string;
    country: string;
    category: string;
    targetId: string;
    targetName: string | null;
  }[] = [];
  const cart = documents["wt-workbench-cart-v1"];
  const savedNames = new Map<string, string>();
  if (Array.isArray(cart)) {
    for (const item of cart) {
      if (!object(item) || !Array.isArray(item.lines)) continue;
      for (const line of item.lines) {
        if (
          object(line) &&
          typeof line.unitId === "string" &&
          typeof line.name === "string" &&
          line.name.trim() &&
          typeof line.country === "string" &&
          typeof line.category === "string"
        ) {
          savedNames.set(
            `${line.country}:${line.category}:${line.unitId}`,
            vehicleDisplayName(line.name),
          );
        }
      }
    }
  }
  const lineups: { country: string; id: string; name: string; vehicles: number }[] = [];
  for (const [key, value] of Object.entries(documents)) {
    const match = /^wt-planner-v1:([^:]+):([^:]+)$/.exec(key);
    if (
      match &&
      Object.hasOwn(bootstrap.categories, match[1]) &&
      Object.hasOwn(bootstrap.countries, match[2]) &&
      object(value) &&
      typeof value.target === "string" &&
      value.target &&
      integer(value.progress) &&
      strings(value.owned) &&
      strings(value.pins) &&
      strings(value.banned)
    ) {
      const translated = (
        homeNames.vehicles as Record<string, { country: string; category: string; name: string }>
      )[value.target];
      const localizedName =
        translated?.country === match[2] && translated.category === match[1]
          ? vehicleDisplayName(translated.name)
          : null;
      plans.push({
        key,
        country: match[2],
        category: match[1],
        targetId: value.target,
        targetName:
          localizedName ||
          (typeof value.targetName === "string" && value.targetName.trim()
            ? vehicleDisplayName(value.targetName)
            : savedNames.get(`${match[2]}:${match[1]}:${value.target}`) || null),
      });
    }
    const country = key.startsWith("wt-lineups-v1:") ? key.slice("wt-lineups-v1:".length) : "";
    if (
      Object.hasOwn(bootstrap.countries, country) &&
      validLineups(value, bootstrap.lineup.maxSlots)
    ) {
      lineups.push(
        ...value.map((row) => ({
          country,
          id: row.id,
          name: row.name,
          vehicles: row.slots.filter(Boolean).length,
        })),
      );
    }
  }
  const loadouts = documents["wt-loadouts-v1"];
  return {
    plans,
    lineups,
    loadouts: validLoadoutPlans(loadouts)
      ? [...loadouts].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      : [],
    watches: normalizeSaleWatch(documents[saleWatchKey]),
  };
}

/** Purchase snapshots retain their saved quotes; cards use canonical presentation facts. */
export function homeWatchPresentation(watch: SaleVehicle) {
  const entry = (
    homeNames.vehicles as Record<
      string,
      {
        country: string;
        category: string;
        name: string;
        card?: VehicleTileUnit;
        flag?: { id: string; name: string; url: string };
      }
    >
  )[watch.id];
  if (entry?.country === watch.country && entry.category === watch.category && entry.card)
    return { unit: entry.card, flag: entry.flag, known: true };
  return {
    unit: {
      id: watch.id,
      name: entry?.name || watch.name,
      rank: watch.rank,
      imageUrl: watch.image,
    },
    flag: undefined,
    known: false,
  };
}

export function homeResearchStatus(targetId: string, ownedIds: Iterable<string> | null) {
  if (ownedIds === null) return { state: "garage-required" as const, remaining: null };
  const records = homeNames.vehicles as Record<
    string,
    { canonicalId: string; parentId: string | null; research: boolean }
  >;
  const target = records[targetId];
  if (!target) return { state: "unknown" as const, remaining: null };
  const owned = new Set([...ownedIds].map((id) => records[id]?.canonicalId || id));
  if (owned.has(target.canonicalId)) return { state: "owned" as const, remaining: 0 };
  let current = records[target.canonicalId],
    remaining = 0;
  const visited = new Set([target.canonicalId]);
  while (current?.parentId) {
    if (visited.has(current.parentId)) return { state: "unknown" as const, remaining: null };
    visited.add(current.parentId);
    const next = records[current.parentId];
    if (!next) return { state: "unknown" as const, remaining: null };
    if (!next.research) break;
    if (!owned.has(next.canonicalId)) remaining++;
    current = next;
  }
  return { state: remaining ? ("prerequisites" as const) : ("researching" as const), remaining };
}
