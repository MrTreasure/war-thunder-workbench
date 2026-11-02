import rules from "../data/loadout-bombing.json" with { type: "json" };
import type { WikiLoadouts, WikiWeaponParameter } from "./models";
import { optionKey, presetKey, weaponKey, type Mount } from "./loadouts.ts";

import { matchesWeaponFilters } from "./loadout-weapon-filters.ts";

export const bombingRules = rules;
export function massGrams(value: string | undefined): number | null {
  const match = value?.trim().match(/^([\d,]+(?:\.\d+)?)\s*(kg|g|lbs?|t)\s*$/i);
  if (!match) return null;
  const scale = { kg: 1000, g: 1, lb: 453.59237, lbs: 453.59237, t: 1_000_000 }[
    match[2].toLowerCase()
  ];
  const grams = Math.round(Number(match[1].replaceAll(",", "")) * scale!);
  return Number.isSafeInteger(grams) && grams >= 0 ? grams : null;
}
export function bombTntGrams(parameters: WikiWeaponParameter[]) {
  const equivalent = parameters.filter((parameter) => parameter.id === "tnt-equivalent");
  if (equivalent.length > 1) return null;
  if (equivalent.length) return massGrams(equivalent[0].value);
  const type = parameters.filter((parameter) => parameter.id === "explosive-type");
  const mass = parameters.filter((parameter) => parameter.id === "explosive-mass");
  return type.length === 1 && /^TNT$/i.test(type[0].value.trim()) && mass.length === 1
    ? massGrams(mass[0].value)
    : null;
}
export function blastDamage(grams: number): number | null {
  const kg = grams / 1000;
  const curve = rules.tntToBlastDamage;
  if (kg === 0) return 0;
  if (kg < curve[0][0] || kg > curve[curve.length - 1][0]) return null;
  for (let index = 1; index < curve.length; index++) {
    const [x, y] = curve[index],
      [left, low] = curve[index - 1];
    if (kg <= x) return low + ((y - low) * (kg - left)) / (x - left);
  }
  return null;
}
export type BombGroup = {
  key: string;
  name: string;
  count: number;
  grams: number;
  damage: number | null;
};
export function loadoutBombs(data: WikiLoadouts, mounts: Mount[], preset: string | null) {
  const groups = new Map<string, BombGroup>();
  const unknown: string[] = [];
  const add = (name: string, count: number | null, parameters: WikiWeaponParameter[]) => {
    if (!matchesWeaponFilters(name, "bomb", "")) return;
    const grams = bombTntGrams(parameters);
    // Mixed weapon cells do not establish which count/parameters belong to the bomb.
    if (
      count === null ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      grams === null ||
      /\b(missiles?|rockets?|napalm|incendiary|cluster)\b/i.test(name)
    ) {
      unknown.push(name);
      return;
    }
    if (count === 0) return;
    const key = `${weaponKey(name)}:${grams}`;
    const old = groups.get(key);
    groups.set(key, {
      key,
      name,
      count: (old?.count || 0) + count,
      grams,
      damage: blastDamage(grams),
    });
  };
  if (preset !== null) {
    const selected = data.presets.find((item) => presetKey(item) === preset);
    if (!selected) unknown.push("原预设已失效");
    else for (const item of selected.items) add(item.name, item.count, item.parameters || []);
  } else {
    const seen = new Set<string>();
    for (const mount of mounts) {
      if (seen.has(mount.station)) {
        unknown.push("挂点重复");
        continue;
      }
      seen.add(mount.station);
      const option = data.compatibility.find(
        (item) =>
          optionKey(item) === mount.option &&
          item.stations.some((station) => station.hardpointId === mount.station),
      );
      if (!option) {
        unknown.push("原挂载已失效");
        continue;
      }
      add(
        option.name,
        option.stations.find((station) => station.hardpointId === mount.station)!.count,
        option.parameters,
      );
    }
  }
  const items = [...groups.values()];
  return {
    items,
    unknown: [...new Set(unknown)],
    grams: items.reduce((total, item) => total + item.grams * item.count, 0),
  };
}

/** Bounded bin covering with whole bombs: a valid allocation, never fractional bombs.
 * Search limits return an explicitly non-optimal allocation rather than claiming a maximum. */
export function allocateBases(groups: BombGroup[], hp: number) {
  const usable = groups.filter((group) => group.damage !== null && group.damage > 0);
  if (!usable.length) return { count: 0, optimal: true, packs: [] as number[][], groups: usable };
  const damage = usable.map((group) => group.damage!);
  const stock = usable.map((group) => group.count);
  const packs: number[][] = [];
  const current = damage.map(() => 0);
  let budget = 25_000,
    optimal = true;
  const generate = (index: number, total: number) => {
    if (--budget < 0 || packs.length >= 512) {
      optimal = false;
      return;
    }
    if (total + 1e-8 >= hp) {
      if (current.every((count, i) => !count || total - damage[i] + 1e-8 < hp))
        packs.push([...current]);
      return;
    }
    if (index === damage.length) return;
    const max = Math.min(stock[index], Math.ceil((hp - total) / damage[index]));
    for (let count = max; count >= 0 && budget >= 0; count--) {
      current[index] = count;
      generate(index + 1, total + count * damage[index]);
    }
    current[index] = 0;
  };
  generate(0, 0);
  packs.sort(
    (a, b) =>
      a.reduce((sum, count, i) => sum + count * damage[i], 0) -
      b.reduce((sum, count, i) => sum + count * damage[i], 0),
  );
  budget = 5000;
  const memo = new Map<string, { count: number; packs: number[][] }>();
  const solve = (remaining: number[]): { count: number; packs: number[][] } => {
    const key = remaining.join(",");
    const cached = memo.get(key);
    if (cached) return cached;
    if (--budget < 0) {
      optimal = false;
      return { count: 0, packs: [] };
    }
    const upper = Math.floor(
      (remaining.reduce((sum, count, i) => sum + count * damage[i], 0) + 1e-8) / hp,
    );
    let best = { count: 0, packs: [] as number[][] };
    for (const pack of packs) {
      if (!pack.every((count, i) => count <= remaining[i])) continue;
      const rest = solve(remaining.map((count, i) => count - pack[i]));
      if (rest.count + 1 > best.count)
        best = { count: rest.count + 1, packs: [pack, ...rest.packs] };
      if (best.count === upper || budget < 0) break;
    }
    memo.set(key, best);
    return best;
  };
  return { ...solve(stock), optimal, groups: usable };
}
