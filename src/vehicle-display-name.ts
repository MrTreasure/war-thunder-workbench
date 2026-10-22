import policy from "../data/vehicle-name-display.json";

const countryGlyphs = new Set(policy.prefixGlyphs);
/** Game country markers need its icon font. Use the client's readable-name fallback. */
export function vehicleDisplayName(raw: string): string {
  const name = raw.replace(/[\u200B\uFEFF]/g, "").trim();
  const letters = Array.from(name);
  let start = 0;
  while (
    start < letters.length &&
    (countryGlyphs.has(letters[start]) || /\s/u.test(letters[start]))
  )
    start++;
  return letters.slice(start).join("");
}
