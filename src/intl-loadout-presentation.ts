import presentation from "../data/loadout-presentation.json";
import { t, getLocale } from "./i18n/core";
import { matchesLoadoutText as sourceMatches } from "./loadout-presentation";
export { loadoutRanks } from "./loadout-presentation";
const terms = Object.entries(presentation.terms).sort(([a], [b]) => b.length - a.length);
/** Translate display terminology only; all matching and saved identities use source names. */
export function loadoutWeaponName(original: string) {
  let name = original;
  for (const [source, translated] of terms)
    name = name.replace(new RegExp(`\b${source}\b`, "gi"), t(translated));
  return name;
}
export function loadoutParameterValue(original: string) {
  return original
    .split("+")
    .map((part) => {
      const value = part.trim();
      return t(
        presentation.parameterValues[value as keyof typeof presentation.parameterValues] ||
          loadoutWeaponName(value),
      );
    })
    .join(" + ")
    .replace(/([\d.,]+)\s*(m\/s|km|m|s|g)\b/g, (_, number: string, unit: string) => {
      const labels: Record<string, string> = {
        "m/s": "米/秒",
        km: "千米",
        m: "米",
        s: "秒",
        g: "克",
      };
      return `${number} ${t(labels[unit])}`;
    });
}
export const matchesLoadoutText = (original: string, query: string) =>
  sourceMatches(original, query) ||
  loadoutWeaponName(original)
    .toLocaleLowerCase(getLocale())
    .replace(/[\s\p{Dash_Punctuation}]+/gu, "")
    .includes(query.toLocaleLowerCase(getLocale()).replace(/[\s\p{Dash_Punctuation}]+/gu, ""));
export function loadoutWeaponLabelWidth(original: string) {
  return [...loadoutWeaponName(original)].reduce(
    (sum, char) =>
      sum +
      (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char)
        ? 1
        : /[MW@]/.test(char)
          ? 0.85
          : /[il.,' ]/.test(char)
            ? 0.28
            : 0.56),
    0,
  );
}
