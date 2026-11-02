import presentation from "../data/loadout-presentation.json" with { type: "json" };

export const loadoutRanks = presentation.ranks;
const terms = Object.entries(presentation.terms).sort(([a], [b]) => b.length - a.length);
/** Display only: matching, content identities and source records stay untouched. */
export function loadoutWeaponName(original: string) {
  let name = original;
  for (const [source, translated] of terms)
    name = name.replace(new RegExp(`\\b${source}\\b`, "gi"), translated);
  return name;
}
export function loadoutParameterValue(original: string) {
  return original
    .split("+")
    .map(
      (part) =>
        presentation.parameterValues[part.trim() as keyof typeof presentation.parameterValues] ||
        loadoutWeaponName(part.trim()),
    )
    .join(" + ")
    .replace(
      /([\d.,]+)\s*(m\/s|km|m|s|g)\b/g,
      (_, value: string, unit: string) =>
        `${value} ${{ "m/s": "米/秒", km: "千米", m: "米", s: "秒", g: "克" }[unit]}`,
    );
}
const searchableWeaponText = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{Dash_Punctuation}]+/gu, "");
export const matchesLoadoutText = (original: string, query: string) =>
  searchableWeaponText(`${original} ${loadoutWeaponName(original)}`).includes(
    searchableWeaponText(query),
  );
