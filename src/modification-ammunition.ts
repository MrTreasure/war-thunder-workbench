import type { Modification, Vehicle } from "./models";

const key = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐‑–—−]/g, "-")
    .replace(/\s+(?:shell|shot|round)$/i, "")
    .trim();

/** Only exact ammunition names within this vehicle; never borrow another model's icon. */
export function modificationAmmunitionImage(unit: Vehicle, item: Modification) {
  const names = new Set(
    [item.name, item.nameEn, item.nameZhCN].filter((name): name is string => !!name).map(key),
  );
  const candidates = (unit.wikiDetails?.performance?.groundCombat?.weapons || [])
    .flatMap((weapon) => weapon.shells)
    .filter((shell) => shell.imageUrl && names.has(key(shell.name)));
  const images = [...new Set(candidates.map((shell) => shell.imageUrl!))];
  return images.length === 1 ? images[0] : item.imageUrl;
}
