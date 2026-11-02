import presentation from "../data/loadout-presentation.json" with { type: "json" };

const compile = <T extends { pattern: string }>(rows: T[]) =>
  rows.map((row) => ({ ...row, matches: new RegExp(row.pattern, "i") }));
export const weaponTypes = compile(presentation.weaponTypes);
export const weaponFamilies = compile(presentation.weaponFamilies);

/** Rack combinations can belong to several types and families; never rewrite source names. */
export function matchesWeaponFilters(name: string, type: string, family: string) {
  const series = weaponFamilies.find((item) => item.id === family);
  return (
    (!type || !!weaponTypes.find((item) => item.id === type)?.matches.test(name)) &&
    (!family ||
      !!(
        series?.matches.test(name) &&
        weaponTypes.find((item) => item.id === series.type)?.matches.test(name)
      ))
  );
}
export function availableWeaponFamilies(names: string[], type: string) {
  return weaponFamilies.filter(
    (family) =>
      (!type || family.type === type) &&
      names.some((name) => matchesWeaponFilters(name, type, family.id)),
  );
}
