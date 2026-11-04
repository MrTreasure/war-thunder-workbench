import type { WikiLoadouts, WikiWeaponParameter } from "./models";
import { weaponTypes } from "./loadout-weapon-filters.ts";

export interface SupportedLoadoutWeapon {
  key: string;
  weaponId: string | null;
  name: string;
  imageUrl: string | null;
  source: string | null;
  parameters: WikiWeaponParameter[];
  hardpoints: string[];
  presets: string[];
}
const cleanName = (name: string) =>
  name
    .normalize("NFKC")
    .replace(/^\s*\d+\s*×\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
/** A compatibility inventory, never a claim that all weapons can be mounted together.
 * Names participate in identity: Wiki weapon IDs can be shared by different variants. */
export function supportedLoadoutWeapons(data?: WikiLoadouts) {
  if (data?.status !== "available") return [];
  const inventory = new Map<string, SupportedLoadoutWeapon>();
  function add(
    item: {
      name: string;
      weaponId: string | null;
      source?: string | null;
      imageUrl?: string | null;
      parameters?: WikiWeaponParameter[];
    },
    hardpoints: string[],
    presets: string[],
  ) {
    const name = cleanName(item.name);
    if (!name) return;
    const key = `${item.weaponId || item.source || ""}:${name.toLowerCase()}`;
    const existing =
      inventory.get(key) ||
      [...inventory.values()].find(
        (entry) =>
          entry.name.toLowerCase() === name.toLowerCase() &&
          !(entry.weaponId && item.weaponId && entry.weaponId !== item.weaponId) &&
          !(entry.source && item.source && entry.source !== item.source),
      );
    if (existing) {
      existing.weaponId ||= item.weaponId;
      existing.hardpoints = [...new Set([...existing.hardpoints, ...hardpoints])];
      existing.presets = [...new Set([...existing.presets, ...presets])];
      existing.imageUrl ||= item.imageUrl || null;
      existing.source ||= item.source || null;
      if (!existing.parameters.length) existing.parameters = item.parameters || [];
    } else
      inventory.set(key, {
        key,
        weaponId: item.weaponId,
        name,
        imageUrl: item.imageUrl || null,
        source: item.source || null,
        parameters: item.parameters || [],
        hardpoints,
        presets,
      });
  }
  const points = new Set(data.hardpoints.map((point) => point.id));
  for (const item of data.compatibility) {
    const compatible = item.stations.filter(
      (point) => points.has(point.hardpointId) && (point.count === null || point.count > 0),
    );
    if (compatible.length && (item.count === undefined || item.count === null || item.count > 0))
      add(
        item,
        compatible.map((point) => point.hardpointId),
        [],
      );
  }
  for (const preset of data.presets)
    for (const item of preset.items)
      if (item.count === null || item.count > 0) add(item, [], [preset.label]);
  return [...inventory.values()];
}
export function supportedWeaponGroups(weapons: SupportedLoadoutWeapon[]) {
  const groups = new Map<string, SupportedLoadoutWeapon[]>();
  for (const weapon of weapons) {
    const types = weaponTypes.filter((type) => type.matches.test(weapon.name));
    const label = types.length > 1 ? "组合挂载" : types[0]?.label || "其他挂载";
    groups.set(label, [...(groups.get(label) || []), weapon]);
  }
  return [...groups].map(([label, items]) => ({ label, items }));
}
